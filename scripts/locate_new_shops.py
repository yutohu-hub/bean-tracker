"""巡回で追加された店のうち、まだ所在地が国コードのままの店を実際の街に置く。

巡回本体は city を /meta.json から拾うようになったが、1回の巡回は全体の
13分の1しか回らないため、全店に行き渡るまで時間がかかる。この script は
残っている店だけを名指しで直接引き、待たずに地図へ反映させる。

  python scripts/locate_new_shops.py           # 調べて表示するだけ
  python scripts/locate_new_shops.py --apply   # オーバーレイに書き込む

書き込み先は live.generated.json。次の巡回で作り直されるが、そのときには
巡回本体が同じ情報を持っているので、結果は変わらない。
"""
from __future__ import annotations
import json
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import geocode  # noqa: E402

OVERLAY = ROOT / "frontend" / "components" / "data" / "live.generated.json"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


def shop_city(url: str) -> str:
    """Shopify の /meta.json が名乗る市区町村。"""
    base = url if url.startswith("http") else f"https://{url}"
    try:
        r = httpx.get(f"{base.rstrip('/')}/meta.json", headers={"User-Agent": UA},
                      timeout=20, follow_redirects=True)
        if r.status_code == 200:
            return (r.json().get("city") or "").strip()
    except Exception:
        pass
    return ""


def main() -> None:
    apply = "--apply" in sys.argv
    data = json.loads(OVERLAY.read_text(encoding="utf-8"))
    targets = {k: r for k, r in data["roasters"].items() if r.get("city") == r.get("country")}
    print(f"所在地が国コードのままの店: {len(targets)}軒\n")

    changed = 0
    for key, r in targets.items():
        city = shop_city(r.get("url", ""))
        if not city:
            print(f"  {r['name'][:24]:26s} 市区町村を名乗っていない → 国の代表座標のまま")
            continue
        coord = geocode.resolve([(city, r.get("country", ""))]).get(
            geocode.key_of(city, r.get("country", "")))
        print(f"  {r['name'][:24]:26s} {city:<18} → {coord if coord else '座標を引けず'}")
        if apply and coord:
            r["city"] = city
            r["coord"] = coord
            r["bio"] = f"{r['name']}（{city}）。巡回システムが公式ECから取得したロースターです。"
            changed += 1
        time.sleep(0.6)

    if apply and changed:
        OVERLAY.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(f"\n{changed}軒を実際の街に置きました。")
    elif not apply:
        print("\n--apply を付けると反映します。")


if __name__ == "__main__":
    main()
