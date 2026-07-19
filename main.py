"""BEAN TRACKER — 実行入口。
巡回 → 差分検知 → サイト生成 → （任意で）Discord通知。

  python main.py             # 本番巡回
  python main.py --mock DIR  # DIR内のfixtureで動作テスト（ネット不要）
"""
from __future__ import annotations
import asyncio
import json
import sys
import time
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).parent / "src"))
from crawler import crawl_all, products_to_dicts, Product, _guess_origin, _guess_process  # noqa: E402
from state import open_db, apply_snapshot, export_for_site  # noqa: E402
from build_site import build  # noqa: E402
from notify import notify  # noqa: E402

ROOT = Path(__file__).parent


def load_mock(fixture_dir: str) -> list[dict]:
    """fixture(Shopify products.json形式)からProductを組み立てるテストモード。"""
    products: list[dict] = []
    for f in sorted(Path(fixture_dir).glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        roaster = data["_roaster"]
        for p in data["products"]:
            v = next((x for x in p["variants"] if x.get("available")), p["variants"][0])
            grams = int(v.get("grams") or 0)
            price = float(v["price"])
            text = p["title"] + " " + " ".join(p.get("tags", []))
            products.append(dict(
                key=f"{roaster['name']}::{p['handle']}",
                roaster=roaster["name"], country=roaster["country"],
                title=p["title"], url=f"{roaster['url']}/products/{p['handle']}",
                image="", price=price, currency=roaster["currency"],
                grams=grams,
                per100=round(price / grams * 100, 2) if grams else None,
                available=any(x.get("available") for x in p["variants"]),
                origin=_guess_origin(text), process=_guess_process(text), tags=text,
            ))
    return products


def main() -> None:
    t0 = time.time()
    config = yaml.safe_load((ROOT / "config" / "roasters.yaml").read_text(encoding="utf-8"))
    settings = config.get("settings", {})

    if "--mock" in sys.argv:
        fixture_dir = sys.argv[sys.argv.index("--mock") + 1]
        print(f"[mock] fixtures: {fixture_dir}")
        products = load_mock(fixture_dir)
        failed: list[str] = []
    else:
        print(f"巡回開始: {len(config['roasters'])}店舗")
        raw, failed = asyncio.run(crawl_all(config))
        products = products_to_dicts(raw)

    print(f"取得: {len(products)}商品（失敗 {len(failed)}店舗）")

    (ROOT / "data").mkdir(exist_ok=True)
    con = open_db(str(ROOT / "data" / "state.db"))
    stats = apply_snapshot(con, products, float(settings.get("min_oos_hours", 12)))
    print(f"イベント: 新着{stats['new']} / 再入荷{stats['restock']} / 売り切れ{stats['soldout']}")

    site_data = export_for_site(con)
    build(site_data, failed)

    fresh = [e for e in site_data["events"]
             if e["ts"] > t0 and e["type"] in ("new", "restock")]
    notify(fresh)

    print(f"完了（{round(time.time()-t0, 1)}秒）")


if __name__ == "__main__":
    main()
