"""名前だけでは豆かどうか判断が付かない商品を、店のページで確かめる。

  python scripts/check_products.py config/check_products.json

値段の外れ値（scripts/price_outliers.mjs）を見ていくと、名前からは何なのか
分からないものが残る。Four Barrel の "nOKay"、Tiong Hoe の "ICON" のように、
商品名だけが付いていて種類が書かれていない場合がそれ。

推測で消すと本物の豆を落とすので、店の商品ページを見に行く。
Shopify は商品URLの末尾に .json を付けると product_type を返すので、
それを読めば「Coffee」なのか「Espresso Machine」なのかが分かる。
開発環境からは外に出られないので runner で走らせる。

出すのは店が書いた事実だけ。落とすかどうかはこの結果を見てから決める。
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from crawler import REQ_HEADERS  # noqa: E402


def main() -> None:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "config" / "check_products.json")
    rows = json.loads(src.read_text(encoding="utf-8"))
    print(f"調べる商品 {len(rows)} 件\n")

    with httpx.Client(headers=REQ_HEADERS, timeout=25, follow_redirects=True) as c:
        for r in rows:
            url = r["url"].split("?")[0].rstrip("/")
            try:
                resp = c.get(f"{url}.json")
            except httpx.HTTPError as e:
                print(f"✗ {r['shop']:<12} {r['name'][:24]:<24} 届かない（{type(e).__name__}）")
                continue
            if resp.status_code != 200:
                print(f"✗ {r['shop']:<12} {r['name'][:24]:<24} HTTP {resp.status_code}")
                continue
            try:
                p = resp.json().get("product", {})
            except json.JSONDecodeError:
                print(f"✗ {r['shop']:<12} {r['name'][:24]:<24} JSONではない応答")
                continue
            ptype = (p.get("product_type") or "").strip() or "(種類の記載なし)"
            tags = ", ".join(p.get("tags") or [])[:60]
            vendor = (p.get("vendor") or "").strip()
            v = (p.get("variants") or [{}])[0]
            grams = v.get("grams") or 0
            # 本文の冒頭。種類が書かれていない店でも、ここに何なのかが出ていることが多い
            body = (p.get("body_html") or "")
            body = " ".join(body.replace("<", " <").split())
            import re
            body = re.sub(r"<[^>]+>", "", body).strip()[:90]
            print(f"  {r['shop']:<12} {r['name'][:24]:<24} 種類: {ptype}")
            print(f"{'':<40} 売主: {vendor or '—'} / 重さ: {grams}g / タグ: {tags or '—'}")
            if body:
                print(f"{'':<40} 説明: {body}")


if __name__ == "__main__":
    main()
