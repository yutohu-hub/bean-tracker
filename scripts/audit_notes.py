"""風味（tasting notes）が、どれだけ取れて・どれだけ正しいかを実測する。

  python scripts/audit_notes.py            既定（40店・商品ページは各3件）
  python scripts/audit_notes.py 60 5       60店・商品ページは各5件

■ 何を知りたいのか

  1. 量  … 全体の何割で風味が取れるか
  2. 質  … 取れたものが本当にその豆の風味か

量だけ見ても意味がない。別の豆の風味が混ざっていれば、空欄より悪い。

■ 取り方は2通りあり、確からしさが違う

  見出しあり … 「Tasting Notes: ...」のような見出しの直後を採る。
                店が「これは風味です」と書いているので、外しにくい。
  当て推量   … 見出しが無いとき、風味語が2種類以上ある短い行を採る。
                説明文の地の文を拾う危険がある。

この2つを分けて数える。当て推量ぶんが多いなら、全体の精度はその分だけ落ちる。

■ 商品ページから取る案の検証

products.json に無くても、商品ページには書かれていることがある。
ただしページにはヘッダー・フッター・「他のおすすめ」まで入っており、
前回の測定では産地が別の豆のものに化けた（ギフト定期便に産地が付いた）。
風味でも同じことが起きるかを、ここで確かめる。
"""
from __future__ import annotations
import asyncio
import sys
from pathlib import Path

import httpx
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from crawler import (REQ_HEADERS, html_to_text, extract_notes,  # noqa: E402
                     has_bean_evidence, _looks_like_coffee,
                     _NOTE_LABEL, _FLAVOR_WORD, _clean_note)

CONCURRENCY = 6
TIMEOUT = 20.0


def how_found(html: str) -> str:
    """extract_notes がどちらの道で見つけたかを、同じ手順で判定する。"""
    text = html_to_text(html)
    if not text:
        return "none"
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        m = _NOTE_LABEL.match(ln)
        if not m:
            continue
        val = _clean_note(m.group(1))
        if len(val) < 3 and i + 1 < len(lines):
            val = _clean_note(lines[i + 1])
        if len(val) >= 3 and _FLAVOR_WORD.search(val):
            return "label"
    for ln in lines:
        if len(ln) > 90 or len(ln) < 5:
            continue
        if len(set(w.group(0).lower() for w in _FLAVOR_WORD.finditer(ln))) >= 2:
            return "guess"
    return "none"


async def get(client, sem, url, params=None):
    async with sem:
        try:
            r = await client.get(url, params=params or {})
        except httpx.HTTPError:
            return None
    return r if r.status_code == 200 else None


async def one_shop(client, sem, r, page_n):
    base = r["url"].rstrip("/")
    resp = await get(client, sem, f"{base}/products.json", {"limit": 100})
    if resp is None:
        return []
    try:
        prods = resp.json().get("products", []) or []
    except ValueError:
        return []
    beans = [p for p in prods if has_bean_evidence(p) and _looks_like_coffee(p)]

    rows = []
    for i, p in enumerate(beans):
        body = p.get("body_html") or ""
        rows.append({
            "shop": r["name"], "title": (p.get("title") or "")[:40],
            "note": extract_notes(body, p.get("title", "")),
            "how": how_found(body), "page_note": None,
        })
    # 商品ページ側は数を絞って取る（1商品1リクエストなので）
    for row, p in list(zip(rows, beans))[:page_n]:
        h = p.get("handle") or ""
        if not h:
            continue
        page = await get(client, sem, f"{base}/products/{h}")
        if page is None:
            continue
        row["page_note"] = extract_notes(page.text, p.get("title", ""))
    return rows


async def run(shops, page_n):
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(headers=REQ_HEADERS, timeout=TIMEOUT,
                                 follow_redirects=True) as client:
        got = await asyncio.gather(*(one_shop(client, sem, r, page_n) for r in shops))
    rows = [x for g in got for x in g]
    if not rows:
        print("豆が1件も取れなかった")
        return
    n = len(rows)
    shops_hit = len({x["shop"] for x in rows})
    print(f"豆 {n} 件 / 店 {shops_hit} 軒\n")

    have = [x for x in rows if x["note"]]
    lab = [x for x in rows if x["how"] == "label"]
    gue = [x for x in rows if x["how"] == "guess"]
    print("■ どれだけ取れるか（products.json だけ）")
    print(f"  風味あり  {len(have):>5} 件 ({len(have) / n * 100:5.1f}%)")
    print(f"    見出しあり {len(lab):>5} 件 ({len(lab) / n * 100:5.1f}%)  ← 店が「風味」と書いている")
    print(f"    当て推量   {len(gue):>5} 件 ({len(gue) / n * 100:5.1f}%)  ← 地の文を拾う危険がある")
    print(f"  風味なし  {n - len(have):>5} 件 ({(n - len(have)) / n * 100:5.1f}%)")

    if have:
        ls = sorted(len(x["note"]) for x in have)
        print(f"\n  取れた文字列の長さ 中央値 {ls[len(ls) // 2]}字 / 最長 {ls[-1]}字")

    print("\n■ 見出しありの例（そのまま出せるか目で見る）")
    for x in lab[:14]:
        print(f"   {x['shop'][:14]:<14} {x['title']:<40} → {x['note'][:52]}")

    # 店ごとの内訳。当て推量に頼っている店がどこかを出す。
    # 先頭から並べるだけだと1店の例で埋まり、その店の書き方しか見えない
    by_shop = {}
    for x in rows:
        d = by_shop.setdefault(x["shop"], {"n": 0, "label": 0, "guess": 0})
        d["n"] += 1
        if x["how"] in ("label", "guess"):
            d[x["how"]] += 1
    print("\n■ 店ごとの内訳（当て推量が多い順）")
    print(f"   {'店':<20} {'豆':>5} {'見出し':>6} {'当て推量':>8}")
    ranked = sorted(by_shop.items(), key=lambda kv: -kv[1]["guess"])
    for name, d in ranked[:15]:
        print(f"   {name[:20]:<20} {d['n']:>5} {d['label']:>6} {d['guess']:>8}")

    print("\n■ 当て推量の例（店ごとに2件ずつ。1店の書き方に偏らせない）")
    per = {}
    for x in gue:
        k = x["shop"]
        if per.get(k, 0) >= 2:
            continue
        per[k] = per.get(k, 0) + 1
        print(f"   {x['shop'][:14]:<14} {x['title']:<38} → {x['note'][:48]}")
        if sum(per.values()) >= 24:
            break

    # --- 商品ページから取る案 ---
    checked = [x for x in rows if x["page_note"] is not None]
    if not checked:
        print("\n（商品ページは取れなかった）")
        return
    gain = [x for x in checked if not x["note"] and x["page_note"]]
    same = [x for x in checked if x["note"] and x["page_note"] and
            x["note"].strip().lower() == x["page_note"].strip().lower()]
    diff = [x for x in checked if x["note"] and x["page_note"] and
            x["note"].strip().lower() != x["page_note"].strip().lower()]
    print(f"\n■ 商品ページも読んだ場合（{len(checked)} 件で確認）")
    print(f"  新たに埋まる   {len(gain)} 件")
    print(f"  同じ           {len(same)} 件")
    print(f"  食い違う       {len(diff)} 件  ← 別の場所を読んでいる疑い")
    for x in diff[:10]:
        print(f"   {x['shop'][:14]:<14} {x['title'][:34]:<34}")
        print(f"      JSON: {x['note'][:60]}")
        print(f"      ページ: {x['page_note'][:60]}")
    print("\n  新たに埋まった例:")
    for x in gain[:10]:
        print(f"   {x['shop'][:14]:<14} {x['title']:<40} → {x['page_note'][:52]}")


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    shops_n = int(args[0]) if args else 40
    page_n = int(args[1]) if len(args) > 1 else 3
    cfg = yaml.safe_load((ROOT / "config" / "roasters.yaml").read_text(encoding="utf-8"))
    shops = [r for r in cfg.get("roasters", []) if r.get("url")][:shops_n]
    print(f"調べる店 {len(shops)} 軒 / 商品ページは各 {page_n} 件（{CONCURRENCY}並行）\n")
    asyncio.run(run(shops, page_n))


if __name__ == "__main__":
    main()
