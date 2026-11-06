"""店の「これはコーヒーではない」という申告の読み方。

肝は、強い否定（器具・雑貨・講座）と弱い否定（tea / food / beverage）を
混ぜないこと。弱い方まで否定に使うと、豆をそこに置いている店の豆が消える。
消えたことは画面を見ても分からない（無い物は見えない）ので、ここで縛る。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from crawler import shop_denies_hard, shop_says  # noqa: E402

fails = []


def check(label, got, want):
    if got != want:
        fails.append(f"{label}: {got!r} ≠ {want!r}")


def p(ptype="", tags=None):
    return {"product_type": ptype, "tags": tags or []}


# ---- はっきり否定している ----
for t in ("Equipment", "Brewing Equipment", "Merch", "Apparel", "Drinkware",
          "Gift Card", "Subscription", "Class", "Workshop", "Book", "Poster",
          "Grinder", "Kettle", "Scale", "Cleaning"):
    check(f"否定 {t}", shop_denies_hard(p(t)), True)

check("大文字小文字は問わない", shop_denies_hard(p("EQUIPMENT")), True)
check("タグでの否定", shop_denies_hard(p("", ["merch"])), True)
check("タグは完全一致で見る（artisan を art で拾わない）",
      shop_denies_hard(p("", ["artisan"])), False)

# ---- 否定していない ----
check("コーヒー", shop_denies_hard(p("Coffee")), False)
check("何も書いていない", shop_denies_hard(p("")), False)
check("豆", shop_denies_hard(p("Whole Bean Coffee")), False)

# ---- 弱い否定はここでは否定にしない ----
# 店によっては豆を Food や Beverage に置く。ここで落とすと豆が消える
for t in ("Tea", "Food", "Beverage", "Chocolate", "Bakery", "Homeware", "Kitchen"):
    check(f"弱い否定は使わない {t}", shop_denies_hard(p(t)), False)
    # ただし shop_says の側では今までどおり "x" として扱われる（挙動を変えていない）
    check(f"shop_says では x のまま {t}", shop_says(p(t)), "x")

if fails:
    print("✗ 店の否定の読み方")
    for f in fails:
        print("   " + f)
    raise SystemExit(1)
print(f"✓ 店の否定の読み方 {15 + 4 + 3 + 14} 件")
