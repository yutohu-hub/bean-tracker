"""「豆である証拠」がどれだけ揃うかを、実際の店の商品で数える。

  python scripts/audit_bean_markers.py          全店
  python scripts/audit_bean_markers.py 60       先頭60店

■ なぜ要るのか

いまの取り方は「全部取ってから、豆でないものを外す」（引き算）。
外す語は各国語ぶん要るので一覧が終わらず、広げると本物の豆を巻き添えにする。

逆に「豆である証拠がある物だけ取る」（足し算）に変えたい。ただし線引きを
想像で決めると本物の豆が消える。消えたことは画面を見ても分からない。
だから先に、実際の商品で証拠がどれだけ揃うかを数える。

■ 数える証拠

  weight   内容量がグラム/オンスで付いている（豆は重さで売る。椅子や水筒には無い）
  origin   産地が読み取れる
  process  精製方法が読み取れる
  variety  品種名がある（Geisha, Bourbon, SL28 …）
  roast    焙煎度がある（light / medium / dark / 浅煎り …）
  shop     店が product_type に「コーヒー」と書いている

出すのは事実だけ。どこに線を引くかはこの結果を見てから決める。
"""
from __future__ import annotations
import asyncio
import sys
from collections import Counter
from pathlib import Path

import httpx
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from crawler import (REQ_HEADERS, _guess_origin, _guess_process,  # noqa: E402
                     _grams_from_text, html_to_text, shop_says, bean_markers)

CONCURRENCY = 12
TIMEOUT = 12.0


async def fetch(client: httpx.AsyncClient, sem: asyncio.Semaphore, r: dict):
    base = r["url"].rstrip("/")
    async with sem:
        try:
            resp = await client.get(f"{base}/products.json", params={"limit": 250})
        except httpx.HTTPError:
            return r, None
    if resp.status_code != 200:
        return r, None
    try:
        return r, (resp.json().get("products", []) or None)
    except ValueError:
        return r, None


def markers_of(p: dict) -> set:
    v = (p.get("variants") or [{}])[0]
    grams = int(v.get("grams") or 0) or _grams_from_text(
        f"{v.get('title', '')} {p.get('title', '')}")
    tagtext = (" ".join(p.get("tags", [])) if isinstance(p.get("tags"), list)
               else str(p.get("tags", "")))
    text = f"{p.get('title', '')} {tagtext}"
    deep = f"{text} {html_to_text(p.get('body_html') or '')[:1200]}"
    return bean_markers(text=text, deep=deep, grams=grams, kind=shop_says(p))


async def run(shops: list) -> None:
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(headers=REQ_HEADERS, timeout=TIMEOUT,
                                 follow_redirects=True) as client:
        results = await asyncio.gather(*(fetch(client, sem, r) for r in shops))

    each: Counter = Counter()       # 証拠ごとの件数
    count: Counter = Counter()      # 証拠の数ごとの件数
    total = 0
    zero_examples: list = []        # 証拠が1つも無い商品
    one_examples: list = []         # 証拠が1つだけの商品（線引きの境目）
    reached = 0

    for r, prods in results:
        if not prods:
            continue
        reached += 1
        for p in prods:
            m = markers_of(p)
            total += 1
            count[len(m)] += 1
            for k in m:
                each[k] += 1
            name = (p.get("title") or "")[:46]
            if not m and len(zero_examples) < 25:
                zero_examples.append(f"{r['name'][:14]:<14} {name}")
            if len(m) == 1 and len(one_examples) < 30:
                one_examples.append(f"{r['name'][:14]:<14} [{next(iter(m))}] {name}")

    print(f"応答のあった店 {reached} 軒 / 商品 {total} 件\n")
    print("■ 証拠ごとの件数")
    for k in ("weight", "origin", "process", "variety", "roast", "shop"):
        n = each[k]
        print(f"  {k:<8} {n:>6} 件 ({n / max(total, 1) * 100:5.1f}%)")

    print("\n■ 揃った証拠の数ごとの件数")
    run_sum = 0
    for i in sorted(count, reverse=True):
        run_sum += count[i]
        print(f"  {i} つ  {count[i]:>6} 件   （{i}つ以上で通すと {run_sum} 件・"
              f"{run_sum / max(total, 1) * 100:.1f}%）")

    print("\n■ 証拠が1つも無い商品（足し算にすると必ず落ちる）")
    for s in zero_examples:
        print(f"   {s}")

    print("\n■ 証拠が1つだけの商品（ここが線引きの境目）")
    for s in one_examples:
        print(f"   {s}")


def main() -> None:
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    cfg = yaml.safe_load((ROOT / "config" / "roasters.yaml").read_text(encoding="utf-8"))
    shops = [r for r in cfg.get("roasters", []) if r.get("url")]
    if limit:
        shops = shops[:limit]
    print(f"調べる店 {len(shops)} 軒（1店あたり先頭250商品・{CONCURRENCY}軒ずつ並行）\n")
    asyncio.run(run(shops))
    _ = (_guess_origin, _guess_process)   # 参照を残す（証拠の抽出は bean_markers 側）


if __name__ == "__main__":
    main()
