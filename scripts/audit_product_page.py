"""商品ページのHTMLを直接読むと、情報シートの空欄が埋まるかを実測する。

  python scripts/audit_product_page.py           既定（20店 × 6商品）
  python scripts/audit_product_page.py 30 8      30店 × 8商品

■ なぜ試すのか

いまは products.json（title / tags / body_html）だけを見ている。
実測では、本文を最後まで読んでも産地26.5%・精製35.0%・風味69.1%が空欄だった。
ただし Shopify の商品ページには、body_html に入らない情報が載ることがある。
メタフィールドで作った「産地 / 標高 / 品種 / 精製」の表がその典型で、
JSON には出てこない。

そこで、同じ商品について
  A. products.json の本文から取れるもの
  B. 商品ページのHTMLから取れるもの
を並べ、Bで何件増えるかを数える。

■ 増えた数だけ見てはいけない

商品ページには、ヘッダー・フッター・「他のおすすめ」まで入っている。
そこに別の豆の産地名があれば、無関係な商品にエチオピアが付く。
増えた数と一緒に、**AとBが食い違った数**も出す。
食い違いが多ければ、ページ全体を読むやり方は使えない。
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
                     html_to_text, extract_notes, has_bean_evidence,
                     _looks_like_coffee, DEEP_CHARS)

CONCURRENCY = 6
TIMEOUT = 20.0


async def get(client, sem, url, params=None):
    async with sem:
        try:
            r = await client.get(url, params=params or {})
        except httpx.HTTPError:
            return None
    return r if r.status_code == 200 else None


async def one_shop(client, sem, r, per_shop):
    base = r["url"].rstrip("/")
    resp = await get(client, sem, f"{base}/products.json", {"limit": 60})
    if resp is None:
        return []
    try:
        prods = resp.json().get("products", []) or []
    except ValueError:
        return []

    beans = [p for p in prods if has_bean_evidence(p) and _looks_like_coffee(p)]
    out = []
    for p in beans[:per_shop]:
        handle = p.get("handle") or ""
        if not handle:
            continue
        page = await get(client, sem, f"{base}/products/{handle}")
        if page is None:
            continue
        out.append((r["name"], p, page.text))
    return out


def compare(p: dict, page_html: str) -> dict:
    tags = p.get("tags") or []
    tagtext = " ".join(tags) if isinstance(tags, list) else str(tags)
    text = f"{p.get('title', '')} {tagtext}"
    body = html_to_text(p.get("body_html") or "")[:DEEP_CHARS]

    a_o = _guess_origin(text) or _guess_origin(f"{text} {body}")
    a_p = _guess_process(text) or _guess_process(f"{text} {body}")
    a_n = extract_notes(p.get("body_html") or "", p.get("title", ""))

    page = html_to_text(page_html)
    b_o = _guess_origin(text) or _guess_origin(f"{text} {page}")
    b_p = _guess_process(text) or _guess_process(f"{text} {page}")
    b_n = a_n or extract_notes(page_html, p.get("title", ""))

    return {"title": (p.get("title") or "")[:40], "page_len": len(page),
            "a_o": a_o, "b_o": b_o, "a_p": a_p, "b_p": b_p, "a_n": a_n, "b_n": b_n}


async def run(shops, per_shop):
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(headers=REQ_HEADERS, timeout=TIMEOUT,
                                 follow_redirects=True) as client:
        got = await asyncio.gather(*(one_shop(client, sem, r, per_shop) for r in shops))
    items = [x for g in got for x in g]
    if not items:
        print("商品ページを1件も取れなかった")
        return

    rows = [(name, compare(p, html)) for name, p, html in items]
    n = len(rows)
    print(f"商品ページを読めた {n} 件 / 店 {len({name for name, _ in rows})} 軒")
    lens = sorted(x["page_len"] for _, x in rows)
    print(f"ページの文字数 中央値 {lens[len(lens) // 2]}字\n")

    def c(f):
        return sum(1 for _, x in rows if f(x))

    print("■ products.json だけで空欄だった数")
    print(f"  産地 {c(lambda x: not x['a_o']):>4} / 精製 {c(lambda x: not x['a_p']):>4}"
          f" / 風味 {c(lambda x: not x['a_n']):>4}   （{n}件中）")

    print("\n■ 商品ページを読むと埋まる数")
    print(f"  産地 +{c(lambda x: not x['a_o'] and x['b_o'])}"
          f" / 精製 +{c(lambda x: not x['a_p'] and x['b_p'])}"
          f" / 風味 +{c(lambda x: not x['a_n'] and x['b_n'])}")

    # ここが本番。食い違うということは、ページの別の場所を読んでいる
    dis_o = [(nm, x) for nm, x in rows if x["a_o"] and x["b_o"] and x["a_o"] != x["b_o"]]
    dis_p = [(nm, x) for nm, x in rows if x["a_p"] and x["b_p"] and x["a_p"] != x["b_p"]]
    print("\n■ もともと取れていたものと食い違った数（多ければこのやり方は使えない）")
    print(f"  産地 {len(dis_o)} 件 / 精製 {len(dis_p)} 件")
    for nm, x in (dis_o + dis_p)[:10]:
        print(f"   {nm[:16]:<16} {x['title']:<40} JSON={x['a_o']}/{x['a_p']} → ページ={x['b_o']}/{x['b_p']}")

    print("\n■ 埋まった例")
    shown = 0
    for nm, x in rows:
        if shown >= 12:
            break
        got_new = []
        if not x["a_o"] and x["b_o"]:
            got_new.append(f"産地={x['b_o']}")
        if not x["a_p"] and x["b_p"]:
            got_new.append(f"精製={x['b_p']}")
        if not x["a_n"] and x["b_n"]:
            got_new.append(f"風味={x['b_n'][:30]}")
        if got_new:
            print(f"   {nm[:16]:<16} {x['title']:<40} → {' / '.join(got_new)}")
            shown += 1


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    shops_n = int(args[0]) if args else 20
    per_shop = int(args[1]) if len(args) > 1 else 6
    cfg = yaml.safe_load((ROOT / "config" / "roasters.yaml").read_text(encoding="utf-8"))
    shops = [r for r in cfg.get("roasters", []) if r.get("url")][:shops_n]
    print(f"調べる店 {len(shops)} 軒 × 商品 {per_shop} 件（{CONCURRENCY}並行）\n")
    asyncio.run(run(shops, per_shop))


if __name__ == "__main__":
    main()
