"""価格が桁落ちしている店の生データを見るための調査スクリプト。

一部の店で、取り込んだ値段が実売価格のおよそ1/100になっている
（Koppi 21〜48 SEK / 実売 210〜480、GLITCH 15〜65 JPY / 実売 1,500〜6,500）。
商品単位ではなく店単位で一律なので、経路か単位の解釈を疑っている。
ただし手元からは店に到達できない（プロキシが 403）ため、
ネットワークのある実行環境で走らせて生の値を出す。

  python scripts/diag_price.py https://koppi.se https://shop.glitchcoffee.com

出力は「どの経路が応答したか」と「その経路が返した生の価格フィールド」。
"""
from __future__ import annotations
import asyncio
import json
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from crawler import REQ_HEADERS  # noqa: E402

SHOPIFY_PATHS = ["/products.json", "/collections/all/products.json",
                 "/en/products.json", "/ja/products.json"]


async def probe(client: httpx.AsyncClient, base: str, hint: str = "JPY") -> None:
    base = base.rstrip("/")
    print(f"\n{'=' * 72}\n{base}\n{'=' * 72}")

    # --- Shopify products.json ---
    for path in SHOPIFY_PATHS:
        try:
            r = await client.get(f"{base}{path}", params={"limit": 3})
        except httpx.HTTPError as e:
            print(f"  {path:34s} {type(e).__name__}")
            continue
        if r.status_code != 200:
            print(f"  {path:34s} HTTP {r.status_code}")
            continue
        try:
            prods = r.json().get("products", [])
        except json.JSONDecodeError:
            print(f"  {path:34s} JSONではない（{r.text[:60]!r}）")
            continue
        print(f"  {path:34s} HTTP 200 / {len(prods)}件")
        for p in prods[:2]:
            v = (p.get("variants") or [{}])[0]
            print(f"      title   : {p.get('title', '')[:56]}")
            print(f"      price   : {v.get('price')!r}  (型 {type(v.get('price')).__name__})")
            print(f"      grams   : {v.get('grams')!r}   variant: {v.get('title')!r}")

        # products.json は通貨を書いていない。実際に何の通貨で返されたのかを確かめる。
        # Shopify は要求元の市場に合わせた通貨(presentment currency)で値段を返すので、
        # 設定ファイルに書いた店の現地通貨とは一致しないことがある。
        for probe_path in ("/cart.js", "/meta.json"):
            try:
                c = await client.get(f"{base}{probe_path}")
                if c.status_code == 200:
                    d = c.json()
                    print(f"      {probe_path:11s} → currency={d.get('currency')!r} "
                          f"{'' if probe_path == '/cart.js' else str(d)[:80]}")
            except Exception as e:
                print(f"      {probe_path:11s} → {type(e).__name__}")

        # 現地通貨を指定して取り直せるか
        try:
            c = await client.get(f"{base}{path}", params={"limit": 2, "currency": hint})
            if c.status_code == 200:
                pv = ((c.json().get("products") or [{}])[0].get("variants") or [{}])[0]
                print(f"      ?currency={hint} → price={pv.get('price')!r}")
        except Exception as e:
            print(f"      ?currency={hint} → {type(e).__name__}")
        return   # 応答した経路が判明したら終わり

    # --- Shopify Atom ---
    try:
        r = await client.get(f"{base}/collections/all.atom")
        if r.status_code == 200 and "<entry" in r.text:
            import re
            print("  /collections/all.atom              HTTP 200（Atom経路）")
            for m in list(re.finditer(r"<entry>(.*?)</entry>", r.text, re.S))[:3]:
                e = m.group(1)
                t = re.search(r"<title>(.*?)</title>", e, re.S)
                pr = re.search(r"<s:price[^>]*>([\d.]+)</s:price>", e)
                cu = re.search(r'<s:price[^>]*currency="([^"]+)"', e)
                print(f"      title : {(t.group(1) if t else '')[:56]}")
                print(f"      price : {pr.group(1) if pr else None!r}  currency={cu.group(1) if cu else None}")
            return
        print(f"  /collections/all.atom              HTTP {r.status_code}")
    except httpx.HTTPError as e:
        print(f"  /collections/all.atom              {type(e).__name__}")

    # --- WooCommerce ---
    try:
        r = await client.get(f"{base}/wp-json/wc/store/v1/products", params={"per_page": 3})
    except httpx.HTTPError as e:
        print(f"  /wp-json/wc/store/v1/products      {type(e).__name__}")
        return
    if r.status_code != 200:
        print(f"  /wp-json/wc/store/v1/products      HTTP {r.status_code}")
        return
    try:
        rows = r.json()
    except json.JSONDecodeError:
        print("  /wp-json/wc/store/v1/products      JSONではない")
        return
    print(f"  /wp-json/wc/store/v1/products      HTTP 200 / {len(rows)}件（WooCommerce経路）")
    for p in rows[:3] if isinstance(rows, list) else []:
        pr = p.get("prices") or {}
        print(f"      name              : {str(p.get('name'))[:56]}")
        print(f"      prices.price      : {pr.get('price')!r}")
        print(f"      currency_code     : {pr.get('currency_code')!r}")
        print(f"      currency_minor_unit: {pr.get('currency_minor_unit')!r}")
        print(f"      → いまの計算       : {pr.get('price')} / 10**{pr.get('currency_minor_unit')} "
              f"= {float(pr.get('price') or 0) / (10 ** int(pr.get('currency_minor_unit', 2)))}")


async def main() -> None:
    targets = sys.argv[1:] or [
        "https://koppi.se|SEK", "https://shop.glitchcoffee.com|JPY",
        "https://onibuscoffee.com|JPY", "https://dropcoffee.com|SEK",
        "https://goodmanroaster.com|JPY", "https://standoutcoffee.com|SEK",
    ]
    async with httpx.AsyncClient(headers=REQ_HEADERS, timeout=httpx.Timeout(20),
                                 follow_redirects=True) as client:
        for t in targets:
            url, _, hint = t.partition("|")
            await probe(client, url, hint or "JPY")


if __name__ == "__main__":
    asyncio.run(main())
