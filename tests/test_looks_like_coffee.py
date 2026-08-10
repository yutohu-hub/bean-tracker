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
#
# 分類名は実在のものだけを使う。scripts/audit_product_types.py を runner で走らせ、
# 巡回対象の店が実際に何と書いているかを数えて拾った（商品6,000件ぶん）。
# 想像で書いた分類でテストしても、本物の店に当たらない。
CASES = [
    # --- 落とす。runner で店の申告を確かめた実物 ---
    ("Arts & Entertainment", ["art"], False, "Four Barrel の絵画"),
    ("Espresso Machine", [], False, "Tiong Hoe のマシン"),
    ("", ["Classes", "imported"], False, "Joe Coffee の講座（種類は空でタグだけ）"),
    # --- 落とす。集計で数の多かった分類 ---
    ("Brewing Tools", [], False, "器具（36件）"),
    ("Apparel", [], False, "衣類（35件）"),
    ("Equipments", [], False, "器具（35件）"),
    ("Brew Gear", [], False, "器具（23件）"),
    ("Coffee Tools", [], False, "コーヒー用の道具（21件）"),
    ("Accessories", [], False, "小物（19件）"),
    ("training", [], False, "研修（19件）"),
    ("Subscription", [], False, "定期便（18件）"),
    ("brewing equipment", [], False, "器具（17件）"),
    ("Chocolate", [], False, "チョコレート（14件）"),
    ("merchandise", [], False, "グッズ（13件）"),
    ("Coffee Course", [], False, "講座（12件）"),
    ("Coffee Equipment", [], False, "器具（11件）"),
    ("Candy & Chocolate", [], False, "菓子（10件）"),
    ("Poster", [], False, "ポスター（9件）"),
    ("Brewer", [], False, "抽出器具（8件）"),
    ("Reusable", [], False, "繰り返し使う容器（8件）"),
    ("Gift Card", [], False, "ギフトカード（7件）"),
    ("Barista Machine", [], False, "マシン（7件）"),
    ("Books", [], False, "書籍（6件）"),
    ("Event", [], False, "催し（6件）"),
    ("Brew Equipment - Filters", [], False, "ペーパー（6件）"),
    ("Barista Courses", [], False, "講座（6件）"),
    # --- 落とす。集計で「通してしまっていた」もの ---
    ("Drippers", [], False, "ドリッパー37件。drip を単独で豆側に置いていたため通っていた"),
    ("Cursos", [], False, "スペイン語の講座29件"),
    ("Equipamiento", [], False, "スペイン語の器具28件"),
    ("グッズ", [], False, "日本語のグッズ23件"),
    ("Tableware", [], False, "食器19件"),
    ("Supplies", [], False, "備品18件"),
    ("Filters", [], False, "ペーパー15件。filter を単独で豆側に置いていたため通っていた"),
    ("Logoware", [], False, "ロゴ入り雑貨15件"),
    # --- 通す。ここを落とすと本物の豆が消える ---
    ("Coffee", ["ethiopia"], True, "いちばん多い分類（1,186件）"),
    ("", [], True, "何も書かれていない（543件）"),
    ("Roasted Coffee", [], True, "Roasted Coffee（204件）"),
    ("coffee-archive", [], True, "coffee-archive（131件）"),
    ("Filter Coffee", [], True, "Filter Coffee（75件）"),
    ("Whole Bean", [], True, "Whole Bean（68件）"),
    ("Craft Coffee", [], True, "Craft Coffee（54件）"),
    ("Filter", [], True, "Filter は「フィルター用の焙煎」で豆（52件）。Filters とは別"),
    ("Coffee Beans", [], True, "Coffee Beans（49件）"),
    ("Espresso Coffee", [], True, "Espresso Coffee（18件）"),
    ("コーヒー豆", [], True, "コーヒー豆（17件）"),
    ("single origin", [], True, "single origin（16件）"),
    ("Espresso", [], True, "エスプレッソ用の豆（"'"'"Espresso Machine"'"'" と取り違えない）"),
    ("Archive", [], True, "棚の名前。中身は豆（86件）"),
    ("Warehouse", [], True, "棚の名前（49件）"),
    ("Café", [], True, "店の棚（29件）"),
    ("Coffee & Tea", [], True, "tea を含むがコーヒーも売る棚"),
    ("Food, Beverages & Tobacco > Beverages > Coffee", [], True, "Shopify の標準分類"),
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
