"""build/site/ に静的サイト（index.html + data.json）を書き出す。

いまサイトとして公開しているのは frontend/（Next.js）の方で、ここの出力は
巡回結果を目で確かめるための控えとして残している。書き出し先は build/site。

docs/ には置かない。GitHub Pages はブランチ公開のとき /docs を配信元に選べる
仕様があり、その設定が残っていると、こちらの意図と無関係に docs/ の中身が
サイトとして配信されてしまう（2026-08-06 の File not found はこれが原因）。
"""
from __future__ import annotations
import json
import shutil
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def build(site_data: dict, failed: list[str], out_dir: str = "build/site") -> None:
    out = ROOT / out_dir
    out.mkdir(parents=True, exist_ok=True)

    products = site_data["products"]
    payload = {
        "generated": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()),
        "generated_ts": time.time(),
        "stats": {
            "products": len(products),
            "in_stock": sum(1 for p in products if p["available"]),
            "roasters": len({p["roaster"] for p in products}),
            "failed_roasters": failed,
        },
        "products": products,
        "events": site_data["events"],
    }
    (out / "data.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    shutil.copy(ROOT / "src" / "template.html", out / "index.html")
    (out / ".nojekyll").write_text("")
    print(f"  → {out/'index.html'} / data.json （{len(products)}商品, "
          f"{len(site_data['events'])}イベント）")
