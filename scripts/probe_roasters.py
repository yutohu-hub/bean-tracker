"""巡回対象に加える前に、その店から本当に商品が取れるか確かめる。

店を config/roasters.yaml に足しても、EC が商品APIを持っていなければ図鑑には
1点も並ばない。名前と国と都市だけが地球儀に浮いて、押しても何も出てこない店に
なる。開発環境からは外に出られないので、確かめるにはネットのある runner が要る
（座標の照合を verify-positions.yml でやっているのと同じ事情）。

  python scripts/probe_roasters.py config/candidates.yaml

巡回本体の crawl_all をそのまま呼ぶので、「実際に巡回したらどうなるか」を
そのまま見ている。取れた店だけを roasters.yaml に写す。
"""
from __future__ import annotations
import asyncio
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from crawler import crawl_all, SHOP_PLACE, LAST_REASON  # noqa: E402


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "config" / "candidates.yaml")
    config = yaml.safe_load(path.read_text(encoding="utf-8"))
    # 候補は数店なので、本番の分割や間引きは要らない。素直に全部叩く
    config.setdefault("settings", {}).setdefault("concurrency", 4)
    cands = config["roasters"]
    print(f"候補 {len(cands)} 店を確かめる\n")

    products, failed = asyncio.run(crawl_all(config))

    by_shop: dict[str, list] = {}
    for p in products:
        by_shop.setdefault(p.roaster, []).append(p)

    print("\n" + "=" * 68)
    ok = []
    for r in cands:
        name = r["name"]
        got = by_shop.get(name, [])
        base = r["url"].rstrip("/")
        place = SHOP_PLACE.get(base, {})
        if not got:
            print(f"✗ {name:<28} 取れない — {LAST_REASON.get(name, '不明')}")
            continue
        avail = [p for p in got if p.available]
        cur = {p.currency for p in got if p.currency}
        # 値段と内容量がそろっていないと、図鑑では値段順にも並べられない
        priced = [p for p in avail if p.price and p.grams]
        print(f"✓ {name:<28} {len(got):>3}件（在庫{len(avail):>3} / 値段と内容量あり{len(priced):>3}）"
              f"  通貨 {'/'.join(sorted(cur)) or '不明'}"
              f"  所在 {place.get('city', '?')} {place.get('country', '')}")
        for p in got[:2]:
            print(f"     例: {p.title[:44]:<46} {p.price} {p.currency} {p.grams or '?'}g")
        ok.append(name)

    print("=" * 68)
    print(f"取れた {len(ok)} 店 / 取れない {len(cands) - len(ok)} 店")
    if failed:
        print("失敗:", ", ".join(failed))


if __name__ == "__main__":
    main()
