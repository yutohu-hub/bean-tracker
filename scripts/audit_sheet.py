"""図鑑の情報シート（産地・精製・風味・内容量）が、どこで欠けているかを実測する。

  python scripts/audit_sheet.py        全店
  python scripts/audit_sheet.py 60     先頭60店

■ 何を知りたいのか

いま図鑑では、産地の41.6%・精製の58.0%・風味の74.9%が空欄になっている。
原因は2つのどちらか。

  A. 店の商品ページに、そもそも書かれていない
  B. 書かれているのに、こちらの取り方が拾えていない

Aなら手の打ちようがない（想像で埋めるのは前にやめた）。Bなら直せる。
どちらなのかを、実際の商品ページの文章で数える。

■ いちばんの容疑

商品説明を 1200字で切っている（crawler.py の 4か所）。
店の説明文は「物語 → 生産者 → 標高 → 精製 → 味の記述」の順に書かれることが多く、
肝心の表が1200字より下にあると丸ごと落ちる。

そこで、同じ商品について
  いまの取り方（本文を1200字で切る）
  本文を全部読んだ場合
を並べて、差がどれだけ出るかを見る。
"""
from __future__ import annotations
import asyncio
import sys
from pathlib import Path

import httpx
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from crawler import (REQ_HEADERS, _guess_origin, _guess_process,  # noqa: E402
                     _grams_from_text, html_to_text, extract_notes,
                     has_bean_evidence, _looks_like_coffee, option_text)

CONCURRENCY = 8
TIMEOUT = 20.0
CUT = 1200          # いまの切り方


async def fetch(client, sem, r):
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


def look(p: dict) -> dict:
    """1商品ぶんの、いまの取り方と全文読みの差を出す。"""
    v = (p.get("variants") or [{}])[0]
    tags = p.get("tags") or []
    tagtext = " ".join(tags) if isinstance(tags, list) else str(tags)
    text = f"{p.get('title', '')} {tagtext}"
    body_html = p.get("body_html") or ""
    full = html_to_text(body_html)
    cut = full[:CUT]

    grams = int(v.get("grams") or 0) or _grams_from_text(
        f"{p.get('title', '')} {option_text(p)}")

    return {
        "title": (p.get("title") or "")[:44],
        "body_len": len(full),
        "origin_now": _guess_origin(text) or _guess_origin(f"{text} {cut}"),
        "origin_full": _guess_origin(text) or _guess_origin(f"{text} {full}"),
        "proc_now": _guess_process(text) or _guess_process(f"{text} {cut}"),
        "proc_full": _guess_process(text) or _guess_process(f"{text} {full}"),
        # extract_notes は HTML を受け取って中で全文を見る。
        # 実際の巡回では notes に全文版が入っているので、ここでは切った側と比べる
        "notes_now": extract_notes(body_html[:CUT * 3], p.get("title", "")),
        "notes_full": extract_notes(body_html, p.get("title", "")),
        "grams": grams,
    }


async def run(shops: list) -> None:
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(headers=REQ_HEADERS, timeout=TIMEOUT,
                                 follow_redirects=True) as client:
        results = await asyncio.gather(*(fetch(client, sem, r) for r in shops))

    rows, reached = [], 0
    for r, prods in results:
        if not prods:
            continue
        reached += 1
        for p in prods:
            if not has_bean_evidence(p) or not _looks_like_coffee(p):
                continue
            rows.append((r["name"], look(p)))

    n = len(rows)
    if not n:
        print("豆が1件も取れなかった")
        return
    print(f"応答のあった店 {reached} 軒 / 豆 {n} 件\n")

    def cnt(f):
        return sum(1 for _, x in rows if f(x))

    print("■ いまの取り方で空欄になっている数")
    print(f"  産地   {cnt(lambda x: not x['origin_now']):>5} 件 "
          f"({cnt(lambda x: not x['origin_now']) / n * 100:.1f}%)")
    print(f"  精製   {cnt(lambda x: not x['proc_now']):>5} 件 "
          f"({cnt(lambda x: not x['proc_now']) / n * 100:.1f}%)")
    print(f"  風味   {cnt(lambda x: not x['notes_now']):>5} 件 "
          f"({cnt(lambda x: not x['notes_now']) / n * 100:.1f}%)")
    print(f"  内容量 {cnt(lambda x: not x['grams']):>5} 件 "
          f"({cnt(lambda x: not x['grams']) / n * 100:.1f}%)")

    gain_o = cnt(lambda x: not x["origin_now"] and x["origin_full"])
    gain_p = cnt(lambda x: not x["proc_now"] and x["proc_full"])
    gain_n = cnt(lambda x: not x["notes_now"] and x["notes_full"])
    print("\n■ 本文を最後まで読むと埋まる数（＝1200字で切って落としていた分）")
    print(f"  産地 +{gain_o} 件 / 精製 +{gain_p} 件 / 風味 +{gain_n} 件")

    still_o = cnt(lambda x: not x["origin_full"])
    still_p = cnt(lambda x: not x["proc_full"])
    still_n = cnt(lambda x: not x["notes_full"])
    print("\n■ 全部読んでも空欄（＝店が書いていない。こちらでは埋められない）")
    print(f"  産地 {still_o} 件 ({still_o / n * 100:.1f}%) / "
          f"精製 {still_p} 件 ({still_p / n * 100:.1f}%) / "
          f"風味 {still_n} 件 ({still_n / n * 100:.1f}%)")

    longs = [x for _, x in rows if x["body_len"] > CUT]
    print(f"\n■ 説明文が1200字より長い商品: {len(longs)} 件 "
          f"({len(longs) / n * 100:.1f}%)")
    if longs:
        ls = sorted(x["body_len"] for x in longs)
        print(f"   長さの中央値 {ls[len(ls) // 2]}字 / 最長 {ls[-1]}字")

    print("\n■ 切っていたせいで落ちていた例")
    shown = 0
    for name, x in rows:
        if shown >= 12:
            break
        if (not x["origin_now"] and x["origin_full"]) or \
           (not x["proc_now"] and x["proc_full"]) or \
           (not x["notes_now"] and x["notes_full"]):
            got = []
            if not x["origin_now"] and x["origin_full"]:
                got.append(f"産地={x['origin_full']}")
            if not x["proc_now"] and x["proc_full"]:
                got.append(f"精製={x['proc_full']}")
            if not x["notes_now"] and x["notes_full"]:
                got.append(f"風味={x['notes_full'][:34]}")
            print(f"   {name[:16]:<16} {x['title']:<44} 本文{x['body_len']:>5}字 → {' / '.join(got)}")
            shown += 1


def main() -> None:
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    cfg = yaml.safe_load((ROOT / "config" / "roasters.yaml").read_text(encoding="utf-8"))
    shops = [r for r in cfg.get("roasters", []) if r.get("url")]
    if limit:
        shops = shops[:limit]
    print(f"調べる店 {len(shops)} 軒（{CONCURRENCY}軒ずつ並行）\n")
    asyncio.run(run(shops))


if __name__ == "__main__":
    main()
