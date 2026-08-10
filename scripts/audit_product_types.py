"""巡回している店が product_type に実際に何と書いているかを集めて、
今の判定（crawler._looks_like_coffee）が何を落とすのかを見る。

  python scripts/audit_product_types.py            全店（1ページずつ）
  python scripts/audit_product_types.py 40         先頭40店だけ

■ なぜ要るのか

「店の申告を読む」やり方は、こちらが分類名を正しく想像できている前提に立っている。
そこを外すと、本物の豆が黙って消える。しかも消えたことは画面を見ても分からない。

実際、最初に書いた判定は次を落とすところだった。

  "Coffee & Tea"                                    … tea を含む
  "Food, Beverages & Tobacco > Beverages > Coffee"  … Shopify の標準分類

どちらも中身は豆。想像で線を引かず、店が本当に使っている言葉を数えてから決める。
開発環境からは外に出られないので runner で走らせる。

落ちる商品は名前も出す。「この分類を落として良いか」は、名前を見れば分かる。
"""
from __future__ import annotations
import sys
from collections import Counter, defaultdict
from pathlib import Path

import httpx
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from crawler import REQ_HEADERS, _looks_like_coffee  # noqa: E402


def main() -> None:
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    cfg = yaml.safe_load((ROOT / "config" / "roasters.yaml").read_text(encoding="utf-8"))
    shops = [r for r in cfg.get("roasters", []) if r.get("url")]
    if limit:
        shops = shops[:limit]
    print(f"調べる店 {len(shops)} 軒（1店あたり先頭250商品）\n")

    kept: Counter = Counter()          # 通した分類 → 件数
    dropped: Counter = Counter()       # 落とす分類 → 件数
    examples: dict = defaultdict(list)  # 落とす分類 → 商品名の例
    reached = 0

    with httpx.Client(headers=REQ_HEADERS, timeout=20, follow_redirects=True) as c:
        for r in shops:
            base = r["url"].rstrip("/")
            try:
                resp = c.get(f"{base}/products.json", params={"limit": 250})
            except httpx.HTTPError:
                continue
            if resp.status_code != 200:
                continue
            try:
                prods = resp.json().get("products", [])
            except ValueError:
                continue
            if not prods:
                continue
            reached += 1
            for p in prods:
                t = (p.get("product_type") or "").strip() or "(空)"
                if _looks_like_coffee(p):
                    kept[t] += 1
                else:
                    dropped[t] += 1
                    if len(examples[t]) < 4:
                        examples[t].append((p.get("title") or "")[:44])

    print(f"応答のあった店 {reached} 軒 / 商品 {sum(kept.values()) + sum(dropped.values())} 件")
    print(f"通す {sum(kept.values())} 件 / 落とす {sum(dropped.values())} 件\n")

    print("■ 落とす分類（多い順）— 名前を見て、落として良いか確かめる")
    for t, n in dropped.most_common(40):
        print(f"  {n:>5}  {t}")
        for name in examples[t]:
            print(f"         · {name}")

    print("\n■ 通している分類（多い順・上位30）— ここに豆でないものが混ざっていないか")
    for t, n in kept.most_common(30):
        print(f"  {n:>5}  {t}")


if __name__ == "__main__":
    main()
