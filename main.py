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
from crawler import (crawl_all, products_to_dicts, Product, _guess_origin,  # noqa: E402
                     _guess_process, extract_notes, html_to_text)
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
            body = p.get("body_html") or ""
            deep = text + " " + html_to_text(body)[:1200]
            products.append(dict(
                key=f"{roaster['name']}::{p['handle']}",
                roaster=roaster["name"], country=roaster["country"],
                title=p["title"], url=f"{roaster['url']}/products/{p['handle']}",
                image="", price=price, currency=roaster["currency"],
                grams=grams,
                per100=round(price / grams * 100, 2) if grams else None,
                available=any(x.get("available") for x in p["variants"]),
                origin=_guess_origin(text) or _guess_origin(deep),
                process=_guess_process(text) or _guess_process(deep),
                tags=text, notes=extract_notes(body, p["title"]),
            ))
    return products


def apply_shard(roasters: list[dict], spec: str) -> list[dict]:
    """"i/n" 形式で巡回対象を n 分割し、i 番目だけ返す。

    Shopify は共有IPあたりの総リクエスト数で 429 を返すため、442店を一度に叩くと
    ほぼ全滅する（実測: 411店が失敗し、それまで取れていた33店まで巻き添えになった）。
    1回あたりを実績のある規模に抑え、run ごとにスライスをずらして全体を回す。
    state.db は巡回しなかった店の情報を消さないので、数回ぶんで全店がそろう。
    [i::n] のストライドで、地域や登録順が偏らないように散らす。
    """
    i, n = (int(x) for x in spec.split("/", 1))
    n = max(1, n)
    return roasters[i % n::n]


def main() -> None:
    t0 = time.time()
    config = yaml.safe_load((ROOT / "config" / "roasters.yaml").read_text(encoding="utf-8"))
    settings = config.get("settings", {})

    if "--shard" in sys.argv:
        spec = sys.argv[sys.argv.index("--shard") + 1]
        every = config["roasters"]
        config["roasters"] = apply_shard(every, spec)
        print(f"分割巡回 {spec}: {len(config['roasters'])}/{len(every)}店舗")

    if "--mock" in sys.argv:
        fixture_dir = sys.argv[sys.argv.index("--mock") + 1]
        print(f"[mock] fixtures: {fixture_dir}")
        products = load_mock(fixture_dir)
        failed: list[str] = []
    else:
        print(f"巡回開始: {len(config['roasters'])}店舗")
        raw, failed = asyncio.run(crawl_all(config))
        products = products_to_dicts(raw)

    # ノートの取得率は味わいマップの精度そのものなので、毎回ログに出して追えるようにする
    noted = sum(1 for p in products if (p.get("notes") or "").strip())
    pct = round(noted / len(products) * 100, 1) if products else 0.0
    print(f"取得: {len(products)}商品（失敗 {len(failed)}店舗） / ノートあり {noted}件 {pct}%")

    (ROOT / "data").mkdir(exist_ok=True)
    con = open_db(str(ROOT / "data" / "state.db"))
    stats = apply_snapshot(con, products, float(settings.get("min_oos_hours", 12)))
    print(f"イベント: 新着{stats['new']} / 再入荷{stats['restock']} / 売り切れ{stats['soldout']}")

    site_data = export_for_site(con)
    build(site_data, failed)
    # フロント連携用に機械可読な巡回結果も書き出す（→ scripts/build_frontend_data.py が変換）
    (ROOT / "data" / "site.json").write_text(
        json.dumps(site_data, ensure_ascii=False), encoding="utf-8")

    fresh = [e for e in site_data["events"]
             if e["ts"] > t0 and e["type"] in ("new", "restock")]
    notify(fresh)

    print(f"完了（{round(time.time()-t0, 1)}秒）")


if __name__ == "__main__":
    main()
