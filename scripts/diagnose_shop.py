"""巡回できない店について、何が足りないのかを実際に叩いて調べる。

  python scripts/diagnose_shop.py https://lucentcoffee.stores.jp

probe_roasters.py は「取れる／取れない」しか言わない。取れないと分かったあと、
sitemap が無いのか、商品ページの形が違うのか、そもそも中身が JavaScript で
後から入るのかを知るには、応答そのものを見るしかない。
開発環境からは外に出られないので、ネットのある runner で走らせる。

出すのは事実だけ。どう直すかはこの結果を見てから決める。
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from crawler import (REQ_HEADERS, _SITEMAPS, _PROD_URL, _LD_BLOCK,  # noqa: E402
                     robots_rules, robots_match)

# 巡回の見出しは products.json 用で Accept が JSON になっている。
# HTML のページに JSON を求めると、食い違いを見て 403 を返す作りの店がある。
# 「断られている」のか「求め方が悪い」のかを分けるため、両方で叩いて並べる。
HTML_HEADERS = dict(REQ_HEADERS, **{
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Upgrade-Insecure-Requests": "1",
})

# 商品ページへのリンクらしきもの。sitemap が無い店では、一覧ページの
# <a href> から拾えるかどうかが次の手がかりになる。
_HREF = re.compile(r'href="([^"]+)"')


def allowed(robots: str, path: str) -> str:
    """その道を通っていいかを、人が読む文で返す。

    判定そのものは巡回の本体（crawler.robots_match）と同じものを使う。
    診断と巡回で答えが食い違うと、診断を見て直したのに巡回が変わらない、
    という一番たちの悪い形になる。
    """
    kind, rule = robots_match(robots_rules(robots), path)
    if not kind:
        return "断られていない（規則に当たらない）"
    if kind == "allow":
        return f"許されている（Allow: {rule}）"
    return f"★断られている（Disallow: {rule}）"


def show(label: str, resp: httpx.Response | None, head: int = 220) -> None:
    if resp is None:
        print(f"  {label:<34} 届かない")
        return
    body = (resp.text or "").strip().replace("\n", " ")
    print(f"  {label:<34} {resp.status_code}  {len(resp.content):>7} bytes  {body[:head]}")


def show2(label: str, a: httpx.Response | None, b: httpx.Response | None,
          head: int = 120) -> None:
    """JSON を求めた場合と HTML を求めた場合を並べる。

    片方だけ 403 なら、店が断っているのではなく、こちらの求め方が
    合っていないだけ。両方 403 なら店側で弾かれている。
    """
    sa = "届かない" if a is None else str(a.status_code)
    sb = "届かない" if b is None else str(b.status_code)
    mark = "  ←求め方の違いで変わる" if sa != sb else ""
    body = "" if b is None else (b.text or "").strip().replace("\n", " ")[:head]
    print(f"  {label:<30} JSONで{sa:>8} / HTMLで{sb:>8}{mark}  {body}")


def get(client: httpx.Client, url: str) -> httpx.Response | None:
    try:
        return client.get(url)
    except httpx.HTTPError as e:
        print(f"    ({type(e).__name__})")
        return None


def main() -> None:
    base = (sys.argv[1] if len(sys.argv) > 1 else "").rstrip("/")
    if not base:
        print("URL を指定してください")
        raise SystemExit(2)
    print(f"調べる店: {base}\n")

    with httpx.Client(headers=REQ_HEADERS, timeout=20, follow_redirects=True) as c, \
         httpx.Client(headers=HTML_HEADERS, timeout=20, follow_redirects=True) as h:
        print("■ robots.txt")
        r = get(c, f"{base}/robots.txt")
        if r is None or r.status_code != 200:
            show("robots.txt", r, 200)
        else:
            # 全文を出す。店が何を断っているかは、こちらの都合で要約してはいけない
            print(f"  {r.status_code} / {len(r.content)} bytes")
            for line in r.text.splitlines():
                if line.strip():
                    print(f"    {line.rstrip()}")
            print("\n  → 巡回が実際に叩く道の可否")
            for path in ("/products.json", "/collections/all.atom",
                         "/wp-json/wc/store/products", "/sitemap.xml",
                         "/meta.json", "/cart.js", "/items/x", "/"):
                print(f"      {path:<30} {allowed(r.text, path)}")

        # 403 が返るとき、店が弾いているのか、こちらの求め方が合っていないのかを
        # 分けないと打つ手が決まらない。両方の見出しで叩いて並べる。
        print("\n■ 巡回がいま試している sitemap（求め方を変えて比べる）")
        for p in _SITEMAPS:
            show2(p, get(c, f"{base}{p}"), get(h, f"{base}{p}"))

        print("\n■ よくある置き場所（試していないもの）")
        for p in ("/sitemap-index.xml", "/sitemaps.xml", "/sitemap1.xml",
                  "/sitemap/sitemap.xml", "/wp-sitemap.xml"):
            show2(p, get(c, f"{base}{p}"), get(h, f"{base}{p}"))

        print("\n■ 商品APIの形（Shopify / WooCommerce）")
        for p in ("/products.json?limit=1", "/collections/all/products.json?limit=1",
                  "/wp-json/wc/store/products?per_page=1", "/meta.json", "/cart.js"):
            show2(p, get(c, f"{base}{p}"), get(h, f"{base}{p}"), 100)

        print("\n■ トップページ（求め方を変えて比べる）")
        show2("/", get(c, base), get(h, base))
        top = get(h, base)
        show("/", top, 120)
        if top is not None and top.status_code == 200:
            html = top.text
            hrefs = [h for h in _HREF.findall(html)]
            prod = [h for h in hrefs if _PROD_URL.search(h.split("?")[0])]
            print(f"  リンク {len(hrefs)} 本 / うち商品ページらしいもの {len(prod)} 本")
            for h in list(dict.fromkeys(prod))[:6]:
                print(f"    {h}")
            lds = _LD_BLOCK.findall(html)
            print(f"  JSON-LD のブロック: {len(lds)} 個")
            for b in lds[:2]:
                print(f"    {b.strip()[:180]}")
            # 中身が後から入る作りかどうかの目安
            spa = "あり" if re.search(r'id="(app|root|__nuxt)"', html) else "なし"
            nxt = "あり" if "__NEXT_DATA__" in html else "なし"
            print(f"  HTML の大きさ: {len(html):,} 文字 / __NEXT_DATA__: {nxt} / id=app,root: {spa}")

            # 商品ページが1本でも見つかれば、そこに JSON-LD があるかまで見る
            if prod:
                u = prod[0] if prod[0].startswith("http") else base + prod[0]
                print(f"\n■ 商品ページ1枚: {u}")
                pr = get(c, u)
                if pr is not None and pr.status_code == 200:
                    lds2 = _LD_BLOCK.findall(pr.text)
                    print(f"  JSON-LD のブロック: {len(lds2)} 個")
                    for b in lds2[:3]:
                        print(f"    {b.strip()[:300]}")
                    if not lds2:
                        m = re.search(r'<meta[^>]+og:title[^>]+content="([^"]*)"', pr.text)
                        print(f"  og:title: {m.group(1) if m else 'なし'}")


if __name__ == "__main__":
    main()
