"""ロースターECの巡回。Shopify / WooCommerce を自動判定して商品を正規化する。"""
from __future__ import annotations
import asyncio
import html
import json
import random
import re
import unicodedata
from dataclasses import dataclass, asdict
from urllib.parse import urljoin

import httpx

# 一部のShopify店はボットUAの /products.json をブロックするため、実ブラウザ相当のUAで取得する。
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
REQ_HEADERS = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}

# 産地の名前。店ごとに書き方が違うので、次の3つを見る。
#   1. 英語の国名
#   2. その国の言葉での呼び方・つづり違い（Etiopía / Perú / Brasil / 衣索比亞 …）
#   3. 産地が確定する地域名・農園名（Yirgacheffe → エチオピア、Huila → コロンビア）
#
# 前は英語と日本語の国名40語だけを見ていた。実測すると、産地が読めなかった
# 2,945件のうち約325件は、この3つを見れば分かるものだった。
# 照合はアクセントを外してから行う（"Peru" は "Perú" に含まれない）。
ORIGIN_ALIASES: dict[str, tuple[str, ...]] = {
    "Ethiopia": ("ethiopia", "etiopia", "etiopien", "athiopien", "aethiopien", "エチオピア",
                 "衣索比亞", "埃塞俄比亚", "yirgacheffe", "yirga", "sidamo", "sidama", "guji",
                 "limu", "harrar", "jimma", "gedeb", "kochere", "hambela", "shakiso", "nensebo"),
    "Colombia": ("colombia", "colombie", "kolumbien", "コロンビア", "哥倫比亞", "哥伦比亚",
                 "huila", "narino", "cauca", "tolima", "antioquia", "quindio", "risaralda",
                 "caldas", "pitalito", "planadas"),
    # 水洗工場の名だけで売られる銘柄がある（"Mwendi Wega" に国名は無い）。
    # "wega" 単独は入れない。同じ綴りのエスプレッソ機の銘柄があり、器具を
    # ケニア産と読み違える。工場名は丸ごとで照合する。
    "Kenya": ("kenya", "kenia", "ケニア", "肯亞", "肯尼亚", "nyeri", "kirinyaga", "kiambu",
              "muranga", "gichathaini", "karatina", "mwendi wega", "gatomboya", "kagumoini"),
    # ゲイシャは農園名だけで売られることが多く、国名が名前に出ない
    "Panama": ("panama", "パナマ", "巴拿馬", "boquete", "volcan", "chiriqui", "hartmann",
               "esmeralda", "jaramillo", "elida", "janson", "finca deborah"),
    "Brazil": ("brazil", "brasil", "brasilien", "bresil", "ブラジル", "巴西",
               "cerrado", "mogiana", "sul de minas", "minas gerais", "mantiqueira"),
    "Peru": ("peru", "perou", "ペルー", "cajamarca", "chanchamayo", "amazonas"),
    "Guatemala": ("guatemala", "グアテマラ", "瓜地馬拉", "危地马拉",
                  "antigua", "huehuetenango", "acatenango", "atitlan", "fraijanes"),
    "Costa Rica": ("costa rica", "コスタリカ", "哥斯大黎加", "哥斯达黎加",
                   "tarrazu", "west valley", "naranjo", "brunca", "tres rios"),
    "El Salvador": ("el salvador", "エルサルバドル", "薩爾瓦多", "apaneca", "chalatenango"),
    "Honduras": ("honduras", "ホンジュラス", "宏都拉斯", "marcala", "copan", "santa barbara",
                 "ocotepeque", "intibuca"),
    "Nicaragua": ("nicaragua", "ニカラグア", "尼加拉瓜", "jinotega", "matagalpa", "nueva segovia"),
    "Ecuador": ("ecuador", "equateur", "エクアドル", "厄瓜多", "loja", "pichincha"),
    "Bolivia": ("bolivia", "bolivien", "ボリビア", "caranavi", "yungas"),
    "Mexico": ("mexico", "mexiko", "メキシコ", "chiapas", "oaxaca", "veracruz"),
    "Rwanda": ("rwanda", "ruanda", "ルワンダ", "盧安達", "nyamasheke", "huye", "gakenke", "rulindo"),
    "Burundi": ("burundi", "ブルンジ", "蒲隆地", "kayanza", "ngozi", "kirundo", "muyinga"),
    "Tanzania": ("tanzania", "tansania", "タンザニア", "坦尚尼亞", "kilimanjaro", "mbeya", "mbinga"),
    "Uganda": ("uganda", "ウガンダ", "rwenzori", "sipi"),
    "Congo": ("congo", "kongo", "コンゴ", "kivu", "virunga"),
    "Zambia": ("zambia", "sambia"),
    "Malawi": ("malawi",),
    "Madagascar": ("madagascar", "マダガスカル"),
    "Yemen": ("yemen", "jemen", "イエメン", "葉門", "haraz", "bani matar"),
    "India": ("india", "indien", "インド", "印度", "chikmagalur", "coorg", "kodagu",
              "baba budan", "monsoon malabar", "attikan", "seethargundu"),
    "Indonesia": ("indonesia", "indonesien", "インドネシア", "印尼",
                  "sumatra", "mandheling", "aceh", "gayo", "toraja", "kintamani", "flores"),
    "Papua New Guinea": ("papua new guinea", "papua-neuguinea", "パプアニューギニア"),
    "Timor-Leste": ("timor", "東ティモール"),
    "Vietnam": ("vietnam", "viet nam", "ベトナム", "越南", "da lat", "dalat", "son la"),
    "Laos": ("laos", "ラオス", "bolaven"),
    "Thailand": ("thailand", "タイ", "泰國", "chiang mai", "doi chaang"),
    "Myanmar": ("myanmar", "burma", "ミャンマー"),
    "Nepal": ("nepal", "ネパール"),
    "China": ("china", "yunnan", "中国", "雲南", "云南", "baoshan", "dehong", "pu'er"),
    "Taiwan": ("taiwan", "台湾", "台灣", "alishan", "阿里山", "nantou", "南投", "chiayi", "嘉義"),
    "Jamaica": ("jamaica", "jamaika", "ジャマイカ", "blue mountain"),
    "Hawaii": ("hawaii", "hawai'i", "ハワイ", "kona"),
    "Dominican Republic": ("dominican", "dominikanische", "ドミニカ"),
    "Venezuela": ("venezuela", "ベネズエラ"),
    "Cuba": ("cuba", "キューバ"),
    "Haiti": ("haiti", "ハイチ"),
}
# 「エチオピア」のように、そのまま名乗っている場合に備えて英語名も引ける形にする
ORIGIN_WORDS = list(ORIGIN_ALIASES)


def _fold(s: str) -> str:
    """アクセントを外して小文字にする。"Perú" と "Peru" を同じものとして扱う。"""
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


# 嫌気性は Natural / Washed まで判別する（図鑑はこの2種を別色・別カテゴリで扱うため、
# "Anaerobic" だけだとどちらにも分類されず絞り込めなくなる）。複合語を先に判定する。
PROCESS_WORDS = [
    ("anaerobic natural", "Anaerobic Natural"), ("natural anaerobic", "Anaerobic Natural"),
    ("anaerobic washed", "Anaerobic Washed"), ("washed anaerobic", "Anaerobic Washed"),
    ("嫌気性ナチュラル", "Anaerobic Natural"), ("アナエロビックナチュラル", "Anaerobic Natural"),
    ("嫌気性ウォッシュ", "Anaerobic Washed"), ("アナエロビックウォッシュ", "Anaerobic Washed"),
    ("anaerobic", "Anaerobic"), ("carbonic", "Carbonic Maceration"),
    ("thermal shock", "Thermal Shock"), ("honey", "Honey"),
    ("natural", "Natural"), ("washed", "Washed"),
    ("ナチュラル", "Natural"), ("ウォッシュ", "Washed"), ("ハニー", "Honey"),
]


@dataclass
class Product:
    key: str            # roaster::handle
    roaster: str
    country: str
    title: str
    url: str
    image: str
    price: float
    currency: str
    grams: int
    per100: float | None
    available: bool
    origin: str
    process: str
    tags: str
    notes: str = ""
    # 風味をどの道で取ったか。"label"=見出しの直後 / "guess"=当て推量 / ""=無し。
    # 集計で「確かな方だけ使う」を選べるようにするための目印。
    note_src: str = ""
    # 店が product_type / tags に「これはコーヒーだ」と書いていたか。
    # "c" = 書いてある / "" = 何も書いていない。
    # 表示側はこれを見て、名前からの当て推量の規則を使うかどうかを決める。
    kind: str = ""
    # 店の所在地。地球儀の点はここから決まる。国コードしか無いと、
    # 同じ国の店が全部1点に重なる（実際、米国の10軒はカンザスに固まっていた）。
    city: str = ""
    province: str = ""


def _guess_origin(text: str) -> str:
    """産地を1つ返す。分からなければ空文字。

    国名そのものが無くても、地域名や農園名で分かることが多い
    （"Yirgacheffe Kochere" にエチオピアとは書かれていない）。
    長い呼び名から先に見る。"costa rica" を "rica" より先に当てるため。
    """
    t = _fold(text)
    best, best_len = "", 0
    for country, alts in ORIGIN_ALIASES.items():
        for a in alts:
            fa = _fold(a)
            if len(fa) > best_len and fa in t:
                best, best_len = country, len(fa)
    return best


# --- 豆である証拠 -----------------------------------------------------------
#
# 取り方を「全部取ってから豆でないものを外す」（引き算）から
# 「豆である証拠がある物だけ取る」（足し算）に変えるための材料。
#
# 引き算は各国語ぶんの語が要るので一覧が終わらない。実際、英語と日本語だけで
# 書いていた時期は台湾の濾杯・膠囊が並び、広げると本物の豆（Mwendi Wega・
# キッサブレンド・Coffee & Tea）を巻き添えにした。
#
# 足し算に使う証拠は、言語や店に関わらず豆の側にだけ現れるものを選ぶ。

# 品種。豆にしか出ない固有名詞
_VARIETY = re.compile(
    r"(?i)\bgeisha\b|\bgesha\b|\bbourbon\b|\bcaturra\b|\bcatuai\b|\btypica\b"
    r"|\bpacamara\b|\bmaragogype\b|\bsl-?\s?(28|34)\b|\bruiru\b|\bbatian\b"
    r"|\bheirloom\b|\bwush\s?wush\b|\bsidra\b|\bmokka\b|\bcastillo\b|\bcolombia\s?variety\b"
    r"|\bpink\s?bourbon\b|\bjava\b|\bkent\b|\bmundo\s?novo\b|\bacaia\b|\bobata\b"
    r"|\beugenioides\b|\blaurina\b|\bparainema\b|\bmarsellesa\b|\bcatimor\b"
    r"|ゲイシャ|ブルボン|カトゥーラ|ティピカ|パカマラ|エチオピア在来|藝伎|瑰夏|波旁")
# 挽き方の選択肢。豆にしか付かない。
# 器具にもTシャツにも「挽き方を選ぶ」欄は無いので、これがあれば豆と考えてよい。
# 実測で Tim Wendelboe の Kapsokisio（ウガンダの実在の銘柄）を落としかけた。
# 名前が水洗工場の名だけで、産地の語も内容量も焙煎度も無かったため。
# 挽き方の欄を見ていれば拾えた。
_GRIND = re.compile(
    r"(?i)\bgrinds?\b|\bgrind\s?(size|type|option)\b|\bwhole\s?beans?\b|\bground\b"
    r"|\bmahlgrad\b|\bmouture\b|\bmolienda\b|\bmalning\b|\bkværning\b|\bmaling\b"
    r"|挽き方|挽き目|豆のまま|研磨|磨豆|粉碎|원두|분쇄")
# 焙煎度
_ROAST = re.compile(
    r"(?i)\b(light|medium|dark|city|full\s?city|french|italian|omni)\s?roast\b"
    r"|\broast\s?(level|profile)\b|\b(light|medium|dark)-(light|medium|dark)\b"
    r"|浅煎り|中煎り|深煎り|中深煎り|浅焙|中焙|深焙|淺烘焙|中烘焙|深烘焙|淺焙")


def bean_markers(title: str, body: str, grams_field: int, grams_title: int,
                 kind: str = "", options: str = "") -> set[str]:
    """その商品が豆だと言える証拠を集める。強い証拠と弱い証拠を分けて返す。

    ■ 強い証拠（大文字）— 商品名とタグにある
        店員がその商品そのものを指して書いた言葉なので、外れが少ない。

        W  内容量が商品名か規格名に書いてある（"Ethiopia Guji 250g"）
        O  産地      P  精製      V  品種      R  焙煎度
        G  挽き方を選ぶ欄がある。器具にもTシャツにも付かない

    ■ 弱い証拠（小文字）— 説明文にある
        器具の説明文にも産地や淹れ方は出てくるので、そこだけを頼りにはできない。
        実測で CLEVER DRIPPER が「台湾」で産地ありと判定された。台湾製だからで、
        豆だからではない。

        o p v r

    ■ 証拠にならないもの
        Shopify の重量欄（grams）は出荷重量。マグにも T シャツにも入っている。
        実測 4127 件のうち 92.4% に値があり、何も分けられなかった。だから
        単独では証拠に数えない。強い証拠の裏付けとしてだけ使う（"g"）。

        c  店が product_type に「コーヒー」と書いている。カプセルもギフト箱も
           「コーヒー」なので、これ単独でも豆の証明にはならない。
    """
    m: set[str] = set()
    if grams_title > 0:
        m.add("W")
    if _guess_origin(title):
        m.add("O")
    if _guess_process(title):
        m.add("P")
    if _VARIETY.search(title):
        m.add("V")
    if _ROAST.search(title):
        m.add("R")
    if options and _GRIND.search(options):
        m.add("G")

    if _guess_origin(body):
        m.add("o")
    if _guess_process(body):
        m.add("p")
    if _VARIETY.search(body):
        m.add("v")
    if _ROAST.search(body):
        m.add("r")

    if grams_field > 0:
        m.add("g")
    if kind == "c":
        m.add("c")
    return m


STRONG = ("W", "O", "P", "V", "R", "G")
WEAK = ("o", "p", "v", "r")


def option_text(p: dict) -> str:
    """選択肢の欄を1つの文字列にまとめる。挽き方の欄を探すために使う。

    Shopify の options は [{"name": "Grind", "values": ["Whole bean", ...]}] の形。
    店によっては options を持たず、規格名（variants[].title）に
    "250g / Whole Bean" のように入れているので、そちらも混ぜる。
    """
    parts: list[str] = []
    for o in p.get("options") or []:
        if isinstance(o, dict):
            parts.append(str(o.get("name", "")))
            vals = o.get("values") or []
            parts.extend(str(v) for v in vals) if isinstance(vals, list) else None
        else:
            parts.append(str(o))
    parts.extend(str(v.get("title", "")) for v in (p.get("variants") or []))
    return " ".join(parts)


def _guess_process(text: str) -> str:
    low = text.lower()
    for needle, label in PROCESS_WORDS:
        if needle in low:
            return label
    return ""


# --- 店が書いたテイスティングノートの抽出 ---------------------------------
# 産地・精製・風味は商品タイトルではなく商品説明(body_html)に書かれていることが
# ほとんどで、そこを読まないと味わいマップの入力が「産地と精製」だけになる。
_TAG_BR = re.compile(r"(?i)<\s*(br|/p|/div|/li|/tr|/h[1-6])\s*/?>")
_TAGS = re.compile(r"(?is)<[^>]+>")
_WS = re.compile(r"[ \t\u3000]+")

def html_to_text(html: str) -> str:
    """body_html を行つきの素テキストにする（ブロック要素を改行に置き換える）。"""
    s = html or ""
    s = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", s)
    s = _TAG_BR.sub("\n", s)
    s = _TAGS.sub(" ", s)
    s = (s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<")
          .replace("&gt;", ">").replace("&quot;", '"').replace("&#39;", "'"))
    s = _WS.sub(" ", s)
    return "\n".join(ln.strip() for ln in s.split("\n") if ln.strip())

# 見出しの語そのもの。ここだけを1か所に持ち、行頭の判定と、
# 取り出したあとの残骸そぎ落としの両方から使う。
_LABEL_WORDS = (r"(?:with\s+)?(?:tasting\s*)?notes?\s+of|tasting\s*notes?|flavou?r\s*notes?"
                r"|cupping\s*notes?|flavou?r\s*profile|tastes?\s*like|tasting\s*comments?"
                r"|flavou?rs?|tasting|notes?"
                r"|テイスティング\s*(?:ノート|コメント)|カッピング\s*(?:ノート|コメント)"
                r"|フレーバー(?:ノート)?|フレーバ|風味|味わい|テイスト")
# 見出しを囲む記号。実測で【FLAVOR】（味わい）[Flavor notes] の3通りが出た。
# ここを許していなかったので、その店の風味が丸ごと取れていなかった。
_LABEL_OPEN = r"[\s\-–—・*\[\(【（「『]*"
_LABEL_CLOSE = r"[\]\)】）」』]*"

# 「Tasting Notes: 〜」のように見出しが付いている行を拾う
_NOTE_LABEL = re.compile(
    rf"(?im)^{_LABEL_OPEN}(?:{_LABEL_WORDS}){_LABEL_CLOSE}\s*[:：]?\s*(.*)$")

# 行の途中に見出しがある場合（"Our tasting notes : ..."）。
# 当て推量で拾った行から、前置きごと見出しを落とすのに使う。
_LABEL_ANYWHERE = re.compile(
    rf"(?i)^.{{0,20}}?{_LABEL_OPEN}(?:{_LABEL_WORDS}){_LABEL_CLOSE}\s*[:：]\s*")

# アレルギー・原材料の表示。風味語（ナッツ・アーモンド・大豆…）が並ぶので
# 風味として拾ってしまう。実測で Proud Mary のチャイが
# 「MAY CONTAIN PEANUT, ALMOND」を風味にしていた。
_ALLERGEN = re.compile(
    r"(?i)may\s+contain|contains?\s+(?:traces|milk|soy|nuts?|almond|peanut|wheat)"
    r"|allergen|アレルギー|を含みます|原材料")

# 同じ語が続けて出てくるもの（"define define"）。店の原稿の打ち間違い
_DUP_WORD = re.compile(r"(?i)\b(\w{3,})(\s+\1)+\b")
# ピリオドのあとに空白が無い（"CARAMEL.BERRY"）。両側が文字のときだけ空ける。
# 数字は触らない（"1.5" を壊さないため）
_TIGHT_DOT = re.compile(r"(?<=[A-Za-z])\.(?=[A-Za-z])")
# 見出しが無い店向け。風味語が2つ以上並ぶ短い行を候補にする
_FLAVOR_WORD = re.compile(
    r"(?i)berr|cassis|cherry|plum|straw|blueberr|raspberr|currant|acerola|hibiscus"
    r"|citrus|lemon|lime|orange|grapefruit|mandarin|bergamot|yuzu"
    r"|floral|jasmine|rose|tea\b|lavender|chamomile|blossom"
    r"|tropical|pineapple|mango|lychee|passion|guava|melon|peach|apricot|papaya"
    r"|chocolate|cocoa|cacao|nut|almond|hazelnut|caramel|toffee|brown\s*sugar|honey|vanilla|malt|molasses|syrup"
    r"|apple|pear|grape|fig|date|raisin|tamarind|rhubarb|lemongrass|nougat|cane|spice|cinnamon"
    r"|ベリー|カシス|苺|いちご|ストロベリー|チェリー|プラム|柑橘|レモン|オレンジ|グレープフルーツ"
    r"|花|ジャスミン|紅茶|ローズ|トロピカル|パイナップル|マンゴー|ライチ|ピーチ|白桃|杏"
    r"|チョコ|カカオ|ココア|ナッツ|キャラメル|黒糖|蜂蜜|はちみつ|バニラ|モルト|林檎|りんご|ぶどう")

def _clean_note(s: str) -> str:
    """取り出した風味の文字列を整える。

    実測で出てきた壊れ方を、ここでまとめて直す。
      ・見出しの残骸  「Our tasting notes : 〜」→ 見出しから前を落とす
      ・語の重複      「toffee define define Decaf」→ 1つにする
      ・区切りの消え  「CARAMEL.BERRY」→「CARAMEL. BERRY」

    残骸を残したまま集計すると、"tasting" や "味わい" が風味の語として
    数えられてしまう（味わいマップと法人向けレポートの材料になるため）。
    """
    s = (s or "").strip(" .．、,:：-–—/|()（）[]【】")
    s = _LABEL_ANYWHERE.sub("", s)          # 行の途中に見出しがある場合
    s = _TIGHT_DOT.sub(". ", s)
    s = _DUP_WORD.sub(r"\1", s)
    s = re.sub(r"(?i)^(and|of|with)\s+", "", s.strip(" .．、,:：-–—/|()（）[]【】"))
    return _WS.sub(" ", s)[:160]

# 地の文から風味の並びだけを切り出すための手がかり。
# 「〜の風味があります」の "〜" にあたる部分を、はっきりした接続語がある場合だけ拾う。
# 接続語が無い文には触らない（勝手に切ると意味が変わる）。
_PROSE_LEAD = re.compile(
    r"(?i)\b(?:with|of)\s+(?:flavou?rs?|notes?|hints?|aromas?|tastes?)\s+of\s+"
    r"|\b(?:flavou?rs?|notes?|hints?|aromas?)\s+of\s+"
    r"|\btastes?\s+(?:like|of)\s+"
    r"|\breminiscent\s+of\s+")
# 切り出したあとに残る締めの言葉。"chocolate and cherry in the cup." のような尾
_PROSE_TAIL = re.compile(
    r"(?i)\s+(?:in\s+the\s+cup|throughout|on\s+the\s+finish|with\s+a\s+\w+\s+finish)\b.*$")


def trim_prose(s: str) -> str:
    """地の文から風味の並びだけを残す。手がかりが無ければそのまま返す。

    "A comforting and sweet coffee with flavours of chocolate and cherry"
      → "chocolate and cherry"

    見出しの無い店では、風味が文章の中に埋まっている。そのまま集計すると
    "comforting" や "coffee" まで数えることになる。ただし切りすぎると
    意味が変わるので、接続語がはっきりある場合だけ切る。

    ■ 風味語を1つでも落とすなら、切らない

    実データで並べて見たら、5件中3件で風味が消えていた。

      前: Rich caramel-like sweetness and taste of cherry candy...
      後: cherry candy...                          ← caramel が消えた

      前: This coffee has classical dark chocolate flavour notes, with a hazelnut...
      後: hazelnut...                              ← dark chocolate が消えた

    接続語は文の途中にもある。そこで切ると、前半に書かれていた風味ごと
    捨てることになる。切る前と後で風味語の集まりが変わるなら、切らない。
    """
    m = _PROSE_LEAD.search(s or "")
    if not m:
        return s
    out = s[m.end():].strip(" .．、,:：-–—")
    out = _PROSE_TAIL.sub("", out).strip(" .．、,:：-–—")
    # 切った結果が短すぎる・風味語が無いなら、切らない方が安全
    if len(out) < 3 or not _FLAVOR_WORD.search(out):
        return s
    if _flavor_words(out) != _flavor_words(s):
        return s
    return out


def _flavor_words(s: str) -> set:
    return {w.lower() for w in _FLAVOR_WORD.findall(s or "")}


def extract_notes_src(html: str, title: str = "",
                      trim: bool = True) -> tuple[str, str]:
    """風味の記述と、どの道で見つけたかを返す。

      ("…", "label")  見出しの直後。店が「これは風味だ」と書いている
      ("…", "guess")  見出しが無く、風味語が2つ以上ある行から拾った
      ("", "")        見つからない

    ■ なぜ道を分けて持つのか

    この2つは質が違う。見出しありは "Grape, Guava, Floral" のような列挙で、
    そのまま風味語として数えられる。当て推量は
    "A comforting and sweet coffee with flavours of chocolate" のような
    説明文の地の文を拾うことがあり、間違ってはいないが列挙ではない。

    実測（120店）では見出しが1件も無い店が多く（Five Senses 70件中0件、
    Coffee Collective 56件中0件）、そういう店では当て推量が全量を支えている。
    混ぜて1つの欄に入れると、あとから選び分けられない。

    集計するときに「確かな方だけ使う」を選べるように、豆ごとに残す。
    """
    text = html_to_text(html)
    if not text:
        return "", ""
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        m = _NOTE_LABEL.match(ln)
        if not m:
            continue
        val = _clean_note(m.group(1))
        # 「Tasting Notes」だけの見出し行なら、次の行が中身
        if len(val) < 3 and i + 1 < len(lines):
            val = _clean_note(lines[i + 1])
        if len(val) >= 3 and _FLAVOR_WORD.search(val) and not _ALLERGEN.search(val):
            return val, "label"
    # 見出しが無い場合：風味語が2種類以上ある短い行を採る
    for ln in lines:
        if len(ln) > 90 or len(ln) < 5:
            continue
        if _ALLERGEN.search(ln):
            continue
        if len(set(w.group(0).lower() for w in _FLAVOR_WORD.finditer(ln))) >= 2:
            # 地の文なら、風味の並びだけを切り出す。切ると風味が消える文には
            # 触らない（trim_prose がそのまま返す）。見出しのある方には使わない
            val = _clean_note(ln)
            # trim=False は監査用。切る前と後を並べて見るために生の文が要る
            return (trim_prose(val) if trim else val), "guess"
    return "", ""


def extract_notes(html: str, title: str = "") -> str:
    """商品説明から風味の記述だけを取り出す。見つからなければ空文字。"""
    return extract_notes_src(html, title)[0]


def _grams_from_text(text: str) -> int:
    """内容量をグラムで返す。読めなければ 0。

    オンスとポンドも読む。米国の店は袋を "8.8oz" "12 oz" "5lbs" と書く。
    実測で Onyx Coffee Lab の商品が、規格が "8.8oz" だけだったために
    内容量が読めず、豆である証拠が立たずに落ちていた。
    8.8oz は 250g の袋のこと。
    """
    m = re.search(r"(\d+(?:\.\d+)?)\s*(kg|lbs?|oz|g)\b", text.lower())
    if not m:
        return 0
    val, unit = float(m.group(1)), m.group(2)
    if unit == "kg":
        return int(val * 1000)
    if unit == "oz":
        return int(val * 28.35)
    if unit in ("lb", "lbs"):
        return int(val * 453.6)
    return int(val)


# 産地・精製を説明文から読むときに、どこまで見るか。
#
# 前は1200字で切っていた。店の説明文は「物語 → 生産者 → 標高 → 精製 → 味」の順が多く、
# 表が下にあると丸ごと落ちる。実測（21店・1192件）で、全部読むと
# 産地が3件・精製が10件増えた。1.1%と小さいが、失う理由も無いので広げる。
# 説明文の長さは実測で中央値1903字・最長3927字だったので、6000字あれば足りる。
# 上限を残すのは、まれに数万字を返す店から守るため。
DEEP_CHARS = 6000

# 失敗理由（HTTPステータス等）を店ごとに残し、ログで原因を追えるようにする。
LAST_REASON: dict[str, str] = {}
# 「豆である証拠が無い」で取らなかった数を店ごとに残す。
# 落とした物は画面に出ないので、数字にしておかないと落としすぎに気づけない。
LAST_DROPPED: dict[str, int] = {}


# 実測: GitHub Actions のIPからは Shopify が 429 を返し続け、90秒待っても解消しない
# （1回の巡回に58分かけて成果ゼロだった）。IP単位の制限なので待っても無駄と割り切り、
# Retry-After が短く示された時だけ1回待ち、それ以外は素早く諦めて次の店へ進む。
# 理由は戻り値で返す。店は並行に巡回しているので、共有の辞書に書くと
# 隣の店の失敗理由が混ざり、URLの誤りとレート制限を見分けられなくなる。
# 1つのURLを何回まで試すか。既定は3回（2秒→4秒→8秒と待つ）。
#
# 本番の巡回では、一時的な不調で店を落とさないために粘る価値がある。
# ただし候補を下見するときは話が別で、閉じたドメインが並ぶため、
# 1店あたり最大 3回×(20秒+待ち) かかり、18店で15分の上限に当たった。
# 設定 retries で下げられるようにしてある（crawl_all が読む）。
RETRIES = 3


# ---------------- robots.txt ----------------
#
# 店が robots.txt で断っている道は通らない。技術的に取れるかどうかより先に、
# 取っていいかどうかを見る。
#
# この方針は診断ツール（scripts/diagnose_shop.py）にだけ書かれていて、毎時455店を
# 叩いている巡回の本体には入っていなかった。入れる前に何店が該当するかを数えた
# （scripts/audit_robots.py, 2026-08-16, 455店）:
#
#   robots.txt があった          360店
#   巡回する道を断っている店       2店（Atmans Coffee / Bear Pond Espresso）
#   その2店が今出している豆        0件
#
# つまり守っても図鑑は痩せない。0件だと分かったうえで入れている。
_ROBOTS: dict[str, list[tuple[str, str]]] = {}

# 断られて取りに行かなかった回数（店の入口ごと）。
# 断られた店は、そのあと必ず別の理由で失敗する。sitemap を断られれば
# 「sitemapに商品ページが無い」と出る——実測でその通りに出た。それを見た人は
# 在りもしない sitemap の不具合を探すことになる。断りは断りとして残す。
_REFUSED: dict[str, int] = {}


def origin_of(url: str) -> str:
    m = re.match(r"(https?://[^/]+)", url or "")
    return m.group(1) if m else ""


def robots_rules(txt: str) -> list[tuple[str, str]]:
    """User-agent: * に向けた Allow / Disallow を取り出す。

    User-agent 行は続けて何行も書ける。

        User-agent: GPTBot
        User-agent: *
        Disallow: /

    これは両方に向けた1つのまとまりで、* も断られている。
    1行ずつ上書きすると後の行だけを見てしまい、この形を読み落とす。
    """
    rules: list[tuple[str, str]] = []
    applies, in_group = False, False
    for line in (txt or "").splitlines():
        line = line.split("#")[0].strip()
        if not line:
            continue
        k, _, v = line.partition(":")
        k, v = k.strip().lower(), v.strip()
        if k == "user-agent":
            if in_group:                  # 規則をはさんだら次のまとまり
                applies, in_group = False, False
            applies = applies or v == "*"
        elif k in ("disallow", "allow"):
            in_group = True
            if applies and v:
                rules.append((k, v))
    return rules


def robots_match(rules: list[tuple[str, str]], path: str) -> tuple[str, str]:
    """path に当たる規則のうち、いちばん長く前方一致するもの。

    当たらなければ ("", "")。同じ長さなら Allow が勝つ（許す側に倒す）。
    """
    best = ("", "")
    for k, v in rules:
        if path.startswith(v) and (len(v) > len(best[1])
                                   or (len(v) == len(best[1]) and k == "allow")):
            best = (k, v)
    return best


def robots_allows(rules: list[tuple[str, str]], path: str) -> bool:
    return robots_match(rules, path)[0] != "disallow"


def path_allowed(url: str) -> bool:
    """この URL を取りに行っていいか。robots.txt を読んでいない店は通す。"""
    org = origin_of(url)
    rules = _ROBOTS.get(org)
    if not rules:
        return True
    return robots_allows(rules, url[len(org):] or "/")


async def load_robots(client: httpx.AsyncClient, url: str) -> None:
    """店の robots.txt を1度だけ読む。読めない店は「断られていない」扱い。

    実測では455店のうち95店が robots.txt を置いていない（404 / HTMLが返る /
    そもそも繋がらない）。置いていないことを「断り」と読むと、その95店が
    まるごと図鑑から消える。無いものは無いとして通す。

    その代わり、一時的に取れなかっただけの店も通ってしまう。実測でそうなった
    ——監査では断っていた Puchero が、巡回のときだけ robots.txt が
    ConnectError で届かず、素通りした。区別する手立ては無いので、せめて
    他の取得と同じ回数だけ粘る。粘っても駄目なら通す（方針は変えない）。
    """
    org = origin_of(url)
    if not org or org in _ROBOTS:
        return
    _ROBOTS[org] = []                     # 取れなくても2度は叩かない
    resp, _ = await _get_with_retry(client, f"{org}/robots.txt", {})
    if resp is None or resp.status_code != 200:
        return
    txt = resp.text
    if "<html" in txt[:400].lower():      # robots.txt が無く404ページが返る店
        return
    _ROBOTS[org] = robots_rules(txt)


async def _get(client, url: str, params: dict | None = None):
    """robots.txt を見てから取りに行く。断られていれば None。

    店を叩く入口はこの1つに絞る。判定を呼ぶ側に書き足す形にすると、書き忘れた
    経路だけが断りを踏み続ける。実測でそうなった——_get_with_retry にだけ
    入れたところ、meta.json / cart.js / sitemap / 商品ページの4経路が
    素通りしていた。
    """
    if not path_allowed(url):
        org = origin_of(url)
        _REFUSED[org] = _REFUSED.get(org, 0) + 1
        return None
    return await client.get(url, params=params)


async def _get_with_retry(client: httpx.AsyncClient, url: str, params: dict,
                          retries: int = 0) -> tuple[httpx.Response | None, str]:
    if not path_allowed(url):
        org = origin_of(url)
        _REFUSED[org] = _REFUSED.get(org, 0) + 1
        return None, "robots.txt で断られている"
    resp, why = None, "接続失敗"
    for attempt in range(retries or RETRIES):
        try:
            resp = await client.get(url, params=params)
        except httpx.HTTPError as e:
            why = type(e).__name__
            resp = None
            wait = 2.0 * (2 ** attempt)
        else:
            if resp.status_code in (200, 404):
                return resp, f"HTTP {resp.status_code}"
            why = f"HTTP {resp.status_code}"
            if resp.status_code == 429:
                try:
                    wait = float(resp.headers.get("retry-after", ""))
                except ValueError:
                    wait = 0.0
                if wait <= 0 or wait > 10:
                    return resp, why     # IP制限。待っても無駄なので即あきらめる
            else:
                wait = 2.0 * (2 ** attempt)
        if attempt < retries - 1:
            await asyncio.sleep(min(wait, 10.0) + random.uniform(0, 0.5))
    return resp, why


# ---------------- Shopify ----------------

# Shopify は「要求元の市場」に合わせた通貨で値段を返す（presentment currency）。
# GitHub の runner は米国にあるため、日本や北欧の店でもドル建てで返ってくる。
# ところが /products.json には通貨がどこにも書かれておらず、設定ファイルの現地通貨を
# そのまま貼っていたので、¥1,690 の豆が「¥11」($11) になっていた。実測:
#
#   店         既定の price   /cart.js   /meta.json   ?currency=現地
#   Onibus         11.00        USD        JPY          1690 JPY
#   Goodman        27.97        USD        JPY          4320 JPY
#   Drop           25.00        USD        SEK        230.00 SEK
#   Standout      101.00        USD        SEK       1199.00 SEK
#
# ?currency= を付ければ店が実際につけている値段が返る。ドル換算値ではなく
# 買う人が払う額なので、そちらを取る。
_SHOP_CUR: dict[str, tuple[str, str]] = {}   # base -> (home, presentment)
# 店の所在地。/meta.json は通貨と一緒に city / province も返すので、同じ応答から取る。
SHOP_PLACE: dict[str, dict] = {}            # base -> {city, province, country}


async def _shop_currencies(client: httpx.AsyncClient, base: str) -> tuple[str, str]:
    """(店の本来の通貨, いまの接続で返ってくる通貨)。分からない側は空文字。"""
    if base in _SHOP_CUR:
        return _SHOP_CUR[base]
    home = presentment = ""
    try:
        resp = await _get(client, f"{base}/meta.json")
        if resp is not None and resp.status_code == 200:
            meta = resp.json()
            home = (meta.get("currency") or "").upper()
            SHOP_PLACE[base] = {
                "city": (meta.get("city") or "").strip(),
                "province": (meta.get("province") or "").strip(),
                "country": (meta.get("country") or "").strip(),
            }
    except (httpx.HTTPError, json.JSONDecodeError, AttributeError, ValueError):
        pass
    try:
        resp = await _get(client, f"{base}/cart.js")
        if resp is not None and resp.status_code == 200:
            presentment = (resp.json().get("currency") or "").upper()
    except (httpx.HTTPError, json.JSONDecodeError, AttributeError, ValueError):
        pass
    _SHOP_CUR[base] = (home, presentment)
    return home, presentment


def _first_price(payload: dict) -> str:
    """先頭商品の先頭バリアントの値段。?currency= が効いたかの判定に使う。"""
    prods = payload.get("products") or []
    if not prods:
        return ""
    variants = prods[0].get("variants") or []
    return str(variants[0].get("price")) if variants else ""


# 店が product_type / tags に書いている「種類」を読む。
#
# 前は ("gear", "equipment", "merch", "mug", "gift card", "apparel", "subscription")
# の7語としか照合していなかった。店は自分で何を売っているか書いてくれているのに、
# こちらが聞いていなかったので、次のものが素通りしていた（runner で実測）:
#   Four Barrel の絵画9点 … product_type "Arts & Entertainment"（96"x96" Mixed media on panel）
#   Tiong Hoe のマシン    … product_type "Espresso Machine"（売主 Dalla Corte）
#   Joe Coffee の講座2件  … tags "Classes"（16-hour, 3-day intensive）
#
# ■ 順番が大事
#
# 種類に「コーヒー」と書いてあるなら、まずコーヒー側に置く。
# 落とす語を先に見ると、本物の豆を巻き込む:
#   "Coffee & Tea"       … tea を含むが、これはコーヒーも売る棚
#   "Food, Beverages & Tobacco > Beverages > Coffee"
#                        … Shopify の標準分類。food も beverage も含むが中身は豆
# そのうえで「コーヒー用の道具」を外す:
#   "Coffee Accessories" "Espresso Machine" "Coffee Grinder"

# 単独で来たら豆の棚。焙煎の度合いや用途の呼び名で、器具の意味では使われない。
# "Filter" は「フィルター用の焙煎」で豆（52件）、"Filters" は紙（15件）。
# 単数と複数で意味が変わるので、ここは完全一致で持つ。
_COFFEE_EXACT = {
    "coffee", "filter", "espresso", "beans", "whole bean", "single origin",
    "omniroast", "café", "cafe", "コーヒー", "コーヒー豆", "咖啡",
}
# コーヒーそのものを指す語。これがあれば、まずコーヒーとみなす。
# "filter" "drip" を単独で入れてはいけない（"Filters" "Drippers" が通ってしまう）。
_COFFEE_WORD = ("coffee", "bean", "espresso", "roast", "single origin", "blend",
                "filter coffee", "drip coffee", "drip bag", "cascara",
                "コーヒー", "珈琲", "咖啡", "ドリップバッグ")
# コーヒーの語があっても落とすもの（コーヒー用の道具・催し・読み物）。
# 各国語の呼び方も入れる（実データで通り抜けていたもの）:
#   Cursos = 講座 / Equipamiento = 器具 / グッズ / Logoware = ロゴ入り雑貨
_HARD_NOT_COFFEE = (
    "machine", "grinder", "brewer", "brewing", "maker", "dripper", "filters",
    "accessor", "equipment", "equipments", "equipamiento", "equipo", "gear", "hardware",
    "merch", "apparel", "clothing", "logoware", "mug", "drinkware", "glassware",
    "tableware", "supplies", "supply", "reusable", "kettle", "scale", "tool",
    "gift card", "subscription", "class", "course", "curso", "workshop", "training",
    "ticket", "book", "art", "poster", "cleaning", "maintenance",
    "グッズ", "雑貨", "器具", "objetos", "moccamaster",
)
# コーヒーの語が無いときだけ落とすもの
_SOFT_NOT_COFFEE = (
    "arts & entertainment", "arts and entertainment", "artwork",
    "tea", "chocolate", "candy", "bakery", "food", "beverage", "snack",
    "home & garden", "homeware", "kitchen", "furniture", "event", "フード",
)
# タグ側。種類が空でも、ここに書いてある店がある（Joe Coffee の "Classes" がそれ）。
# 完全一致で見る。"art" を部分一致にすると "artisan" のような語に当たる。
_NOT_COFFEE_TAG = ("classes", "class", "workshop", "training", "artwork", "art",
                   "merch", "equipment", "hardware", "machines")


def shop_denies_hard(p: dict) -> bool:
    """店が「これはコーヒーではない」とはっきり書いているか。

    _HARD_NOT_COFFEE と _NOT_COFFEE_TAG だけを見る。器具・雑貨・講座・書籍の
    たぐいで、豆がこの種類に置かれることはまず無い。

    _SOFT_NOT_COFFEE（tea / food / beverage / chocolate …）は見ない。
    店によっては豆をそこに置く。強い否定と弱い否定を混ぜると豆を巻き添えにする。

    店の申告は言語に依らない。こちらが「濾杯」も「aansteker」も知らなくても、
    店が Equipment と書いていれば分かる。
    """
    ptype = (p.get("product_type") or "").strip().lower()
    tags = p.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",")]
    if {str(t).strip().lower() for t in tags} & set(_NOT_COFFEE_TAG):
        return True
    return bool(ptype) and any(x in ptype for x in _HARD_NOT_COFFEE)


def shop_says(p: dict) -> str:
    """店の申告を1文字で返す。

      "c"  コーヒーだと書いてある（product_type / tags）
      "x"  コーヒーでないと書いてある
      ""   何も書いていない

    店の申告は「コーヒーでない」ことの証明には強いが、「これは豆だ」ことの
    証明には弱い。"Coffee" にはカプセルもギフト箱も粉も入るため。
    だから "c" は「落としてよい」ではなく「名前から当てるのをやめてよい」の合図。
    """
    ptype = (p.get("product_type") or "").strip().lower()
    tags = p.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",")]
    low = {str(t).strip().lower() for t in tags}
    if low & set(_NOT_COFFEE_TAG):
        return "x"
    if not ptype:
        return ""
    if ptype in _COFFEE_EXACT:
        return "c"
    if any(x in ptype for x in _HARD_NOT_COFFEE):
        return "x"
    if any(w in ptype for w in _COFFEE_WORD):
        return "c"
    if any(x in ptype for x in _SOFT_NOT_COFFEE):
        return "x"
    return ""


# 袋らしい重さの範囲。豆の袋は 250g / 500g / 1kg で、包装ぶんを足しても
# だいたいこの中に収まる。出荷重量は本来あてにならない（実測で86%の商品に
# 値が入っている）ので、店の申告が使えないときの最後の手段としてだけ使う。
BAG_GRAMS = (150, 1500)


def has_bean_evidence(p: dict, shop_writes_type: bool = True) -> bool:
    """豆である証拠がひとつでもあるか。無ければ取り込まない。

    これが「足し算」の門。豆でないものの名前を数えるのをやめて、
    豆である証拠のあるものだけを通す。

    ■ なぜ引き算をやめたのか

    「豆でないものを外す」やり方は、外す語を各国語ぶん書き続けることになる。
    英語と日本語だけ書いていた時期に台湾の濾杯と膠囊が並び、語を広げると
    今度は本物の豆（Mwendi Wega・キッサブレンド・Coffee & Tea）を巻き添えにした。
    店が増えるたび、言語が増えるたびに漏れる。終わりが無い。

    証拠を数えるやり方なら、まだ見たことのない言語の雑貨でも黙って落ちる。
    ノルウェー語の水筒に産地も精製も品種も内容量も書かれていないからで、
    「水筒」という語をこちらが知っている必要は無い。

    ■ 通す条件（実データ5260件で6つの案を比べて選んだ）

      商品名かタグに強い証拠がひとつでもある      … または
      店が product_type に「コーヒー」と書いている

    厳しい案（証拠2つ以上）も試したが、店が自分でコーヒーだと書いている商品を
    739件も落とした。中に「オニバスブレンド」「シティローストブレンド」
    「Seasonal Blend [200g]」のような本物の豆が混ざっていた。
    落ちた豆は画面に出ないので、間違えても誰も気づけない。だから緩い側に寄せた。
    この条件だと、店の申告がある商品はひとつも落ちない（実測0件）。

    ■ ここで全部を決めようとしないこと

    この門は「証拠が無い物」を止めるだけで、証拠がある物の中身までは見ない。
    実測では "Origin Series Poster | Rwanda"（産地の語がある）や
    "Earl Grey 1kg"（内容量がある）も通ってしまう。
    それは名前を知っていれば外せるものなので、これまでどおり後段の
    _looks_like_coffee と表示側の isCoffeeBean が受け持つ。
    門は、名前を知りようがないものだけを担当する。
    """
    # 店が「これはコーヒーではない」とはっきり書いているなら、名前に何が
    # 書いてあっても取らない。名前だけでは見分けがつかない物が実在する。
    # 実測（2026-08、応答した店の2382件）:
    #
    #   店が否定しているのに通っていた            128件（5.4%）
    #     merchandise 40 / accessories 12 / subscription 9 / equipment 9 …
    #   そのうち強い証拠が2つ以上ある物             7件
    #     Archers Washed Geisha Club Cap（帽子）、Sencha Tea、蜂蜜、定期便 …
    #
    # "Archers Washed Geisha Club Cap" は Washed も Geisha も入っているので
    # 名前では豆と区別できない。店の申告なら言語に依らず分かる。
    #
    # 代償: 7件のうち "George Howell / San Martin, Guatemala" だけは本物の
    # 豆に見える。店が種類を書き間違えている店では、こうして豆が落ちる。
    # 128件を止めて豆1件を巻き添えにする勘定で、そちらを採った。
    if shop_denies_hard(p):
        return False

    tags = p.get("tags") or []
    tagtext = " ".join(tags) if isinstance(tags, list) else str(tags)
    opts = option_text(p)
    # 規格名は全部見る。1つめが "Default Title" で、2つめから "250g" の店がある。
    grams_title = _grams_from_text(f"{p.get('title', '')} {opts}")
    # 説明文と出荷重量は見ない。器具の説明文にも産地は出るし、Shopify の重量欄は
    # 実測 86% の商品に値が入っていて何も分けられなかった（マグにも T シャツにもある）。
    m = bean_markers(title=f"{p.get('title', '')} {tagtext}", body="",
                     grams_field=0, grams_title=grams_title, kind=shop_says(p),
                     options=opts)
    if bool(m & set(STRONG)) or "c" in m:
        return True

    # 商品の種類を1つも書かない店では、店の申告という証拠が最初から使えない。
    # そこだけは出荷重量を最後の手がかりにする。実測44軒中1軒（Tim Wendelboe）で、
    # 銘柄名だけの豆 "Kapsokisio"（ウガンダ）がこれで拾える。
    # この店のTシャツやギフトカードも通ってしまうが、それは名前で外せるものなので
    # 後段に任せる（落ちることは確かめた）。豆を落とす方が取り返しがつかない。
    if not shop_writes_type:
        ship = int((p.get("variants") or [{}])[0].get("grams") or 0)
        return BAG_GRAMS[0] <= ship <= BAG_GRAMS[1]
    return False


def _looks_like_coffee(p: dict) -> bool:
    """店が書いた種類とタグを見て、豆かどうかを決める。

    店の申告を信じる。こちらで名前から推し量るより確かで、言語にも左右されない
    （中国語の店でも product_type は英語のことが多い）。
    何も書かれていなければ通す。分からないものを落とすと本物の豆が消える。

    見る順番:
      1. 完全一致で豆の棚と分かるもの（"Filter" など）は、そこで通す
      2. 道具・催し・読み物なら落とす（"Espresso Machine" "Coffee Course"）
      3. コーヒーの語があれば通す（"Coffee & Tea" "… > Beverages > Coffee"）
      4. 食品・雑貨なら落とす（"Tea" "Chocolate"）
      5. どれでもなければ通す（"Archive" "Retail" のような棚の名前）
    """
    ptype = (p.get("product_type") or "").strip().lower()
    if ptype and ptype not in _COFFEE_EXACT:
        if any(x in ptype for x in _HARD_NOT_COFFEE):
            return False
        if not any(w in ptype for w in _COFFEE_WORD) and \
                any(x in ptype for x in _SOFT_NOT_COFFEE):
            return False

    tags = p.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",")]
    if {str(t).strip().lower() for t in tags} & set(_NOT_COFFEE_TAG):
        return False
    return True


async def _fetch_shopify(client: httpx.AsyncClient, r: dict, max_pages: int) -> list[Product] | None:
    res = await _fetch_shopify_path(client, r, max_pages, "/products.json")
    if res:
        return res
    # 404（この経路が無い店）のときだけ別経路を試す。
    # 429はレート制限なので、ここで追撃すると悪化させるだけ＝再試行しない。
    # 404（この経路が無い店）に加えて、401/403（この経路だけ閉じている店）でも
    # 別経路を試す。実測: Sample Coffee は /products.json が403、Kaffitár は401 で、
    # そこで打ち切っていたためAtomフィードを一度も見ていなかった。
    # 429 はレート制限なので、ここで追撃すると悪化させるだけ＝再試行しない。
    if not any(c in LAST_REASON.get(r["name"], "") for c in ("404", "401", "403")):
        return None
    # 店によって商品APIの位置が違う。多言語サイトはロケール配下、
    # 商品APIを閉じている店でもAtomフィードは開いていることがある。
    for path in ("/collections/all/products.json", "/en/products.json", "/ja/products.json"):
        res = await _fetch_shopify_path(client, r, max_pages, path)
        if res:
            return res
    return await _fetch_shopify_atom(client, r)


# Shopifyは /collections/all.atom で商品一覧をAtomフィードとしても公開している。
# products.json を塞いでいる店でも、こちらは開いている場合がある。
async def _fetch_shopify_atom(client: httpx.AsyncClient, r: dict) -> list[Product] | None:
    base = r["url"].rstrip("/")
    resp, why = await _get_with_retry(client, f"{base}/collections/all.atom", {})
    if resp is None or resp.status_code != 200 or "<entry" not in resp.text:
        if resp is not None and resp.status_code == 200:
            why = "Atomフィードではない応答"
        LAST_REASON[r["name"]] = f"/collections/all.atom → {why}"
        return None
    products: list[Product] = []
    for m in re.finditer(r"<entry>(.*?)</entry>", resp.text, re.S):
        e = m.group(1)
        title = re.search(r"<title>(.*?)</title>", e, re.S)
        link = re.search(r'<link[^>]*href="([^"]+)"', e)
        price = re.search(r'<s:price[^>]*>([\d.]+)</s:price>', e)
        cur = re.search(r'<s:price[^>]*currency="([^"]+)"', e)
        img = re.search(r'<img src="([^"]+)"', e)
        if not title:
            continue
        name = html.unescape(re.sub(r"<[^>]+>", "", title.group(1))).strip()
        url = link.group(1) if link else base
        # Atomの <summary> は商品説明そのもの。products.json を閉じている店の
        # ノートはここしか出所が無いので、JSON経路と同じように読む。
        summary = re.search(r"(?is)<summary[^>]*>(.*?)</summary>", e)
        body = html.unescape(summary.group(1)) if summary else ""
        notes, note_src = extract_notes_src(body, name)
        text = f"{name} {re.sub(r'<[^>]+>', ' ', e)}"
        deep = f"{text} {html_to_text(body)[:DEEP_CHARS]}"
        grams = _grams_from_text(name)
        p = float(price.group(1)) if price else 0.0
        products.append(Product(
            key=f"{r['name']}::{url.rsplit('/', 1)[-1]}",
            roaster=r["name"], country=r.get("country", ""), title=name, url=url,
            image=(img.group(1) if img else ""), price=p,
            currency=(cur.group(1) if cur else r.get("currency", "")),
            grams=grams, per100=round(p / grams * 100, 2) if grams and p else None,
            available=True,          # Atomは在庫切れを載せないため、掲載＝在庫ありとみなす
            origin=_guess_origin(text) or _guess_origin(deep),
            process=_guess_process(text) or _guess_process(deep),
            tags=name[:300], notes=notes, note_src=note_src,
        ))
    return products or None


async def _fetch_shopify_path(client: httpx.AsyncClient, r: dict, max_pages: int,
                              path: str) -> list[Product] | None:
    base = r["url"].rstrip("/")
    # 値段より先に通貨を決める。設定ファイルの現地通貨は当てにしない。
    home, presentment = await _shop_currencies(client, base)
    currency = home or presentment or r.get("currency", "")
    place = SHOP_PLACE.get(base, {})
    # 表示通貨が現地と違うときだけ、現地建てで取り直す。
    # 店が ?currency= を無視することもあるので、効いたかどうかを確かめてから採用する。
    # 判定には1ページ目の応答をそのまま使う（確認のためだけの往復を増やさない）。
    ask = {}
    if home and presentment and home != presentment:
        plain, _ = await _get_with_retry(client, f"{base}{path}", {"limit": 1})
        asked, _ = await _get_with_retry(client, f"{base}{path}",
                                         {"limit": 1, "currency": home})
        try:
            if (plain is not None and asked is not None
                    and plain.status_code == 200 and asked.status_code == 200
                    and _first_price(plain.json()) != _first_price(asked.json())):
                ask = {"currency": home}          # 効いた。現地建てで取る
            else:
                currency = presentment            # 無視された。返ってくる通貨で名乗る
        except json.JSONDecodeError:
            currency = presentment
    # まず全ページを集める。門の判断に「その店が商品の種類を書く店かどうか」が
    # 要るので、1商品ずつ即断できない。種類を1ページ目には書かず2ページ目から
    # 書く店があっても取り違えないよう、全部そろえてから判断する。
    raw: list[dict] = []
    for page in range(1, max_pages + 1):
        resp, why = await _get_with_retry(client, f"{base}{path}",
                                          {"limit": 250, "page": page, **ask})
        if resp is None or resp.status_code != 200:
            if page == 1:
                LAST_REASON[r["name"]] = f"{path} → {why}"
                return None
            break
        try:
            batch = resp.json().get("products", [])
        except json.JSONDecodeError:
            if page == 1:
                LAST_REASON[r["name"]] = f"{path} → JSONではない応答"
                return None
            break
        if not batch:
            break
        raw.extend(batch)
        if len(batch) < 250:
            break

    # 商品の種類を1つも書かない店では、店の申告に頼れない。
    # 実測では44軒中1軒（Tim Wendelboe）。そこでは門が不当に厳しくなり、
    # 銘柄名だけの豆（Kapsokisio）が証拠なしとして落ちていた。
    shop_writes_type = any((p.get("product_type") or "").strip() for p in raw)

    products: list[Product] = []
    no_evidence = 0          # 豆である証拠が無くて取らなかった数。ログに出す
    for p in raw:
        # 1. 豆である証拠が無いものは取らない（足し算の門）。
        #    ここで落ちるのは、こちらが名前を知らない雑貨・器具。
        if not has_bean_evidence(p, shop_writes_type=shop_writes_type):
            no_evidence += 1
            continue
        # 2. 店が自分で「豆ではない」と書いているものを外す（引き算）。
        #    証拠はあるが豆ではないもの（講座・器具）はここで落ちる。
        if not _looks_like_coffee(p):
            continue
        variants = p.get("variants", [])
        if not variants:
            continue
        avail_vs = [v for v in variants if v.get("available")]
        v = avail_vs[0] if avail_vs else variants[0]
        try:
            price = float(v.get("price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        grams = int(v.get("grams") or 0) or _grams_from_text(
            f"{v.get('title','')} {p.get('title','')}")
        per100 = round(price / grams * 100, 2) if grams and price else None
        tagtext = (" ".join(p.get("tags", [])) if isinstance(p.get("tags"), list)
                   else str(p.get("tags", "")))
        text = " ".join([p.get("title", ""), tagtext])
        # 産地・精製・風味は説明文にしか書かれていないことが多い。
        # タイトル/タグで決まらない分をここで補う（味わいマップの入力になる）
        body = p.get("body_html") or ""
        notes, note_src = extract_notes_src(body, p.get("title", ""))
        deep = " ".join([text, html_to_text(body)[:DEEP_CHARS]])
        images = p.get("images") or []
        products.append(Product(
            key=f"{r['name']}::{p.get('handle','')}",
            roaster=r["name"], country=r.get("country", ""),
            title=p.get("title", "").strip(),
            url=f"{base}/products/{p.get('handle','')}",
            image=(images[0].get("src", "") if images else ""),
            price=price, currency=currency,
            grams=grams, per100=per100,
            available=bool(avail_vs),
            origin=_guess_origin(text) or _guess_origin(deep),
            process=_guess_process(text) or _guess_process(deep),
            tags=text[:300], notes=notes, note_src=note_src, kind=shop_says(p),
            city=place.get("city", ""), province=place.get("province", ""),
        ))
    # 門で落とした数を残す。取れた数だけ見ていると「落としすぎ」に気づけない。
    # 落ちた物は画面に出ないので、この数字が唯一の手がかりになる。
    if no_evidence:
        LAST_DROPPED[r["name"]] = no_evidence
    return products


# ---------------- WooCommerce ----------------

async def _fetch_woo(client: httpx.AsyncClient, r: dict, max_pages: int) -> list[Product] | None:
    base = r["url"].rstrip("/")
    products: list[Product] = []
    for page in range(1, max_pages + 1):
        resp, why = await _get_with_retry(client, f"{base}/wp-json/wc/store/v1/products",
                                         {"per_page": 100, "page": page})
        if resp is None or resp.status_code != 200:
            if page == 1:
                # auto判定ではShopifyを先に試している。先に出た理由のほうが
                # 店の素性を表すので、上書きせず埋まっていないときだけ入れる。
                LAST_REASON.setdefault(r["name"],
                                       f"/wp-json/wc/store/v1/products → {why}")
                return None
            return products
        try:
            batch = resp.json()
        except json.JSONDecodeError:
            return None if page == 1 else products
        if not isinstance(batch, list) or not batch:
            break
        for p in batch:
            prices = p.get("prices") or {}
            minor = int(prices.get("currency_minor_unit", 2))
            try:
                price = float(prices.get("price") or 0) / (10 ** minor)
            except (TypeError, ValueError):
                price = 0.0
            title = re.sub(r"<[^>]+>", "", p.get("name", "")).strip()
            grams = _grams_from_text(title)
            per100 = round(price / grams * 100, 2) if grams and price else None
            body = f"{p.get('short_description') or ''}\n{p.get('description') or ''}"
            notes, note_src = extract_notes_src(body, title)
            deep = f"{title} {html_to_text(body)[:DEEP_CHARS]}"
            products.append(Product(
                key=f"{r['name']}::{p.get('id')}",
                roaster=r["name"], country=r.get("country", ""),
                title=title,
                url=p.get("permalink", base),
                image=(p.get("images", [{}])[0].get("src", "") if p.get("images") else ""),
                price=price,
                currency=prices.get("currency_code") or r.get("currency", ""),
                grams=grams, per100=per100,
                available=bool(p.get("is_in_stock", True)),
                origin=_guess_origin(title) or _guess_origin(deep),
                process=_guess_process(title) or _guess_process(deep),
                tags=title, notes=notes, note_src=note_src,
            ))
        if len(batch) < 100:
            break
    return products


# ---------------- どのECでも使える経路（sitemap + JSON-LD） ----------------

# 436軒のうち176軒は豆が1件も出ていなかった。全て巡回の失敗で、理由の大半は
# 「Shopify でも WooCommerce でもない」＝BASE / STORES / Squarespace / Wix など。
# ECごとに対応を書くと店の数だけ手間がかかるので、ECを問わず共通の2つを使う:
#   * sitemap.xml   商品ページのURL一覧。ほぼ全てのECが出している
#   * JSON-LD の Product  商品名・価格・在庫。Google の商品検索に載せるため
#                          各社が出力していて、書式が決まっている
# 商品ページを1枚ずつ開くので、店あたりの上限を決めて相手に負担をかけない。
MAX_GENERIC_PRODUCTS = 40
_SITEMAPS = ("/sitemap.xml", "/sitemap_index.xml", "/sitemap_products_1.xml")
_LOC = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>")
_LD_BLOCK = re.compile(r'(?is)<script[^>]+application/ld\+json[^>]*>(.*?)</script>')
# 商品ページらしいURL。一覧・カート・アカウント等は除く
_PROD_URL = re.compile(r"(?i)/(?:products?|items?|goods|shop)/[^/?#]+/?$")
_SKIP_URL = re.compile(r"(?i)/(cart|account|login|search|blogs?|pages?|policies|collections)/")


def _ld_products(html: str) -> list[dict]:
    """ページ内の JSON-LD から Product だけを取り出す。"""
    out = []
    for block in _LD_BLOCK.findall(html or ""):
        try:
            data = json.loads(block.strip())
        except (json.JSONDecodeError, ValueError):
            continue
        # @graph でまとめている店、配列で並べている店の両方がある
        items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for it in items if isinstance(items, list) else []:
            if isinstance(it, dict) and "product" in str(it.get("@type", "")).lower():
                out.append(it)
    return out


def _ld_offer(prod: dict) -> dict:
    """offers は単体・配列・AggregateOffer の3通りある。1つに均す。"""
    off = prod.get("offers") or {}
    if isinstance(off, list):
        off = off[0] if off else {}
    if not isinstance(off, dict):
        return {}
    if str(off.get("@type", "")).lower() == "aggregateoffer":
        return {"price": off.get("lowPrice") or off.get("price") or "",
                "priceCurrency": off.get("priceCurrency", ""),
                "availability": off.get("availability", "")}
    return off


async def _sitemap_product_urls(client: httpx.AsyncClient, base: str) -> list[str]:
    """sitemap をたどって商品ページのURLを集める。"""
    seen: set[str] = set()
    urls: list[str] = []
    queue = [f"{base}{p}" for p in _SITEMAPS]
    depth = 0
    while queue and depth < 12 and len(urls) < MAX_GENERIC_PRODUCTS * 3:
        target = queue.pop(0)
        depth += 1
        try:
            resp = await _get(client, target)
        except httpx.HTTPError:
            continue
        if resp is None or resp.status_code != 200 or "<loc" not in resp.text:
            continue
        for raw in _LOC.findall(resp.text):
            # sitemap の <loc> は仕様上は絶対URLだが、相対パスを書いている店がある。
            # そのまま httpx に渡すと ValueError で落ち、httpx.HTTPError では
            # 捕まらないので巡回そのものが止まる（実測: 34店ぶんの結果が
            # "/products/compostable-coffee-capsules-fivr" 1つで消えた）。
            loc = urljoin(target, raw.strip())
            if not loc.startswith(("http://", "https://")):
                continue
            if loc in seen:
                continue
            seen.add(loc)
            if loc.endswith(".xml"):
                # 商品の sitemap だけ追う。記事やページの一覧まで開くと無駄が多い
                if re.search(r"(?i)product|item|shop|goods", loc):
                    queue.append(loc)
            elif _PROD_URL.search(loc) and not _SKIP_URL.search(loc):
                urls.append(loc)
    return urls[:MAX_GENERIC_PRODUCTS]


def _product_from_ld(r: dict, url: str, html: str) -> Product | None:
    """商品ページ1枚から Product を1つ作る。作れなければ None。"""
    lds = _ld_products(html)
    if not lds:
        return None
    ld = lds[0]
    title = str(ld.get("name") or "").strip()
    if not title:
        return None
    offer = _ld_offer(ld)
    try:
        price = float(str(offer.get("price") or 0).replace(",", ""))
    except (TypeError, ValueError):
        price = 0.0
    image = ld.get("image")
    if isinstance(image, list):
        image = image[0] if image else ""
    if isinstance(image, dict):
        image = image.get("url", "")
    desc = str(ld.get("description") or "")
    avail = str(offer.get("availability") or "").lower()
    grams = _grams_from_text(title) or _grams_from_text(desc)
    deep = f"{title} {html_to_text(desc)[:DEEP_CHARS]}"
    _gen_notes = extract_notes_src(desc, title)
    return Product(
        key=f"{r['name']}::{url.rstrip('/').rsplit('/', 1)[-1]}",
        roaster=r["name"], country=r.get("country", ""),
        title=title, url=url, image=str(image or ""),
        price=price, currency=(offer.get("priceCurrency") or r.get("currency", "")).upper(),
        grams=grams, per100=round(price / grams * 100, 2) if grams and price else None,
        # 在庫の記載が無い店は「売っている」とみなす。載っている＝買えるページなので
        available=("outofstock" not in avail.replace(" ", "") and "soldout" not in avail.replace(" ", "")),
        origin=_guess_origin(title) or _guess_origin(deep),
        process=_guess_process(title) or _guess_process(deep),
        tags=title[:300], notes=_gen_notes[0], note_src=_gen_notes[1],
    )


async def _fetch_generic(client: httpx.AsyncClient, r: dict) -> list[Product] | None:
    base = r["url"].rstrip("/")
    urls = await _sitemap_product_urls(client, base)
    # 最後に試した経路の結果で上書きする。setdefault だと Shopify の理由が
    # 残り続け、ログを見ても共通経路がどこで駄目だったのか分からなかった。
    if not urls:
        LAST_REASON[r["name"]] = "sitemapに商品ページが無い"
        return None
    products: list[Product] = []
    for u in urls:
        try:
            resp = await _get(client, u)
        except httpx.HTTPError:
            continue
        if resp is None or resp.status_code != 200:
            continue
        p = _product_from_ld(r, u, resp.text)
        if p:
            products.append(p)
    if not products:
        LAST_REASON[r["name"]] = f"商品ページにJSON-LDが無い（{len(urls)}枚見た）"
        return None
    return products


# ---------------- orchestration ----------------

async def _fetch_any(client, r, max_pages) -> list[Product] | None:
    platform = r.get("platform", "auto")
    if platform in ("auto", "shopify"):
        res = await _fetch_shopify(client, r, max_pages)
        if res is not None:
            return res
    if platform in ("auto", "woocommerce"):
        res = await _fetch_woo(client, r, max_pages)
        if res is not None:
            return res
    # 上の2つに当てはまらない店（BASE / STORES / Squarespace 等）はここで拾う
    if platform in ("auto", "generic"):
        res = await _fetch_generic(client, r)
        if res is not None:
            return res
    return None


# 名前解決や接続そのもので落ちた合図。HTTPで応答がある店とは原因が違う。
_CONNECT_FAIL = ("ConnectError", "ConnectTimeout", "接続失敗")


def _alt_host(url: str) -> str:
    """www の有無を入れ替えたURL。無ければ空文字。"""
    m = re.match(r"(https?://)(www\.)?(.+)", url or "")
    if not m:
        return ""
    scheme, has_www, rest = m.groups()
    return f"{scheme}{rest}" if has_www else f"{scheme}www.{rest}"


async def crawl_roaster(client, r, max_pages, sem) -> tuple[dict, list[Product] | None]:
    """1店ぶん。何が起きてもこの店の失敗として返し、外へ例外を出さない。

    数百の他所のサイトを回るので、想定外の作りのデータはいつか必ず来る。
    1店で例外が上がると crawl_all の await がそこで落ち、その回に取れていた
    他の店の結果ごと失われる（実測: 相対URLの sitemap 1店で、34店ぶんが消えた）。
    取れない店は「取れない店」として数え、巡回は最後まで走らせる。
    """
    try:
        return await _crawl_roaster(client, r, max_pages, sem)
    except asyncio.CancelledError:
        raise                       # 打ち切りは握りつぶさない
    except Exception as e:          # noqa: BLE001 — 店ごとに握るのが目的
        LAST_REASON[r["name"]] = f"想定外のエラー: {type(e).__name__}: {e}"[:160]
        return r, None


async def _crawl_roaster(client, r, max_pages, sem) -> tuple[dict, list[Product] | None]:
    async with sem:
        await asyncio.sleep(random.uniform(0.3, 1.2))  # 一斉アクセスを避けて間隔をあける
        await load_robots(client, r["url"])            # 何を取るより先に、断りを読む
        res = await _fetch_any(client, r, max_pages)
        if res is not None:
            return r, res
        # 接続で落ちた店は www 側にしかAレコードが無いことがある。リダイレクトは
        # 追えても名前解決の失敗は追えないので、ここだけ手で入れ替えて1回試す。
        if any(w in LAST_REASON.get(r["name"], "") for w in _CONNECT_FAIL):
            alt = _alt_host(r["url"])
            if alt:
                LAST_REASON.pop(r["name"], None)
                await load_robots(client, alt)   # 別ホストは別の robots.txt
                res = await _fetch_any(client, {**r, "url": alt}, max_pages)
                if res is not None:
                    print(f"  ↻ {r['name']} — {alt} で取得")
                    return r, res
        # 断られた店は、そのあと必ず別の理由で失敗する（sitemap を断られれば
        # 「sitemapに商品ページが無い」）。最後に書かれた理由が残ると、断りが
        # 見えなくなる。断られた回数があるなら、そちらを本当の理由として書く。
        n = sum(_REFUSED.get(origin_of(u), 0)
                for u in (r["url"], _alt_host(r["url"])) if u)
        if n:
            LAST_REASON[r["name"]] = f"robots.txt で断られている（{n}本の道を試さなかった）"
        return r, None


async def crawl_all(config: dict) -> tuple[list[Product], list[str]]:
    s = config.get("settings", {})
    sem = asyncio.Semaphore(int(s.get("concurrency", 8)))
    timeout = httpx.Timeout(float(s.get("timeout_sec", 20)))
    global RETRIES
    RETRIES = max(1, int(s.get("retries", 3)))
    max_pages = int(s.get("max_pages", 4))
    failed: list[str] = []
    all_products: list[Product] = []
    async with httpx.AsyncClient(headers=REQ_HEADERS, timeout=timeout,
                                 follow_redirects=True) as client:
        tasks = [crawl_roaster(client, r, max_pages, sem) for r in config["roasters"]]
        for coro in asyncio.as_completed(tasks):
            r, res = await coro
            if res is None:
                failed.append(r["name"])
                print(f"  ✗ {r['name']} — 取得失敗: {LAST_REASON.get(r['name'], '不明')}")
            else:
                # 落とした数も出す。取れた数だけ見ていると、門が効きすぎて
                # 豆まで落としている店に気づけない（落ちた物は画面に出ない）。
                cut = LAST_DROPPED.get(r["name"], 0)
                note = f"（証拠なしで見送り {cut}件）" if cut else ""
                print(f"  ✓ {r['name']} — {len(res)}件{note}")
                all_products.extend(res)

    # 1件も取れなかったのに大量に見送った店は、門が効きすぎている疑いがある。
    # 名前を挙げておけば、次に見るとき最初にそこを見られる。
    suspects = [n for n, c in LAST_DROPPED.items() if c >= 20
                and not any(p.roaster == n for p in all_products)]
    if suspects:
        print(f"\n  ⚠ 全部見送った店（門が厳しすぎないか要確認）: {', '.join(suspects[:20])}")
    return all_products, failed


def products_to_dicts(products: list[Product]) -> list[dict]:
    return [asdict(p) for p in products]
