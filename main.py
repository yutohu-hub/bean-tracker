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
from crawler import (crawl_all, products_to_dicts, _guess_origin, shop_says,  # noqa: E402
                     _guess_process, extract_notes, html_to_text)
from state import (open_db, apply_snapshot, export_for_site,  # noqa: E402
                   prune_missing_roasters, record_health, due_shops)
from build_site import build  # noqa: E402
from notify import notify  # noqa: E402
from push_notify import push  # noqa: E402

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
                # 店の申告。本番と同じ道を通しておかないと、手元の一巡で配線が確かめられない
                kind=shop_says(p),
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
    # 分割巡回で config["roasters"] は縮むので、全部の名前を先に控えておく。
    # 「図鑑に載せる店」の一覧は、今回見る店ではなく、こちらが正しい
    all_names = {r["name"] for r in config["roasters"]}

    if "--shard" in sys.argv:
        spec = sys.argv[sys.argv.index("--shard") + 1]
        every = config["roasters"]
        config["roasters"] = apply_shard(every, spec)
        print(f"分割巡回 {spec}: {len(config['roasters'])}/{len(every)}店舗")

    (ROOT / "data").mkdir(exist_ok=True)
    con = open_db(str(ROOT / "data" / "state.db"))

    if "--mock" in sys.argv:
        fixture_dir = sys.argv[sys.argv.index("--mock") + 1]
        print(f"[mock] fixtures: {fixture_dir}")
        products = load_mock(fixture_dir)
        failed: list[str] = []
    else:
        # 続けて失敗している店は、毎回叩いても同じ結果になることが多い。
        # 24時間に1回だけ試すことにして、空いた枠を取れる店に回す。
        # 見捨てるのではなく頻度を落とすだけなので、復活すれば1日で戻る。
        names = [r["name"] for r in config["roasters"]]
        due, skip = due_shops(con, names)
        if skip:
            print(f"今回は飛ばす（10回以上続けて取れていない店）: {len(skip)}店")
            config["roasters"] = [r for r in config["roasters"] if r["name"] in set(due)]
        print(f"巡回開始: {len(config['roasters'])}店舗")
        raw, failed = asyncio.run(crawl_all(config))
        products = products_to_dicts(raw)
        record_health(con, {r["name"] for r in config["roasters"]} - set(failed),
                      set(failed))

    # ノートの取得率は味わいマップの精度そのものなので、毎回ログに出して追えるようにする
    noted = sum(1 for p in products if (p.get("notes") or "").strip())
    pct = round(noted / len(products) * 100, 1) if products else 0.0
    print(f"取得: {len(products)}商品（失敗 {len(failed)}店舗） / ノートあり {noted}件 {pct}%")

    # 図鑑から外した店の商品を消す。外しただけでは消えず、在庫ありのまま残る。
    # mock は fixtures の店名なので対象にしない（本物の一覧と噛み合わない）
    if "--mock" not in sys.argv:
        for name, n in prune_missing_roasters(con, all_names):
            print(f"図鑑から外した店の商品を消した: {name} {n}件")

    stats = apply_snapshot(con, products, float(settings.get("min_oos_hours", 12)))
    print(f"イベント: 新着{stats['new']} / 再入荷{stats['restock']} / 売り切れ{stats['soldout']}")
    # 棚から消えた商品。数が急に跳ねたら、門が効きすぎているか店側の不調を疑う
    if stats.get("gone"):
        print(f"棚から消えたので在庫なしに倒した: {stats['gone']}件")

    site_data = export_for_site(con)
    build(site_data, failed)
    # フロント連携用に機械可読な巡回結果も書き出す（→ scripts/build_frontend_data.py が変換）
    (ROOT / "data" / "site.json").write_text(
        json.dumps(site_data, ensure_ascii=False), encoding="utf-8")

    fresh = [e for e in site_data["events"]
             if e["ts"] > t0 and e["type"] in ("new", "restock")]
    notify(fresh)
    # 端末への通知。再入荷と新着レアロットだけを1通にまとめて送る
    push(fresh)

    print(f"完了（{round(time.time()-t0, 1)}秒）")


if __name__ == "__main__":
    main()
