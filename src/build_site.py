"""docs/ に静的サイト（index.html + data.json）を書き出す。GitHub Pagesで公開する想定。"""
from __future__ import annotations
import json
import shutil
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def build(site_data: dict, failed: list[str], out_dir: str = "docs") -> None:
    out = ROOT / out_dir
    out.mkdir(exist_ok=True)

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
