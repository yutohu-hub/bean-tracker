"""巡回している店のうち、robots.txt で断られている店を数える。

  python scripts/audit_robots.py          全店
  python scripts/audit_robots.py 60       先頭60店

■ なぜ要るのか

診断ツール（scripts/diagnose_shop.py）にはこう書いてある。

    店が robots.txt で断っているものを、こちらの都合で取りに行かない。
    技術的に取れるかどうかより先に、取っていいかどうかを見る。

ところが巡回の本体（src/crawler.py）は robots.txt を1度も読んでいない。
方針が書かれているのに、455店を毎時叩いている側には入っていない。

直す前に、何店が該当するかを数える。「断られている店が0店」なら
黙って入れればよく、「100店」なら図鑑からその店の豆が消えることになる。
どちらなのかを知らずに変えると、気づかないうちに図鑑が痩せる。

■ 何を見るか

巡回が実際に叩く道を、店の robots.txt に照らす。

    /products.json                  Shopify
    /collections/all.atom           Shopify（フィード）
    /wp-json/wc/store/products      WooCommerce
    /sitemap.xml                    それ以外（商品ページを探す道）
"""
from __future__ import annotations
import asyncio
import sys
from pathlib import Path

import httpx
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))
from crawler import REQ_HEADERS  # noqa: E402
from diagnose_shop import allowed  # noqa: E402  同じ判定を使う（写しを作らない）

CONCURRENCY = 6
TIMEOUT = 10.0
PATHS = ["/products.json", "/collections/all.atom",
         "/wp-json/wc/store/products", "/sitemap.xml"]


async def one(client, sem, r):
    base = r["url"].rstrip("/")
    async with sem:
        try:
            resp = await client.get(f"{base}/robots.txt")
        except httpx.HTTPError as e:
            return r["name"], f"取れない({type(e).__name__})", {}
    if resp.status_code != 200:
        return r["name"], f"robots.txt なし(HTTP {resp.status_code})", {}
    txt = resp.text
    # HTML が返る店は robots.txt を置いていない（404ページ）
    if "<html" in txt[:400].lower():
        return r["name"], "robots.txt なし(HTMLが返る)", {}
    return r["name"], "", {p: allowed(txt, p) for p in PATHS}


async def run(shops):
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(headers=REQ_HEADERS, timeout=TIMEOUT,
                                 follow_redirects=True) as client:
        got = await asyncio.gather(*(one(client, sem, r) for r in shops))

    have = [g for g in got if not g[1]]
    print(f"調べた店 {len(got)} 軒 / robots.txt があった {len(have)} 軒\n")

    # allowed() は日本語の文で返す。断られているものだけ「★断られている」で始まる
    blocked = {}
    for name, _, verdict in have:
        bad = [p for p, v in verdict.items() if v.startswith("★")]
        if bad:
            blocked[name] = bad
    print(f"■ 巡回している道を断っている店: {len(blocked)} 軒")
    for name, paths in list(blocked.items())[:40]:
        print(f"   {name[:28]:<28} {', '.join(paths)}")

    print("\n■ 道ごとの内わけ")
    for p in PATHS:
        n = sum(1 for name, _, v in have if p in blocked.get(name, []))
        print(f"   {p:<32} 断られている {n} 軒")

    print("\n■ robots.txt が読めなかった店")
    why = {}
    for name, w, _ in got:
        if w:
            why[w] = why.get(w, 0) + 1
    for w, n in sorted(why.items(), key=lambda kv: -kv[1]):
        print(f"   {w:<32} {n} 軒")


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    n = int(args[0]) if args else 0
    cfg = yaml.safe_load((ROOT / "config" / "roasters.yaml").read_text(encoding="utf-8"))
    shops = [r for r in cfg.get("roasters", []) if r.get("url")]
    if n:
        shops = shops[:n]
    asyncio.run(run(shops))


if __name__ == "__main__":
    main()
