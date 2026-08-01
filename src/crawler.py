"""ロースターECの巡回。Shopify / WooCommerce を自動判定して商品を正規化する。"""
from __future__ import annotations
import asyncio
import html
import json
import random
import re
from dataclasses import dataclass, asdict

import httpx

# 一部のShopify店はボットUAの /products.json をブロックするため、実ブラウザ相当のUAで取得する。
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
REQ_HEADERS = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}

ORIGIN_WORDS = [
    "Ethiopia", "Kenya", "Colombia", "Panama", "Peru", "Brazil", "Bolivia",
    "Rwanda", "Burundi", "Guatemala", "Costa Rica", "El Salvador", "Honduras",
    "Ecuador", "Mexico", "Nicaragua", "Yemen", "India", "Indonesia", "Uganda",
    "Tanzania", "Madagascar", "China", "Taiwan", "Thailand", "Myanmar",
    "エチオピア", "ケニア", "コロンビア", "パナマ", "ペルー", "ブラジル",
    "ルワンダ", "ブルンジ", "グアテマラ", "コスタリカ", "エルサルバドル",
    "ホンジュラス", "エクアドル", "メキシコ", "インドネシア", "イエメン",
]
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


def _guess_origin(text: str) -> str:
    for w in ORIGIN_WORDS:
        if w.lower() in text.lower():
            return w
    return ""


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

# 「Tasting Notes: 〜」のように見出しが付いている行を拾う
_NOTE_LABEL = re.compile(
    r"(?im)^[\s\-–・*]*(?:tasting\s*notes?|flavou?r\s*notes?|cupping\s*notes?|flavou?r\s*profile"
    r"|tasting|notes?|フレーバー(?:ノート)?|テイスティング\s*ノート|カッピング\s*ノート|風味|味わい|フレーバ)"
    r"\s*[:：]?\s*(.*)$")
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
    s = re.sub(r"(?i)^(and|of)\s+", "", (s or "").strip(" .．、,:：-–—/|"))
    return _WS.sub(" ", s)[:160]

def extract_notes(html: str, title: str = "") -> str:
    """商品説明から風味の記述だけを取り出す。見つからなければ空文字。"""
    text = html_to_text(html)
    if not text:
        return ""
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        m = _NOTE_LABEL.match(ln)
        if not m:
            continue
        val = _clean_note(m.group(1))
        # 「Tasting Notes」だけの見出し行なら、次の行が中身
        if len(val) < 3 and i + 1 < len(lines):
            val = _clean_note(lines[i + 1])
        if len(val) >= 3 and _FLAVOR_WORD.search(val):
            return val
    # 見出しが無い場合：風味語が2種類以上ある短い行を採る
    for ln in lines:
        if len(ln) > 90 or len(ln) < 5:
            continue
        if len(set(w.group(0).lower() for w in _FLAVOR_WORD.finditer(ln))) >= 2:
            return _clean_note(ln)
    return ""


def _grams_from_text(text: str) -> int:
    m = re.search(r"(\d+(?:\.\d+)?)\s*(kg|g)\b", text.lower())
    if not m:
        return 0
    val = float(m.group(1))
    return int(val * 1000) if m.group(2) == "kg" else int(val)


# 失敗理由（HTTPステータス等）を店ごとに残し、ログで原因を追えるようにする。
LAST_REASON: dict[str, str] = {}


# 実測: GitHub Actions のIPからは Shopify が 429 を返し続け、90秒待っても解消しない
# （1回の巡回に58分かけて成果ゼロだった）。IP単位の制限なので待っても無駄と割り切り、
# Retry-After が短く示された時だけ1回待ち、それ以外は素早く諦めて次の店へ進む。
# 理由は戻り値で返す。店は並行に巡回しているので、共有の辞書に書くと
# 隣の店の失敗理由が混ざり、URLの誤りとレート制限を見分けられなくなる。
async def _get_with_retry(client: httpx.AsyncClient, url: str, params: dict,
                          retries: int = 3) -> tuple[httpx.Response | None, str]:
    resp, why = None, "接続失敗"
    for attempt in range(retries):
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


async def _shop_currencies(client: httpx.AsyncClient, base: str) -> tuple[str, str]:
    """(店の本来の通貨, いまの接続で返ってくる通貨)。分からない側は空文字。"""
    if base in _SHOP_CUR:
        return _SHOP_CUR[base]
    home = presentment = ""
    for path, key in (("/meta.json", "home"), ("/cart.js", "presentment")):
        try:
            resp = await client.get(f"{base}{path}")
            if resp.status_code == 200:
                cur = (resp.json().get("currency") or "").upper()
                if key == "home":
                    home = cur
                else:
                    presentment = cur
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


async def _fetch_shopify(client: httpx.AsyncClient, r: dict, max_pages: int) -> list[Product] | None:
    res = await _fetch_shopify_path(client, r, max_pages, "/products.json")
    if res:
        return res
    # 404（この経路が無い店）のときだけ別経路を試す。
    # 429はレート制限なので、ここで追撃すると悪化させるだけ＝再試行しない。
    if "404" not in LAST_REASON.get(r["name"], ""):
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
        notes = extract_notes(body, name)
        text = f"{name} {re.sub(r'<[^>]+>', ' ', e)}"
        deep = f"{text} {html_to_text(body)[:1200]}"
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
            tags=name[:300], notes=notes,
        ))
    return products or None


async def _fetch_shopify_path(client: httpx.AsyncClient, r: dict, max_pages: int,
                              path: str) -> list[Product] | None:
    base = r["url"].rstrip("/")
    # 値段より先に通貨を決める。設定ファイルの現地通貨は当てにしない。
    home, presentment = await _shop_currencies(client, base)
    currency = home or presentment or r.get("currency", "")
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
    products: list[Product] = []
    for page in range(1, max_pages + 1):
        resp, why = await _get_with_retry(client, f"{base}{path}",
                                          {"limit": 250, "page": page, **ask})
        if resp is None or resp.status_code != 200:
            if page == 1:
                LAST_REASON[r["name"]] = f"{path} → {why}"
                return None
            return products
        try:
            batch = resp.json().get("products", [])
        except json.JSONDecodeError:
            if page == 1:
                LAST_REASON[r["name"]] = f"{path} → JSONではない応答"
                return None
            return products
        if not batch:
            break
        for p in batch:
            # コーヒー以外（器具・マグ等)をゆるく除外
            ptype = (p.get("product_type") or "").lower()
            if any(x in ptype for x in ("gear", "equipment", "merch", "mug", "gift card", "apparel", "subscription")):
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
            notes = extract_notes(body, p.get("title", ""))
            deep = " ".join([text, html_to_text(body)[:1200]])
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
                tags=text[:300], notes=notes,
            ))
        if len(batch) < 250:
            break
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
            notes = extract_notes(body, title)
            deep = f"{title} {html_to_text(body)[:1200]}"
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
                tags=title, notes=notes,
            ))
        if len(batch) < 100:
            break
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
    async with sem:
        await asyncio.sleep(random.uniform(0.3, 1.2))  # 一斉アクセスを避けて間隔をあける
        res = await _fetch_any(client, r, max_pages)
        if res is not None:
            return r, res
        # 接続で落ちた店は www 側にしかAレコードが無いことがある。リダイレクトは
        # 追えても名前解決の失敗は追えないので、ここだけ手で入れ替えて1回試す。
        if any(w in LAST_REASON.get(r["name"], "") for w in _CONNECT_FAIL):
            alt = _alt_host(r["url"])
            if alt:
                LAST_REASON.pop(r["name"], None)
                res = await _fetch_any(client, {**r, "url": alt}, max_pages)
                if res is not None:
                    print(f"  ↻ {r['name']} — {alt} で取得")
                    return r, res
        return r, None


async def crawl_all(config: dict) -> tuple[list[Product], list[str]]:
    s = config.get("settings", {})
    sem = asyncio.Semaphore(int(s.get("concurrency", 8)))
    timeout = httpx.Timeout(float(s.get("timeout_sec", 20)))
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
                print(f"  ✓ {r['name']} — {len(res)}件")
                all_products.extend(res)
    return all_products, failed


def products_to_dicts(products: list[Product]) -> list[dict]:
    return [asdict(p) for p in products]
