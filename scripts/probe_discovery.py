"""「商品ページが見つからない」の中身を、店ごとに分けて数える。

  python scripts/probe_discovery.py config/candidates-zero-beans.yaml

巡回の失敗理由は「sitemapに商品ページが無い」の一文にまとまっている。
だがこれは少なくとも4つの別の状態を1つにしている。

  1. sitemap がそもそも無い（404）
  2. sitemap はあるが、商品ページのURLが1本も載っていない
  3. sitemap に商品ページはあるが、こちらのURLの形（_PROD_URL）に当たらない
  4. 店ごと 403 で、どの道も開かない

どれが多いかで打つ手が変わる。1と2なら一覧ページの <a href> から拾う手が効く。
3ならURLの形を広げる。4は取りようがない。
まとめて1つの原因だと決めてかかると、直したのに数が動かない。

あわせて、一覧ページから拾えた商品ページに JSON-LD があるかまで見る。
リンクが拾えても中身が無ければ、拾う手を足しても豆は増えない。

出すのは事実だけ。どう直すかはこの結果を見てから決める。
"""
from __future__ import annotations
import asyncio
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

import httpx
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from crawler import (REQ_HEADERS, HTML_HEADERS, _SITEMAPS, _LOC,  # noqa: E402
                     _PROD_URL, _SKIP_URL, _LD_BLOCK, _ld_products,
                     robots_rules, robots_allows)

_HREF = re.compile(r'href="([^"]+)"')
TIMEOUT = 12


async def get(client, url):
    try:
        return await client.get(url)
    except httpx.HTTPError:
        return None


async def look(sem, r) -> dict:
    """1店ぶんの事実。数えるだけで、直し方の判断はしない。"""
    base = r["url"].rstrip("/")
    out = {"name": r["name"], "base": base, "robots": "", "sitemap": 0,
           "locs": 0, "sm_prod": 0, "top": 0, "top_prod": 0, "ld": ""}
    async with sem:
        async with httpx.AsyncClient(headers=REQ_HEADERS, timeout=TIMEOUT,
                                     follow_redirects=True) as c, \
                   httpx.AsyncClient(headers=HTML_HEADERS, timeout=TIMEOUT,
                                     follow_redirects=True) as ch:
            rb = await get(c, f"{base}/robots.txt")
            rules = robots_rules(rb.text) if rb is not None and rb.status_code == 200 else []
            out["robots"] = "断り" if not robots_allows(rules, "/sitemap.xml") else ""

            # 1〜3 を分ける: sitemap が開けたか / <loc> が何本か / 商品の形が何本か
            for p in _SITEMAPS:
                resp = await get(c, f"{base}{p}")
                if resp is None or resp.status_code != 200 or "<loc" not in resp.text:
                    continue
                out["sitemap"] = resp.status_code
                locs = [urljoin(f"{base}{p}", x.strip()) for x in _LOC.findall(resp.text)]
                # 商品のsitemapが入れ子になっている形も1段だけ追う
                for sub in [u for u in locs if u.endswith(".xml")][:4]:
                    s2 = await get(c, sub)
                    if s2 is not None and s2.status_code == 200:
                        locs += [urljoin(sub, x.strip()) for x in _LOC.findall(s2.text)]
                locs = [u for u in locs if not u.endswith(".xml")]
                out["locs"] = len(locs)
                out["sm_prod"] = sum(1 for u in locs
                                     if _PROD_URL.search(u) and not _SKIP_URL.search(u))
                if out["sm_prod"]:
                    break

            # 4 と、一覧ページから拾える見込み
            top = await get(ch, base)
            if top is None:
                return out
            out["top"] = top.status_code
            if top.status_code != 200:
                return out
            hrefs = [urljoin(base + "/", h) for h in _HREF.findall(top.text)]
            prod = [u for u in dict.fromkeys(hrefs)
                    if u.startswith(base) and _PROD_URL.search(u.split("?")[0])
                    and not _SKIP_URL.search(u)]
            out["top_prod"] = len(prod)
            if prod:
                pr = await get(ch, prod[0])
                if pr is not None and pr.status_code == 200:
                    out["ld"] = "あり" if _ld_products(pr.text) else "なし"
    return out


def verdict(o: dict) -> str:
    """その店が今どの状態にあるかを、ひとことで。"""
    if o["robots"]:
        return "robots.txtで断られている"
    if o["top"] and o["top"] != 200:
        return f"トップが{o['top']}（店ごと弾かれている）"
    if not o["top"]:
        return "つながらない"
    if o["sm_prod"]:
        return "sitemapに商品はある（別の理由で落ちている）"
    if o["top_prod"] and o["ld"] == "あり":
        return "★一覧から拾えば取れる"
    if o["top_prod"] and o["ld"] == "なし":
        return "一覧から拾えるが商品ページにJSON-LDが無い"
    if o["sitemap"] and o["locs"]:
        return "sitemapはあるが商品ページが載っていない"
    if o["sitemap"]:
        return "sitemapが空"
    return "sitemapが無く、一覧にも商品リンクが無い"


async def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else "config/candidates-zero-beans.yaml"
    cfg = yaml.safe_load(open(ROOT / path, encoding="utf-8"))
    rs = cfg["roasters"]
    sem = asyncio.Semaphore(12)
    print(f"{len(rs)}店を調べる（{path}）\n")
    res = await asyncio.gather(*[look(sem, r) for r in rs])

    print(f"{'店':<30} {'sitemap':>7} {'<loc>':>6} {'商品':>5} "
          f"{'top':>4} {'一覧の商品':>6} {'JSON-LD':>7}  状態")
    tally: dict[str, int] = {}
    for o in sorted(res, key=lambda x: x["name"]):
        v = verdict(o)
        tally[v] = tally.get(v, 0) + 1
        print(f"{o['name'][:29]:<30} {o['sitemap'] or '-':>7} {o['locs']:>6} "
              f"{o['sm_prod']:>5} {o['top'] or '-':>4} {o['top_prod']:>6} "
              f"{o['ld'] or '-':>7}  {v}")

    print("\n" + "=" * 68)
    for v, n in sorted(tally.items(), key=lambda x: -x[1]):
        print(f"  {n:>4}店  {v}")
    rescue = tally.get("★一覧から拾えば取れる", 0)
    print(f"\n一覧ページから拾う手を足すと取れるようになる店: {rescue}店 / {len(rs)}店")


if __name__ == "__main__":
    asyncio.run(main())
