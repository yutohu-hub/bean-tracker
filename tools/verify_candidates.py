"""候補ロースターのURLが products.json / WooCommerce API で商品を返すか並列検証する。
使い方: python tools/verify_candidates.py candidates.tsv
  candidates.tsv は "name<TAB>country<TAB>currency<TAB>url" 形式。
既存 config/roasters.yaml の name/url と重複するものは自動スキップ。
標準出力に OK 行（同じTSV形式）を出す。"""
from __future__ import annotations
import asyncio
import json
import sys
from pathlib import Path

import httpx
import yaml

ROOT = Path(__file__).resolve().parent.parent
UA = "BeanTrackerBot/1.0 (personal hobby project; contact via repo)"


def load_existing() -> tuple[set[str], set[str]]:
    cfg = yaml.safe_load((ROOT / "config" / "roasters.yaml").read_text(encoding="utf-8"))
    names = {r["name"].strip().lower() for r in cfg["roasters"]}
    urls = {r["url"].rstrip("/").replace("https://", "").replace("http://", "").replace("www.", "")
            for r in cfg["roasters"]}
    return names, urls


async def check(client: httpx.AsyncClient, row: dict, sem: asyncio.Semaphore) -> dict | None:
    base = row["url"].rstrip("/")
    async with sem:
        # Shopify
        try:
            r = await client.get(f"{base}/products.json", params={"limit": 1})
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, dict) and data.get("products"):
                    return {**row, "platform": "shopify"}
        except Exception:
            pass
        # WooCommerce
        try:
            r = await client.get(f"{base}/wp-json/wc/store/v1/products", params={"per_page": 1})
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, list) and data:
                    return {**row, "platform": "woo"}
        except Exception:
            pass
    return None


async def main(path: str) -> None:
    names, urls = load_existing()
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) != 4:
            continue
        name, country, currency, url = parts
        norm_url = url.rstrip("/").replace("https://", "").replace("http://", "").replace("www.", "")
        if name.strip().lower() in names or norm_url in urls:
            continue  # 既存
        rows.append(dict(name=name, country=country, currency=currency, url=url))

    sem = asyncio.Semaphore(16)
    timeout = httpx.Timeout(12.0, connect=8.0)
    async with httpx.AsyncClient(headers={"User-Agent": UA}, timeout=timeout,
                                 follow_redirects=True) as client:
        results = await asyncio.gather(*[check(client, r, sem) for r in rows])

    ok = [r for r in results if r]
    for r in ok:
        print(f"{r['name']}\t{r['country']}\t{r['currency']}\t{r['url']}\t{r['platform']}")
    print(f"# 検証 {len(rows)}件 → OK {len(ok)}件", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
