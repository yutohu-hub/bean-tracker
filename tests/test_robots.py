"""robots.txt の読み方と、巡回がそれに従うことを確かめる。

守りすぎても壊れる。robots.txt を置いていない店（実測で455店中95店）を
「断り」と読んでしまうと、その95店が図鑑からまるごと消える。
断っている店を通ることと同じくらい、断っていない店を止めることも間違いなので、
両側を試す。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

import crawler                                   # noqa: E402
from crawler import robots_rules, robots_allows, origin_of, path_allowed  # noqa: E402
from diagnose_shop import allowed                # noqa: E402

fails = []


def check(label, got, want):
    if got != want:
        fails.append(f"{label}: {got!r} ≠ {want!r}")


def allows(txt, path):
    return robots_allows(robots_rules(txt), path)


# ---- 断っている ----
check("全部断る", allows("User-agent: *\nDisallow: /", "/products.json"), False)
check("その道だけ断る",
      allows("User-agent: *\nDisallow: /wp-json/", "/wp-json/wc/store/products"), False)

# ---- 断っていない ----
check("空のDisallowは断りではない", allows("User-agent: *\nDisallow:", "/products.json"), True)
check("規則に当たらない", allows("User-agent: *\nDisallow: /admin", "/products.json"), True)
check("robots.txt が空", allows("", "/products.json"), True)

# 他のボット宛ての規則は自分に向いていない。ここを読み違えると、
# GPTBot を断っているだけの店まで巡回が止まる（そういう店は多い）
check("他のボット宛て",
      allows("User-agent: GPTBot\nDisallow: /", "/products.json"), True)
check("他のボットの後に自分宛て",
      allows("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /cart",
             "/products.json"), True)
# User-agent 行が続く形。これは1つのまとまりで、* も断られている
check("まとめて宛てられている",
      allows("User-agent: GPTBot\nUser-agent: *\nDisallow: /", "/products.json"), False)
check("まとまりは規則で切れる",
      allows("User-agent: *\nDisallow: /cart\nUser-agent: GPTBot\nDisallow: /",
             "/products.json"), True)

# ---- Allow が Disallow を上書きする ----
check("長いAllowが勝つ",
      allows("User-agent: *\nDisallow: /\nAllow: /products.json", "/products.json"), True)
check("同じ長さならAllowが勝つ",
      allows("User-agent: *\nDisallow: /a\nAllow: /a", "/a/b"), True)
check("長いDisallowが勝つ",
      allows("User-agent: *\nAllow: /\nDisallow: /wp-json/", "/wp-json/x"), False)

# コメントと大文字小文字
check("コメント付き", allows("User-Agent: *\nDisallow: /x   # なぜか", "/x/y"), False)

# ---- 診断ツールと同じ判定を使っていること ----
# 診断で「★断られている」と出たのに巡回が取りに行く、が起きないための縛り
for txt, path in [("User-agent: *\nDisallow: /", "/items/x"),
                  ("User-agent: *\nDisallow: /admin", "/items/x"),
                  ("User-agent: *\nDisallow: /\nAllow: /items/", "/items/x")]:
    check(f"診断と一致 {path} / {txt.splitlines()[-1]}",
          allowed(txt, path).startswith("★"), not allows(txt, path))

# ---- URL からの判定 ----
check("origin", origin_of("https://shop.example.com/a/b?x=1"), "https://shop.example.com")
check("originが取れない", origin_of("example.com"), "")

crawler._ROBOTS.clear()
check("読んでいない店は通す", path_allowed("https://a.example/products.json"), True)

crawler._ROBOTS["https://a.example"] = robots_rules("User-agent: *\nDisallow: /wp-json/")
check("断られている道", path_allowed("https://a.example/wp-json/wc/store/products"), False)
check("断られていない道", path_allowed("https://a.example/products.json"), True)
check("別のホストは別の robots", path_allowed("https://b.example/wp-json/x"), True)

# robots.txt が読めなかった店（空の規則）は通す
crawler._ROBOTS["https://c.example"] = []
check("robots.txt が無い店は通す", path_allowed("https://c.example/products.json"), True)
crawler._ROBOTS.clear()


# ---- 巡回そのものが断りを守り、断りを理由として残すこと ----
#
# 判定が正しいことと、判定が取得経路に効いていることは別の話。
# 実測（runner, 該当3店）では止まってはいたが、理由が
# 「sitemapに商品ページが無い」になっていた。在りもしない sitemap の
# 不具合を探させることになるので、ここで理由まで縛る。
import asyncio  # noqa: E402


class Resp:
    def __init__(self, text, status=200):
        self.text, self.status_code = text, status
        self.content = text.encode()


class Shop:
    """全部断る店。何を取りに来たかを記録する。"""

    def __init__(self, robots):
        self.robots, self.asked = robots, []

    async def get(self, url, params=None):
        self.asked.append(url)
        if url.endswith("/robots.txt"):
            return Resp(self.robots)
        return Resp("<urlset><url><loc>https://z.example/products/a</loc></url></urlset>")


crawler._ROBOTS.clear()
crawler._REFUSED.clear()
shop = Shop("User-agent: *\nDisallow: /")
r = {"name": "断る店", "url": "https://z.example", "country": "JP", "currency": "JPY"}
_, res = asyncio.run(crawler.crawl_roaster(shop, r, 2, asyncio.Semaphore(1)))

check("断る店から商品を取らない", res, None)
check("robots.txt は読みに行く", "https://z.example/robots.txt" in shop.asked, True)
check("断られた道は叩かない",
      [u for u in shop.asked if not u.endswith("/robots.txt")], [])
check("理由が断りとして残る",
      "robots.txt" in crawler.LAST_REASON.get("断る店", ""), True)

# 断っていない店では、今までどおり取りに行く
crawler._ROBOTS.clear()
crawler._REFUSED.clear()
crawler.LAST_REASON.pop("断らない店", None)
shop2 = Shop("User-agent: *\nDisallow: /admin")
asyncio.run(crawler.crawl_roaster(
    shop2, {**r, "name": "断らない店"}, 2, asyncio.Semaphore(1)))
check("断らない店は叩きに行く",
      any(not u.endswith("/robots.txt") for u in shop2.asked), True)
check("断らない店に断りの理由をつけない",
      "robots.txt" in crawler.LAST_REASON.get("断らない店", ""), False)

crawler._ROBOTS.clear()
crawler._REFUSED.clear()

if fails:
    print("✗ robots.txt の判定")
    for f in fails:
        print("   " + f)
    raise SystemExit(1)
print("✓ robots.txt の判定と、巡回がそれに従うこと 30件")
