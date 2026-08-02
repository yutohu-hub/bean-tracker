"""取れていない店が、どのECを使っているのかを調べる。

図鑑に並ぶ436軒のうち176軒（40%）は豆が1件も出ていない。巡回ログを見ると
理由は「/products.json → HTTP 403 / 404 / JSONではない応答」などで、
つまり Shopify でも WooCommerce でもない店に当たっている可能性が高い。
どの店が何を使っているか分からないままでは、対応を書く先が決められない。

開発環境からは店に到達できないので、ネットワークのある runner で走らせる。
巡回と同じ経路で取得を試し、失敗した店だけトップページを見て素性を推定する。

  python scripts/diag_platform.py --shard 0/13    # 巡回と同じ分割
  python scripts/diag_platform.py --hosts a.com b.com

読むだけで、何も書き換えない。
"""
from __future__ import annotations
import asyncio
import collections
import re
import sys
from pathlib import Path

import httpx
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from crawler import REQ_HEADERS, LAST_REASON, _fetch_any  # noqa: E402

# トップページのHTMLに出る、そのECに特有の文字列。
# 上から順に見て最初に当たったものを採用する（Shopify系は他より特徴が強い）。
SIGNS: list[tuple[str, str]] = [
    ("Shopify", r"cdn\.shopify\.com|Shopify\.theme|shopify-features"),
    ("BASE", r"base\.ec|thebase\.in|base-ec2?\.akamaized"),
    ("STORES.jp", r"stores\.jp|storesstatic"),
    ("Squarespace", r"squarespace\.com|static1\.squarespace"),
    ("Wix", r"wixstatic\.com|_wixCIDX|wix\.com"),
    ("BigCommerce", r"bigcommerce\.com"),
    ("Square Online", r"square(up)?\.com|squarecdn\.com"),
    ("EC-CUBE", r"ec-cube|eccube"),
    ("カラーミー", r"colorme|shop-pro\.jp"),
    ("MakeShop", r"makeshop\.jp"),
    ("futureshop", r"future-shop\.jp|fs-storage"),
    ("Magento", r"Magento|mage-init"),
    ("PrestaShop", r"prestashop"),
    ("WooCommerce", r"woocommerce"),
    ("WordPress", r"wp-content|wp-json"),
]

PROBES = [
    ("products.json", "/products.json"),
    ("all.atom", "/collections/all.atom"),
    ("wc-store", "/wp-json/wc/store/v1/products"),
]


def norm(url: str) -> str:
    u = (url or "").strip()
    return u if u.startswith("http") else f"https://{u}"


async def fingerprint(client: httpx.AsyncClient, url: str) -> dict:
    """トップページと3つの入口を見て、素性と到達性を返す。"""
    out = {"platform": "不明", "top": "", "final": "", "probe": {}}
    try:
        r = await client.get(url)
        out["top"] = f"HTTP {r.status_code}"
        out["final"] = str(r.url)
        body = r.text[:400_000]
        for name, pat in SIGNS:
            if re.search(pat, body, re.I):
                out["platform"] = name
                break
    except httpx.HTTPError as e:
        out["top"] = type(e).__name__
    for label, path in PROBES:
        try:
            p = await client.get(f"{url.rstrip('/')}{path}", params={"limit": 1})
            ct = (p.headers.get("content-type") or "").split(";")[0]
            out["probe"][label] = f"{p.status_code} {ct}"
        except httpx.HTTPError as e:
            out["probe"][label] = type(e).__name__
    return out


async def check(client, sem, r: dict) -> tuple[dict, list | None, dict | None]:
    async with sem:
        got = await _fetch_any(client, r, 1)
        if got:
            return r, got, None
        return r, None, await fingerprint(client, norm(r["url"]))


async def main() -> None:
    cfg = yaml.safe_load((ROOT / "config" / "roasters.yaml").read_text(encoding="utf-8"))
    roasters = cfg["roasters"]
    if "--shard" in sys.argv:
        i, n = (int(x) for x in sys.argv[sys.argv.index("--shard") + 1].split("/", 1))
        roasters = roasters[i % max(1, n)::max(1, n)]
    if "--hosts" in sys.argv:
        want = {h.replace("www.", "").lower() for h in sys.argv[sys.argv.index("--hosts") + 1:]
                if not h.startswith("--")}
        roasters = [r for r in roasters
                    if re.sub(r"^https?://", "", r["url"]).strip("/").replace("www.", "").lower() in want]

    print(f"調べる店: {len(roasters)}軒\n")
    sem = asyncio.Semaphore(4)
    tally: collections.Counter = collections.Counter()
    ok = 0
    async with httpx.AsyncClient(headers=REQ_HEADERS, timeout=httpx.Timeout(20),
                                 follow_redirects=True) as client:
        for coro in asyncio.as_completed([check(client, sem, r) for r in roasters]):
            r, got, fp = await coro
            if got:
                ok += 1
                tally["取得できている"] += 1
                continue
            tally[fp["platform"]] += 1
            probes = " ".join(f"{k}:{v}" for k, v in fp["probe"].items())
            print(f"✗ {r['name'][:26]:28s} {fp['platform']:<12} top:{fp['top']:<12} {probes}")
            print(f"   巡回の理由: {LAST_REASON.get(r['name'], '不明')}")
            if fp["final"] and norm(r["url"]).rstrip("/") not in fp["final"]:
                print(f"   → 転送先: {fp['final']}")

    print(f"\n取得できている {ok} / {len(roasters)}")
    for name, n in tally.most_common():
        print(f"  {name:<16} {n}軒")


if __name__ == "__main__":
    asyncio.run(main())
