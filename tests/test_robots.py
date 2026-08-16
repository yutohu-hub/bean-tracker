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

if fails:
    print("✗ robots.txt の判定")
    for f in fails:
        print("   " + f)
    raise SystemExit(1)
print("✓ robots.txt の判定 24件")
