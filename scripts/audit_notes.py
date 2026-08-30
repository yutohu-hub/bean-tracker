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

■ 地の文からの切り出し（trim_prose）

当て推量で拾った文は "A comforting and sweet coffee with flavours of
chocolate and cherry" のように、風味の前に地の文が付く。crawler.trim_prose は
「flavours of」のような接続語がある場合だけ、その後ろを残す。取り込みに入れてある。

ここでは、切る前（trim=False）と本番の結果を並べて出し続ける。件数だけでは
切りすぎたかどうかが分からない。実際、入れる前の下見で5件中3件は
風味が消えていた（規則を直して直った）。規則を変えたら、また目で見る。

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
from crawler import (REQ_HEADERS, extract_notes_src,  # noqa: E402
                     has_bean_evidence, _looks_like_coffee)

CONCURRENCY = 6
TIMEOUT = 20.0


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
        # 取り方は crawler が返す。監査側で同じ手順を書き写すと、
        # 本体を直したときにこちらだけ古いままになる
        note, how = extract_notes_src(p.get("body_html") or "", p.get("title", ""))
        rows.append({
            "shop": r["name"], "title": (p.get("title") or "")[:40],
            "note": note, "how": how, "page_note": None,
            # note は本番と同じ（切り出し済み）。raw は切る前。
            # 切り出しは crawler の中に入れたので、監査で同じことをもう一度
            # 書くと写しになる。生の文を返させて、本番の結果と並べる
            "raw": extract_notes_src(p.get("body_html") or "",
                                     p.get("title", ""), trim=False)[0],
        })
    # 商品ページ側は数を絞って取る（1商品1リクエストなので）
    for row, p in list(zip(rows, beans))[:page_n]:
        h = p.get("handle") or ""
        if not h:
            continue
        page = await get(client, sem, f"{base}/products/{h}")
        if page is None:
            continue
        row["page_note"] = extract_notes_src(page.text, p.get("title", ""))[0]
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

    # --- 地の文からの切り出し ---
    # 「何件変わったか」だけを出しても良し悪しは分からない。切りすぎれば意味が
    # 変わるので、元の文と切った結果を必ず並べて出す。
    # 本番に入れたあとも出し続ける（規則を変えたときに、ここで気づけるように）。
    cut = [x for x in rows if x["note"] and x["note"] != x["raw"]]
    print("\n■ 地の文からの切り出し（本番に入れてある）")
    print(f"  風味あり {len(have)} 件のうち、切り出しが働くのは {len(cut)} 件"
          f" ({len(cut) / max(len(have), 1) * 100:.1f}%)")
    print(f"    うち見出しあり {sum(1 for x in cut if x['how'] == 'label')} 件"
          f" / 当て推量 {sum(1 for x in cut if x['how'] == 'guess')} 件")
    if cut:
        ls = sorted(len(x["note"]) for x in cut)
        print(f"    切ったあとの長さ 中央値 {ls[len(ls) // 2]}字（切る前は"
              f" {sorted(len(x['raw']) for x in cut)[len(cut) // 2]}字）")
    print("\n  元の文 → 切った結果（店ごとに2件ずつ）")
    per2 = {}
    for x in cut:
        if per2.get(x["shop"], 0) >= 2:
            continue
        per2[x["shop"]] = per2.get(x["shop"], 0) + 1
        print(f"   {x['shop'][:14]:<14} [{x['how']}]")
        print(f"      前: {x['raw'][:78]}")
        print(f"      後: {x['note'][:78]}")
        if sum(per2.values()) >= 30:
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
