"""巡回が、店の書いた「種類」を読んで豆かどうかを決められることを確かめる。

  python tests/test_looks_like_coffee.py

店は product_type や tags に、自分が何を売っているかを書いてくれている。
こちらが名前から推し量るより確かで、言語にも左右されない
（中国語の店でも product_type は英語のことが多い）。

前は7語だけと照合していたので、次のものが素通りしていた。
どれも runner で店のページを叩いて確かめた実物。

  Four Barrel の絵画9点 … product_type "Arts & Entertainment"
                          説明は「96" x 96"  Mixed media on panel  $6,500」
  Tiong Hoe のマシン    … product_type "Espresso Machine"、売主 Dalla Corte
  Joe Coffee の講座2件  … tags "Classes"、説明は「16-hour, 3-day intensive」

「Espresso Machine」を落として「Espresso」を残す、という線引きが要になるので
そこを重点的に見る。
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from crawler import _looks_like_coffee  # noqa: E402

# (product_type, tags, 通すべきか, 説明)
CASES = [
    # --- 落とすもの。runner で店の申告を確かめた実物 ---
    ("Arts & Entertainment", ["art"], False, "Four Barrel の絵画"),
    ("Espresso Machine", [], False, "Tiong Hoe のマシン"),
    ("", ["Classes", "imported"], False, "Joe Coffee の講座（種類は空でタグだけ）"),
    # --- 落とすもの。従来からの分類 ---
    ("Gear", [], False, "器具"),
    ("Merch", [], False, "グッズ"),
    ("Gift Card", [], False, "ギフトカード"),
    ("Subscription", [], False, "定期便"),
    # --- 落とすもの。今回広げたぶん ---
    ("Grinder", [], False, "グラインダー"),
    ("Books", [], False, "書籍"),
    ("Workshop", [], False, "講座"),
    ("Tea", [], False, "紅茶"),
    ("Drinkware", [], False, "カップ類"),
    ("Home & Garden", [], False, "雑貨"),
    ("Cleaning", [], False, "洗浄剤"),
    # --- 通すもの。ここを落とすと本物の豆が消える ---
    ("Coffee", ["ethiopia"], True, "ふつうの豆"),
    ("", [], True, "何も書かれていない（分からないものは落とさない）"),
    ("Espresso", [], True, "エスプレッソ用の豆（"'"'"Espresso Machine"'"'" と取り違えない）"),
    ("Whole Bean Coffee", [], True, "Whole Bean Coffee"),
    ("Roasted Coffee", [], True, "Roasted Coffee"),
    ("Single Origin", [], True, "シングルオリジン"),
    ("Coffee Beans", [], True, "Coffee Beans"),
    ("Filter Coffee", [], True, "フィルター用の豆"),
    ("Coffee", ["equipment-friendly"], True, "タグが完全一致しない語を含むだけ"),
]


def run() -> None:
    ng = 0
    for ptype, tags, want, label in CASES:
        got = _looks_like_coffee({"product_type": ptype, "tags": tags})
        mark = "✓" if got == want else "✗"
        if got != want:
            ng += 1
        shown = ptype or "(なし)"
        print(f"  {mark} {label:<44} 種類={shown:<22} → {'通す' if got else '落とす'}")
    if ng:
        print(f"\n★ {ng} 件おかしい。店の申告の読み方が広すぎるか、狭すぎる。")
        raise SystemExit(1)
    print(f"\n{len(CASES)} 件すべて期待どおり。")


if __name__ == "__main__":
    run()
