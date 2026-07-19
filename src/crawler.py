"""ロースターECの巡回。Shopify / WooCommerce を自動判定して商品を正規化する。"""
from __future__ import annotations
import asyncio
import json
import random
import re
from dataclasses import dataclass, asdict

import httpx

UA = "BeanTrackerBot/1.0 (personal hobby project; contact via repo)"

ORIGIN_WORDS = [
    "Ethiopia", "Kenya", "Colombia", "Panama", "Peru", "Brazil", "Bolivia",
    "Rwanda", "Burundi", "Guatemala", "Costa Rica", "El Salvador", "Honduras",
    "Ecuador", "Mexico", "Nicaragua", "Yemen", "India", "Indonesia", "Uganda",
    "Tanzania", "Madagascar", "China", "Taiwan", "Thailand", "Myanmar",
    "エチオピア", "ケニア", "コロンビア", "パナマ", "ペルー", "ブラジル",
    "ルワンダ", "ブルンジ", "グアテマラ", "コスタリカ", "エルサルバドル",
    "ホンジュラス", "エクアドル", "メキシコ", "インドネシア", "イエメン",
]
PROCESS_WORDS = [
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


# Cloudflare等のレート制限で一時的に5xxを返す店が多いため、リトライで拾う。
async def _get_with_retry(client: httpx.AsyncClient, url: str, params: dict,
                          retries: int = 3) -> httpx.Response | None:
    for attempt in range(retries):
        try:
            resp = await client.get(url, params=params)
        except httpx.HTTPError:
            resp = None
        else:
            if resp.status_code == 200 or resp.status_code == 404:
                return resp
        if attempt < retries - 1:
            await asyncio.sleep(1.5 * (2 ** attempt) + random.uniform(0, 0.5))
    return resp


# ---------------- Shopify ----------------

async def _fetch_shopify(client: httpx.AsyncClient, r: dict, max_pages: int) -> list[Product] | None:
    base = r["url"].rstrip("/")
    products: list[Product] = []
    for page in range(1, max_pages + 1):
        resp = await _get_with_retry(client, f"{base}/products.json", {"limit": 250, "page": page})
        if resp is None or resp.status_code != 200:
            return None if page == 1 else products
        try:
            batch = resp.json().get("products", [])
        except json.JSONDecodeError:
            return None if page == 1 else products
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
    async with httpx.AsyncClient(headers={"User-Agent": UA}, timeout=timeout,
                                 follow_redirects=True) as client:
        tasks = [crawl_roaster(client, r, max_pages, sem) for r in config["roasters"]]
        for coro in asyncio.as_completed(tasks):
            r, res = await coro
            if res is None:
                failed.append(r["name"])
                print(f"  ✗ {r['name']} — 取得失敗（API非対応 or ブロック）")
            else:
                print(f"  ✓ {r['name']} — {len(res)}件")
                all_products.extend(res)
    return all_products, failed


def products_to_dicts(products: list[Product]) -> list[dict]:
    return [asdict(p) for p in products]
