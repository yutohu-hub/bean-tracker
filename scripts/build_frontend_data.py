#!/usr/bin/env python3
"""クローラ出力(data/site.json) → フロント用オーバーレイ(frontend/.../live.generated.json)。

手書きの種データ(seed)に、巡回で取得した実データをキー一致で重ねる。
- 種データに同名ロースターがあれば、その key を再利用して「豆だけ」実データに置換
  （店舗のメタ情報=座標/都市/bio は種のまま維持）。
- 種に無い新規ロースターは、メタ情報も生成して追加。
実行タイミングは巡回ワークフロー(track.yml)。ネット不要のテストは:
  python main.py --mock fixtures && python scripts/build_frontend_data.py
"""
from __future__ import annotations
import json
import re
import datetime
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import geocode  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "data" / "site.json"
ROASTER_DIR = ROOT / "frontend" / "components" / "data" / "roasters"
OUT = ROOT / "frontend" / "components" / "data" / "live.generated.json"

STOP = re.compile(r"\b(coffee|roasters?|roastery|roasting|company|co|the|specialty|cafe|café|espresso|works|stand|brewers?|kaffe|koffie)\b")
def norm(s: str) -> str: return re.sub(r"[^a-z0-9]", "", STOP.sub("", (s or "").lower()))
def slug(s: str) -> str: return (re.sub(r"[^a-z0-9]", "", (s or "").lower())[:24] or "roaster")

# --- 豆以外（器具/グッズ/ミルク/ティー/RTD/ドリップバッグ/インスタント/業務用 等）を巡回結果から除外して整理整頓 ---
# フロントの components/lib/isCoffee.js と同じ方針。焙煎/精製の表記や "Cup of Excellence" は残す。
_NONCOFFEE = re.compile("|".join([
    r"subscription", r"定期便", r"頒布会",
    r"gift\s?card", r"ギフトカード", r"\bvoucher\b", r"gift\s?set", r"e-?gift", r"karta\s?podarunkowa",
    r"t-?shirt", r"\btee\b", r"tシャツ", r"hoodie", r"パーカー", r"sweatshirt", r"crewneck", r"\bbeanie\b", r"\bsocks\b", r"\btote\b", r"apron", r"エプロン", r"keychain", r"\bstickers?\b", r"ステッカー", r"\bcaps?\b", r"\bhat\b", r"\bshirts?\b", r"\bpants\b", r"\btrousers\b", r"\bjacket\b", r"\bsweater\b", r"\bbandana\b", r"\bshoes\b", r"incen[cs]e", r"お香",
    r"\bmugs?\b", r"マグカップ", r"tumbler", r"タンブラー", r"\bglass(es)?\b", r"グラス", r"\bbottle\b", r"ボトル", r"flask", r"thermos", r"carafe", r"カラフェ", r"decanter", r"demitasse", r"\bcup\b", r"カップ",
    r"grinder", r"グラインダー", r"coffee\s?mill", r"dripper", r"ドリッパー", r"\bv-?60\b", r"kalita", r"カリタ", r"chemex", r"\bkono\b", r"hario", r"ハリオ", r"aeropress", r"french\s?press", r"moka\s?pot", r"kettle", r"ケトル", r"gooseneck", r"\bscale\b", r"スケール", r"\bserver\b", r"サーバー", r"\bbrewer\b", r"paper\s?filter", r"filter\s?paper", r"ペーパーフィルター", r"canister", r"tamper", r"portafilter", r"\bspoon\b", r"\bscoop\b", r"\bbasket\b", r"\bjug\b", r"\bbrush\b", r"\blid\b", r"\bstraw\b", r"\bholder\b", r"\breplacement\b", r"flannel", r"ネル", r"sibarist", r"\borea\b", r"flo\s?screen", r"cera\s?filter", r"wave\s?filters?", r"deodorizer", r"消臭", r"\bcutter\b", r"stainless\s?steel", r"zebrang",
    r"fellow\s?(aiden|tally|atmos|stagg|ode|opus|clara|carter|prismo)", r"acaia\s?(pearl|lunar|pyxis)", r"comandante", r"timemore", r"1zpresso", r"moccamaster", r"wilfa", r"baratza", r"wacaco", r"picopresso", r"breville", r"gaggia", r"xbloom", r"la\s?marzocco", r"coffee\s?maker", r"espresso\s?machine", r"\bkinto\b", r"\bceado\b", r"\bfetco\b",
    r"\bbrew(ing)?\s?kit", r"starter\s?kit", r"repair\s?kit", r"kintsugi", r"descal", r"cafiza", r"cleaning", r"\bwhisk\b", r"matcha", r"抹茶",
    r"\btea\b", r"ティー", r"紅茶", r"\bchai\b", r"rooibos", r"oolong", r"\bsencha\b", r"hojicha", r"kombucha",
    r"gift\s?box", r"tasting\s?box", r"sample\s?box", r"discovery\s?box", r"assort", r"box\s?set", r"box\sof\s\d+", r"advent",
    r"\bcanned\b", r"mini\s?can\b", r"can\s?chiller", r"\bchiller\b", r"\bmiir\b", r"iced\s?latte", r"\brtd\b",
    r"drip\s?bags?", r"ドリップバッグ", r"drip\s?pack", r"dripkit",
    r"cold\s?brew", r"コールドブリュー", r"水出し", r"\binstant\b", r"インスタント", r"freeze\s?dried",
    r"drinking\s?chocolate", r"chocolate\s?bar", r"\braaka\b", r"cupcakes?", r"strudel", r"waffle\s?cone", r"soft\s?bar", r"croissant",
    r"\bsyrup\b", r"シロップ", r"\bposter\b", r"\bjournal\b", r"\bpuzzles?\b", r"\bmineral\b", r"\bstrap\b", r"orbitkey", r"key\s?organi[sz]er",
    r"\bbook\b", r"書籍", r"写真集", r"magazine", r"\bzine\b", r"invoice", r"overdue", r"\btraining\b", r"latte\s?art", r"ceramics?", r"handmade", r"g-?shock", r"\btimex\b",
    r"the\sbusiness\sof\sspecialty", r"barista\shustle",
    r"\bwholesale\b", r"卸", r"業務用", r"バルク", r"\bbulk\b", r"coffee\s?sacks?", r"\bsack\b",
    # 日本語の非コーヒー（ギフト/セット/焼き菓子など）
    r"ギフト", r"詰め合わせ", r"飲み比べ", r"アソート", r"福袋", r"セット", r"バナナブレッド", r"ブレッド", r"焼き菓子", r"洋菓子", r"和菓子", r"クッキー", r"マフィン", r"スコーン", r"ドーナツ", r"プリン", r"ビスケット", r"グラノーラ", r"カヌレ", r"マドレーヌ", r"フィナンシェ",
    # カプセル・ポッド／抽出用ミネラル／紙フィルター／体験／植物性飲料（いずれも豆ではない）
    # 語の頭に境界を求めると "EcoPod™"・"Inventory_Capsule Box" に当たらず素通りする。
    # 後ろだけを見て、"Podium"・"Podback"・"Augusto" のような別の語を外す。
    # 綴りは店の言語ごとに変わる（西 Cápsulas / 独 Kapsel, Kapseln / 丁 Kapsler）。
    r"c[áa]psulas?", r"capsules?(?![a-z])", r"\bkapse?l(n|er)?(?![a-z])", r"カプセル", r"キャップ式",
    r"pods?(?![a-z])", r"\bk[-\s]?cups?(?![a-z])", r"keurig", r"nespresso", r"ネスプレッソ", r"dolce\s?gusto",
    # 缶（RTDも、豆を缶に詰めたものも）。"I Can Hear the Heart Beating as One" という
    # アルバム名の豆があるので、複数形か、缶が終わり・区切りの直前に来るものだけ拾う。
    r"\bcans\b", r"\bcan\b(?=\s*(?:$|[-–—(]))", r"tin\s?cans?",
    # 生豆。"生豆商Nordic Approach" は生豆を扱う商社の名前が焙煎豆に付いたもの。
    r"raw\s?green\s?coffee", r"green\s?coffee\s?beans?", r"\bgreen coffee\b", r"生豆(?!商)", r"unroasted",
    # 豆はグラムで売る。名前に mL が付くものは器具か液体。
    r"\d+\s?ml\b",
    # ミルクピッチャー等の器具（仏 pichet／蘭 melkkan／西 jarra／独 kanne／氷 karafla）
    r"\bpichet\b", r"melkkann", r"\bjarra\b", r"\bkanne\b", r"karafla", r"\bpipette\b", r"joefrex", r"\brhino\b", r"手沖壺", r"\brental\b",
    # 併売の食品・菓子・ハーブティー
    r"\bsprinkles?\b", r"\bkirkland\b", r"\bstevia\b", r"dried [a-z]+ (wheels?|slices?|rings?)", r"\bchamomile\b", r"\bspinnaker\b",
    # 淹れて出す飲み物（"Iced Coffee Roast" は豆なので iced coffee は入れない）
    r"iced\s?(mocha|latte)\b", r"espresso\s?tonic", r"リキッドコーヒー",
    # 器具と雑貨を国ごとの言い方で拾う。この一覧はずっと英語と日本語だけで書かれていて、
    # 台湾・香港の店のドリッパーやグラインダーが「豆」として並んでいた。
    # 中国語：器具／カプセル（膠囊）／贈答／食品／催し／内部ページ
    r"濾杯", r"濾紙", r"磨豆機", r"咖啡壺", r"手沖壺", r"濾壓", r"玻璃杯", r"保溫瓶", r"不鏽鋼",
    r"膠囊", r"禮盒", r"伴手禮", r"鳳梨酥", r"綜合堅果", r"果皮茶",
    r"品種課", r"見面會", r"報名", r"客服部", r"付款賣場", r"分裝/特殊商品",
    # 日本語：衣類・布物・紙物／菓子／器具・催し・書籍・内部ページ
    r"巾着", r"紙袋", r"ショッパー", r"手ぬぐい", r"ハンカチ", r"タオル", r"スウェット", r"シャツ", r"ポーチ", r"アームカバー", r"バラクラバ",
    r"パウンドケーキ", r"カフェオレベース", r"焼菓子",
    r"コーヒーフィルター", r"竹べら", r"農園ツアー", r"コーヒーツアー", r"詩集", r"専用ページ",
    # 英語：単数形や言い回しの揺れで漏れていたもの
    r"\bsocks?\b", r"\bumbrella\b", r"\bcloth filters?\b", r"carrying case", r"\bcase\b\s*$", r"\btamp(ing)?\s?mat\b",
    r"\bat home\b", r"coffee guide", r"brew\s?guide", r"debattbok",
    r"water\s?minerals?", r"minerals?\s?for\s?coffee", r"brew\s?water", r"\bapax\b", r"\bosmo\b", r"lotus\s?coffee",
    r"filters?\s?\((?:\d+|[^)]*(?:count|ct|pack))",
    r"roastery\s?tour", r"tasting\s?tour", r"coffee\s?tasting\s?and",
    r"pistachio", r"\bbeverage\b", r"nut\s?butter", r"chocolate\s?chips", r"^almond butter$",
    r"\(internal\)", r"\btest\s?product\b",
    # バリスタ用ツール／グッズ／商品でない行（JS側 isCoffee.js と同じ規則）
    r"\btools?\b", r"tamping\s?mat", r"\btamping\b", r"distribution\s?tool", r"dosing\s?funnel", r"puck\s?prep", r"post-?extraction", r"pulling\s?tool", r"mahlk[\u00f6o]nig",
    r"\bpins?\b", r"\bpatch(es)?\b", r"\bkeyring\b", r"\bbadges?\b",
    # 器具ブランド・中古機材・講座（いずれも豆ではないのに高額で価格順を荒らす）
    r"\becm\s+(puristika|synchronika|mechanika|classika|casa|barista)", r"\brocket\s+(r9|appartamento|mozzafiato|giotto|cinquantotto)",
    r"\bfagor\b", r"\bprofitec\b", r"\blelit\b", r"\bvictoria\s?arduino\b", r"\bslayer\b", r"\bdalla\s?corte\b",
    r"pre-?owned", r"open-?box", r"\bex-?demo\b",
    r"sca\s*(csp|cds)", r"brewing\s?skills", r"sensory\s?skills", r"barista\s?skills", r"green\s?coffee\s?skills", r"\bcourse\b", r"\bworkshop\s+\(", r"講座", r"セミナー",
    r"taste\s?cards?", r"tasting\s?cards?", r"flavou?r\s?cards?",
    r"^shipping$", r"^timer$", r"^donation$", r"配送料", r"送料", r"coke\s?case", r"sprite\s?case", r"soda\s?case",
]), re.I)
_COE = re.compile(r"cup of excellence|\bcoe\b", re.I)
_KG = re.compile(r"(\d+(?:\.\d+)?)\s?kg\b", re.I)
_LB = re.compile(r"(\d+(?:\.\d+)?)\s?lbs?\b", re.I)


def is_coffee(title: str, grams: int) -> bool:
    t = (title or "").replace("&#8211;", "-").replace("&#038;", "&").replace("&amp;", "&")
    if not _COE.search(t) and _NONCOFFEE.search(t):
        return False
    if grams and grams >= 1000:  # 業務用/卸(1kg以上)
        return False
    kg = _KG.search(t)
    if kg and float(kg.group(1)) >= 1:
        return False
    lb = _LB.search(t)
    if lb and float(lb.group(1)) >= 2:
        return False
    return True

C2REGION = {"JP": "eastAsia", "KR": "eastAsia", "TW": "eastAsia", "CN": "eastAsia", "HK": "eastAsia",
            "US": "northAmerica", "CA": "northAmerica", "NO": "nordic", "SE": "nordic", "DK": "nordic",
            "FI": "nordic", "IS": "nordic", "UK": "uk", "GB": "uk", "AU": "oceania", "NZ": "oceania",
            "ID": "seAsiaIndia", "VN": "seAsiaIndia", "TH": "seAsiaIndia", "MY": "seAsiaIndia",
            "PH": "seAsiaIndia", "SG": "seAsiaIndia", "IN": "seAsiaIndia", "BR": "latinAmerica",
            "CO": "latinAmerica", "MX": "latinAmerica", "GT": "latinAmerica", "CR": "latinAmerica",
            "PE": "latinAmerica", "AE": "africaMideast", "SA": "africaMideast", "ZA": "africaMideast",
            "ET": "africaMideast", "KE": "africaMideast", "RW": "africaMideast",
            # ここが空いていたせいで、独仏西白葡墺波愛の店が地図上どこにも置けず
            # 既定値[0,20]＝大西洋のギニア湾に流れ込んでいた
            "DE": "europe", "FR": "europe", "ES": "europe", "IT": "europe", "NL": "europe",
            "BE": "europe", "AT": "europe", "PT": "europe", "PL": "europe", "IE": "uk",
            "CH": "europe", "CZ": "europe", "GR": "europe", "HU": "europe", "TR": "europe",
            "RO": "europe", "HR": "europe", "SI": "europe", "SK": "europe", "EE": "europe",
            "LV": "europe", "LT": "europe", "UA": "europe", "RS": "europe", "BG": "europe",
            "LU": "europe", "MT": "europe", "CY": "europe",
            "PA": "latinAmerica", "EC": "latinAmerica", "BO": "latinAmerica", "CL": "latinAmerica",
            "AR": "latinAmerica", "NI": "latinAmerica", "HN": "latinAmerica", "SV": "latinAmerica",
            "DO": "latinAmerica", "JM": "latinAmerica", "UY": "latinAmerica",
            "IL": "africaMideast", "QA": "africaMideast", "KW": "africaMideast",
            "BH": "africaMideast", "OM": "africaMideast", "JO": "africaMideast",
            "EG": "africaMideast", "MA": "africaMideast", "TZ": "africaMideast",
            "UG": "africaMideast", "BI": "africaMideast", "MG": "africaMideast",
            "KH": "seAsiaIndia", "LA": "seAsiaIndia", "MM": "seAsiaIndia", "LK": "seAsiaIndia",
            "NP": "seAsiaIndia", "BD": "seAsiaIndia", "MO": "eastAsia", "MN": "eastAsia"}
C2COORD = {"JP": [139.7, 35.68], "KR": [126.98, 37.57], "TW": [121.5, 25.0], "CN": [116.4, 39.9],
           "HK": [114.1, 22.3], "US": [-98, 39], "CA": [-106, 56], "NO": [10.75, 59.9], "SE": [18.07, 59.3],
           "DK": [12.57, 55.7], "FI": [24.94, 60.17], "IS": [-21.9, 64.1], "UK": [-1.5, 52.5], "GB": [-1.5, 52.5],
           "AU": [145, -37.8], "NZ": [174.8, -41.3], "ID": [106.8, -6.2], "VN": [106.7, 10.8], "TH": [100.5, 13.75],
           "MY": [101.7, 3.14], "PH": [121, 14.6], "SG": [103.8, 1.35], "IN": [77.2, 28.6], "BR": [-46.6, -23.5],
           "CO": [-74.1, 4.6], "MX": [-99.1, 19.4], "GT": [-90.5, 14.6], "CR": [-84.1, 9.9], "PE": [-77, -12],
           "AE": [55.3, 25.2], "SA": [46.7, 24.7], "ZA": [18.4, -33.9], "ET": [38.7, 9.0],
           "KE": [36.8, -1.3], "RW": [30.1, -1.9],
           # 各国の首都。都市が分かる店は geocode.py が実際の街に置くので、
           # ここは市区町村を取れなかったときの受け皿。
           "DE": [13.4, 52.52], "FR": [2.35, 48.86], "ES": [-3.7, 40.42], "IT": [12.5, 41.9],
           "NL": [4.9, 52.37], "BE": [4.35, 50.85], "AT": [16.37, 48.21], "PT": [-9.14, 38.72],
           "PL": [21.01, 52.23], "IE": [-6.26, 53.35], "CH": [7.45, 46.95], "CZ": [14.42, 50.09],
           "GR": [23.73, 37.98], "HU": [19.04, 47.5], "TR": [32.86, 39.93], "RO": [26.1, 44.43],
           "HR": [15.98, 45.81], "SI": [14.51, 46.06], "SK": [17.11, 48.15], "EE": [24.75, 59.44],
           "LV": [24.11, 56.95], "LT": [25.28, 54.69], "UA": [30.52, 50.45], "RS": [20.46, 44.79],
           "BG": [23.32, 42.7], "LU": [6.13, 49.61], "MT": [14.51, 35.9], "CY": [33.38, 35.19],
           "PA": [-79.52, 8.98], "EC": [-78.47, -0.18], "BO": [-68.15, -16.5], "CL": [-70.65, -33.45],
           "AR": [-58.38, -34.6], "NI": [-86.25, 12.13], "HN": [-87.19, 14.08], "SV": [-89.19, 13.69],
           "DO": [-69.93, 18.49], "JM": [-76.79, 17.97], "UY": [-56.16, -34.9],
           "IL": [34.78, 32.08], "QA": [51.53, 25.29], "KW": [47.98, 29.38], "BH": [50.59, 26.23],
           "OM": [58.41, 23.59], "JO": [35.93, 31.95], "EG": [31.24, 30.04], "MA": [-6.84, 33.97],
           "TZ": [39.28, -6.79], "UG": [32.58, 0.35], "BI": [29.36, -3.38], "MG": [47.52, -18.88],
           "KH": [104.92, 11.56], "LA": [102.6, 17.97], "MM": [96.16, 16.87], "LK": [79.86, 6.93],
           "NP": [85.32, 27.7], "BD": [90.41, 23.81], "MO": [113.54, 22.2], "MN": [106.92, 47.89]}
# 巡回は産地を英語で拾う（"Colombia"）が、図鑑の産地フィルタは日本語で並んでいる
# （"コロンビア"）。そのため、コロンビアの豆が827件あってもフィルタでは1件も
# 出てこなかった。書き出すときに日本語へ揃える。
ORIGIN_JA = {
    "ethiopia": "エチオピア", "kenya": "ケニア", "colombia": "コロンビア",
    "panama": "パナマ", "peru": "ペルー", "brazil": "ブラジル", "bolivia": "ボリビア",
    "rwanda": "ルワンダ", "burundi": "ブルンジ", "guatemala": "グアテマラ",
    "costa rica": "コスタリカ", "el salvador": "エルサルバドル", "honduras": "ホンジュラス",
    "ecuador": "エクアドル", "mexico": "メキシコ", "nicaragua": "ニカラグア",
    "yemen": "イエメン", "india": "インド", "indonesia": "インドネシア",
    "uganda": "ウガンダ", "tanzania": "タンザニア", "madagascar": "マダガスカル",
    "china": "中国", "taiwan": "台湾", "thailand": "タイ", "myanmar": "ミャンマー",
}


def origin_ja(s: str) -> str:
    """産地名を図鑑の表記に揃える。知らない名前はそのまま通す。"""
    return ORIGIN_JA.get((s or "").strip().lower(), (s or "").strip())


def first_seen_date(p: dict, fallback: str) -> str:
    """その豆を初めて見つけた日（YYYY-MM-DD）。

    図鑑の「新しい順 / 古い順」がこれを見る。巡回した日を入れると全銘柄が
    同じ日付になり、並べ替えが意味を持たなくなる。first_seen は state.db が
    商品ごとに持っていて、export_for_site が SELECT * でそのまま返している。

    まだ一度も巡回していない豆や、値が壊れている場合は今日にする。
    """
    ts = p.get("first_seen")
    try:
        if ts:
            return datetime.date.fromtimestamp(float(ts)).isoformat()
    except (ValueError, OSError, OverflowError):
        pass
    return fallback


# 1ロースターあたりフロントに載せる上限（巡回対象が増えても配信JSONが太らないように）
MAX_LIVE_PER_ROASTER = 60   # いま買える豆
MAX_PAST_PER_ROASTER = 12   # 売切・終了の履歴
PAL = [["#DCD6C8", "#8A3B2E"], ["#2E2A24", "#C8A96A"], ["#B8433A", "#F2E9DC"], ["#3A2E4F", "#D9B44A"],
       ["#EFE9DA", "#2F5233"], ["#5A2E3A", "#E8C8A0"], ["#22303A", "#C8792E"], ["#7C4D8F", "#F2E9DC"],
       ["#F4F1E8", "#1A1815"], ["#6B2D3C", "#EFE9DA"]]


def load_seed_keys() -> dict:
    m = {}
    for f in ROASTER_DIR.glob("*.js"):
        for km in re.finditer(r'^\s+([a-z0-9]+): \{ name: "([^"]+)"', f.read_text(encoding="utf-8"), re.M):
            m[norm(km.group(2))] = km.group(1)
    return m


# レアロット画面のカテゴリはこの印で組まれている。銘柄名か店のタグから拾う。
# 「ゲイシャ入りブレンド」まで拾うと希少ロットの一覧が薄まるので、
# ブレンドと明記されているものは対象から外す。
_GEISHA = re.compile(r"(?i)\b(geisha|gesha)\b|ゲイシャ|ゲシャ")
_SIDRA = re.compile(r"(?i)\bsidra\b|シドラ")
_BLEND = re.compile(r"(?i)\bblend\b|ブレンド")


def _variety(title: str, tags: str) -> str:
    text = f"{title} {tags}"
    if _BLEND.search(text):
        return ""
    if _SIDRA.search(text):
        return "sidra"
    if _GEISHA.search(text):
        return "geisha"
    return ""


# COE。順位まで書いていない店も多いので、店が COE と名乗っていることを条件にする。
# 「COE農園のロット」も店自身がそう売っているので含め、見出し側でそう書く。
_COE = re.compile(r"(?i)\bCOE\b|cup\s*of\s*excellence|カップ[・\s]?オブ[・\s]?エクセレンス")
_COE_RANK = re.compile(r"(?i)#\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:st|nd|rd|th)\s*place|\b(\d{1,2})\s*位")


def _is_coe(title: str) -> bool:
    return bool(_COE.search(title or ""))


def _coe_rank(title: str):
    m = _COE_RANK.search(title or "")
    if not m:
        return None
    n = int(next(g for g in m.groups() if g))
    return n if 1 <= n <= 40 else None


# Café Granja La Esperanza。農園名だけで拾うと大量に誤爆する:
#   「Granja Paraiso 92」はカウカの別農園、「La Esperanza」はコスタリカにも
#   グアテマラにもホンジュラスにもある。以前これで無関係な豆が CGLE に並んだ。
# 店が CGLE と明記しているか、この生産者固有の農園名が出ている場合だけにする。
_CGLE = re.compile(r"(?i)\bCGLE\b|caf[eé]\s*granja|granja\s+la\s+esperanza|カフェ[・\s]?グランハ")
_CERRO_AZUL = re.compile(r"(?i)cerro\s*azul|セロ[・\s]?アスール")
_GRANJA_OTHER = re.compile(r"(?i)granja\s+para[ií]so")   # 別農園。巻き込まない


def _is_cgle(title: str, origin: str) -> bool:
    t = title or ""
    if _GRANJA_OTHER.search(t):
        return False
    if _CGLE.search(t):
        return True
    # Cerro Azul は CGLE の看板農園だが、地名としては他国にもある。
    # コロンビアと分かる場合に限る。
    return bool(_CERRO_AZUL.search(t) and (origin == "コロンビア" or re.search(r"(?i)colombia", t)))


def host(url: str) -> str:
    m = re.match(r"https?://([^/]+)", url or "")
    return (m.group(1) if m else "").replace("www.", "")


def main() -> None:
    # 地球儀の点を実際の街に置くため、店が名乗っている市区町村を先に座標へ直す。
    # 取得済みは config/citycoords.json に貯まるので、回を重ねるほど問い合わせは減る。
    if not SITE.exists():
        OUT.write_text('{"roasters":{},"beans":[]}', encoding="utf-8")
        print("no site.json; wrote empty overlay")
        return
    data = json.loads(SITE.read_text(encoding="utf-8"))
    seed = load_seed_keys()

    # 店ごとに1つだけ (市区町村, 国) を集めて座標に直す。
    # 失敗しても空の辞書が返るだけで、国の代表座標に落ちる。
    places, seen_place = [], set()
    for p in data.get("products", []):
        cp = ((p.get("city") or "").strip(), (p.get("country") or "").upper())
        if cp[0] and cp not in seen_place:
            seen_place.add(cp)
            places.append(cp)
    coords = geocode.resolve(places) if places else geocode.load_cache()
    roasters: dict = {}
    beans: list = []
    by_roaster: dict = {}
    for p in data.get("products", []):
        by_roaster.setdefault(p.get("roaster") or "Unknown", []).append(p)

    bid = 100000
    today = datetime.date.today().isoformat()
    # 豆名の重複判定用（日本語も残すため、区切り記号だけ除去）
    bnorm = lambda s: re.sub(r"[\s　_\-\[\]（）()／/|、。,.:：!！’'\"]", "", (s or "").lower())
    for rname, prods in by_roaster.items():
        # 豆以外（器具・グッズ・ティー・RTD・業務用 等）を除外して整理整頓
        prods = [p for p in prods if is_coffee(p.get("title"), int(p.get("grams") or 0))]
        # 同一ロースター内の同名の豆（filter/espresso違い・再掲など）を1件に。now/在庫ありを優先
        prods.sort(key=lambda p: 0 if (p.get("status") == "now" or p.get("available")) else 1)
        seen_names, uniq = set(), []
        for p in prods:
            n = bnorm(p.get("title"))
            if n and n in seen_names:
                continue
            seen_names.add(n)
            uniq.append(p)
        prods = uniq
        # 1店あたりの上限。巡回対象を増やすとこのJSONがそのままフロントに配られるため、
        # 「いま買える豆」は厚めに、売切・終了の履歴は薄く残して総量を抑える。
        # （Proud Mary は664件のうち販売中が13件で、残りは売切履歴だった）
        live_p = [p for p in prods if p.get("status") == "now" or p.get("available")]
        past_p = [p for p in prods if p not in live_p]
        prods = live_p[:MAX_LIVE_PER_ROASTER] + past_p[:MAX_PAST_PER_ROASTER]
        if not prods:  # コーヒー豆が無くなった店は追加しない
            continue
        # 種データに同じ店があるか。seed は「正規化した店名 → キー」なので、
        # 引き当てにも正規化した名前を使う。ここをキーで見ていたため、ほぼ全ての店が
        # 「新規」と判定され、手で書いた都市名・座標が国コードと国の代表座標で
        # 上書きされていた（Onyx は Rogers から米国の中心へ、Five Elephant は
        # ベルリンから大西洋へ飛んでいた）。
        matched = norm(rname) in seed
        key = seed[norm(rname)] if matched else slug(rname)
        country = (prods[0].get("country") or "JP").upper()
        # 店が /meta.json で名乗っている市区町村。ここが取れていれば実際の街に置ける。
        city = (prods[0].get("city") or "").strip()
        coord = coords.get(geocode.key_of(city, country)) if city else None
        if not matched:  # 種に無い店だけメタ情報を作る（ある店の情報は触らない）
            roasters[key] = {
                "name": rname, "city": city or country, "country": country,
                "region": C2REGION.get(country, "europe"), "platform": "Shopify",
                "note": "巡回で取得したロースター",
                # 街が分かればその座標。分からなければ国の代表座標に落とす。
                "coord": coord or C2COORD.get(country, [0, 20]),
                "url": host(prods[0].get("url")), "founded": "—", "style": "—",
                "ship": "—", "focus": "—",
                "bio": f"{rname}（{city or country}）。巡回システムが公式ECから取得したロースターです。",
            }

        for i, p in enumerate(prods):
            grams = int(p.get("grams") or 0)
            col, acc = PAL[(bid) % len(PAL)]
            seen = first_seen_date(p, today)
            bean = {
                "id": bid, "r": key, "name": p.get("title") or "Lot",
                "origin": origin_ja(p.get("origin")) or "ブレンド", "process": p.get("process") or "Washed",
                # 値段が取れなかったときに 1 を入れていた。通貨単位1（¥1・£1）の
                # コーヒーは存在せず、レアロットの安い順の先頭を占めてしまう。
                # 取れなければ 0 のままにして、価格順の一覧からは外す。
                "amount": round(float(p.get("price") or 0)), "cur": p.get("currency") or "JPY",
                "per": f"{grams}g" if grams else "250g",
                "status": p.get("status") or ("now" if p.get("available") else "sold"),
                # 「いつ図鑑に入ったか」。巡回した日ではなく、その豆を初めて見つけた日を使う。
                # 巡回した日を入れていたころは全銘柄が同じ日付になり、新着順が
                # 実質ID順（＝並べ替えとして意味を持たない）だった。
                # first_seen は state.db が持っている（export_for_site が SELECT * で返す）。
                "color": col, "accent": acc, "year": seen[:4], "updatedAt": seen,
            }
            if p.get("image"):
                bean["img"] = p["image"]
            # 商品ページのURL。これが無いと「買う」ボタンが店内検索止まりになり、
            # 巡回で実際の商品を掴んでいるのに該当ページへ直行できない。
            if p.get("url"):
                bean["link"] = p["url"]
            # 店が書いたテイスティングノート。味わいマップの座標はこれを最優先で使う。
            # 文字を含まない値（列ズレで数値が紛れ込んだ場合など）はノートではないので捨てる。
            notes = (p.get("notes") or "").strip()
            if notes and re.search(r"[^\W\d_]", notes):
                bean["notes"] = notes
            # 品種の印。レアロット画面はこの vt でカテゴリを組んでいるため、
            # 付けないと巡回で取れたゲイシャ・シドラが1件も並ばない。
            vt = _variety(p.get("title") or "", p.get("tags") or "")
            if vt:
                bean["vt"] = vt
            title = p.get("title") or ""
            if _is_coe(title):
                bean["coe"] = True
                rank = _coe_rank(title)
                if rank:
                    bean["coeRank"] = rank
            if _is_cgle(title, bean["origin"]):
                bean["cgle"] = True
            beans.append(bean)
            bid += 1

    OUT.write_text(json.dumps({"roasters": roasters, "beans": beans}, ensure_ascii=False), encoding="utf-8")
    print(f"live overlay: {len(roasters)} new roasters, {len(beans)} beans -> {OUT.relative_to(ROOT)}")
    report_odd_prices(roasters, beans)


# 100gあたりの円。ここでの並びは巡回のログに出すだけなので、為替は固定値で足りる。
_FX = {"JPY": 1, "USD": 150, "EUR": 165, "GBP": 195, "AUD": 100, "CAD": 108, "NZD": 90,
       "SGD": 112, "HKD": 19, "TWD": 4.7, "KRW": 0.11, "CNY": 21, "THB": 4.3, "VND": 0.006,
       "IDR": 0.0092, "MYR": 33, "PHP": 2.6, "INR": 1.8, "NOK": 14.5, "DKK": 22, "SEK": 14,
       "ISK": 1.1, "CHF": 185, "PLN": 41, "CZK": 6.8, "HUF": 0.43, "BRL": 27, "MXN": 8.3,
       "COP": 0.037, "CRC": 0.29, "ZAR": 8.2, "ETB": 1.25, "KES": 1.15, "RWF": 0.11,
       "AED": 41, "TRY": 3.75, "PEN": 40, "GTQ": 19.5, "SAR": 40, "ILS": 40}


def report_odd_prices(roasters: dict, beans: list, low: float = 200, high: float = 30000) -> list:
    """値段がおかしい店を巡回のログに出す。

    通貨や内容量の取り違えは、1銘柄ではなく店ごとにまとめて起きる。
    実例: Apollon's Gold は設定ファイルの通貨が USD になっていて、¥11,000 の
    ゲイシャが $11,000（¥1,650,000）として並んでいた。24銘柄すべてが同じずれ方を
    していたのに、誰も気づかないまま公開されていた。

    見分けには中央値ではなく両端を使う。中央値だと、機材と豆を一緒に売っている店
    （Tiong Hoe など）が引っかかってしまう。取り違えは全銘柄が同じ向きに同じだけ
    ずれるので、「いちばん安いものまで高すぎる」「いちばん高いものまで安すぎる」で
    見る。機材が混ざっているだけの店には安い豆もあるので、これなら鳴らない。

    止めはしない（本当に高い店もある）。気づける状態にするのが目的。
    """
    per_shop: dict = {}
    for b in beans:
        amt, cur = float(b.get("amount") or 0), b.get("cur") or "JPY"
        if amt <= 0 or b.get("status") != "now":
            continue
        g = b.get("per") or ""
        grams = round(float(g[:-2]) * 28.35) if g.endswith("oz") else int(re.sub(r"\D", "", g) or 0)
        if grams <= 0:
            continue
        per_shop.setdefault(b["r"], []).append(amt * _FX.get(cur, 1) / grams * 100)

    odd = []
    for key, vals in per_shop.items():
        if len(vals) < 3:
            continue                      # 数が少ないと両端の判断が効かない
        vals.sort()
        lo_end = vals[len(vals) // 10]            # 下から1割の位置
        hi_end = vals[-(len(vals) // 10) - 1]     # 上から1割の位置
        mid = vals[len(vals) // 2]
        if lo_end > high or hi_end < low:
            name = (roasters.get(key) or {}).get("name", key)
            odd.append((key, name, round(mid), len(vals)))
    for key, name, mid, n in sorted(odd, key=lambda x: -x[2]):
        print(f"  [値段を確認] {name}（{key}）中央値 ¥{mid:,}/100g・{n}銘柄"
              f" — 全銘柄が同じ向きにずれている。通貨か内容量の取り違えの疑い",
              file=sys.stderr)
    return odd


if __name__ == "__main__":
    main()
