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
async def _get_with_retry(client: httpx.AsyncClient, url: str, params: dict,
                          retries: int = 3) -> httpx.Response | None:
    resp = None
    for attempt in range(retries):
        try:
            resp = await client.get(url, params=params)
        except httpx.HTTPError as e:
            LAST_REASON["_"] = f"{type(e).__name__}"
            resp = None
            wait = 2.0 * (2 ** attempt)
        else:
            if resp.status_code in (200, 404):
                return resp
            LAST_REASON["_"] = f"HTTP {resp.status_code}"
            if resp.status_code == 429:
                try:
                    wait = float(resp.headers.get("retry-after", ""))
                except ValueError:
                    wait = 0.0
                if wait <= 0 or wait > 10:
                    return resp          # IP制限。待っても無駄なので即あきらめる
            else:
                wait = 2.0 * (2 ** attempt)
        if attempt < retries - 1:
            await asyncio.sleep(min(wait, 10.0) + random.uniform(0, 0.5))
    return resp


# ---------------- Shopify ----------------

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
    resp = await _get_with_retry(client, f"{base}/collections/all.atom", {})
    if resp is None or resp.status_code != 200 or "<entry" not in resp.text:
        LAST_REASON[r["name"]] = f"/collections/all.atom → {('HTTP %s' % resp.status_code) if resp is not None else '接続失敗'}"
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
        text = f"{name} {re.sub(r'<[^>]+>', ' ', e)}"
        grams = _grams_from_text(name)
        p = float(price.group(1)) if price else 0.0
        products.append(Product(
            key=f"{r['name']}::{url.rsplit('/', 1)[-1]}",
            roaster=r["name"], country=r.get("country", ""), title=name, url=url,
            image=(img.group(1) if img else ""), price=p,
            currency=(cur.group(1) if cur else r.get("currency", "")),
            grams=grams, per100=round(p / grams * 100, 2) if grams and p else None,
            available=True,          # Atomは在庫切れを載せないため、掲載＝在庫ありとみなす
            origin=_guess_origin(text), process=_guess_process(text), tags=name[:300],
        ))
    return products or None


async def _fetch_shopify_path(client: httpx.AsyncClient, r: dict, max_pages: int,
                              path: str) -> list[Product] | None:
    base = r["url"].rstrip("/")
    products: list[Product] = []
    for page in range(1, max_pages + 1):
        resp = await _get_with_retry(client, f"{base}{path}", {"limit": 250, "page": page})
        if resp is None or resp.status_code != 200:
            if page == 1:
                why = f"HTTP {resp.status_code}" if resp is not None else LAST_REASON.get("_", "接続失敗")
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
            text = " ".join([p.get("title", ""), " ".join(p.get("tags", []))
                             if isinstance(p.get("tags"), list) else str(p.get("tags", ""))])
            images = p.get("images") or []
            products.append(Product(
                key=f"{r['name']}::{p.get('handle','')}",
                roaster=r["name"], country=r.get("country", ""),
                title=p.get("title", "").strip(),
                url=f"{base}/products/{p.get('handle','')}",
                image=(images[0].get("src", "") if images else ""),
                price=price, currency=r.get("currency", ""),
                grams=grams, per100=per100,
                available=bool(avail_vs),
                origin=_guess_origin(text), process=_guess_process(text),
                tags=text[:300],
            ))
        if len(batch) < 250:
            break
    return products


# ---------------- WooCommerce ----------------

async def _fetch_woo(client: httpx.AsyncClient, r: dict, max_pages: int) -> list[Product] | None:
    base = r["url"].rstrip("/")
    products: list[Product] = []
    for page in range(1, max_pages + 1):
        resp = await _get_with_retry(client, f"{base}/wp-json/wc/store/v1/products",
                                     {"per_page": 100, "page": page})
        if resp is None or resp.status_code != 200:
            return None if page == 1 else products
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
                origin=_guess_origin(title), process=_guess_process(title),
                tags=title,
            ))
        if len(batch) < 100:
            break
    return products


# ---------------- orchestration ----------------

async def crawl_roaster(client, r, max_pages, sem) -> tuple[dict, list[Product] | None]:
    async with sem:
        await asyncio.sleep(random.uniform(0.3, 1.2))  # 一斉アクセスを避けて間隔をあける
        platform = r.get("platform", "auto")
        if platform in ("auto", "shopify"):
            res = await _fetch_shopify(client, r, max_pages)
            if res is not None:
                return r, res
        if platform in ("auto", "woocommerce"):
            res = await _fetch_woo(client, r, max_pages)
            if res is not None:
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
