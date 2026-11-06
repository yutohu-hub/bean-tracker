"""棚から消えた商品を「買えない」に倒す処理を確かめる。

ここは間違えると被害が大きい。倒しすぎれば図鑑が売り切れだらけになり、
倒さなければ売り終わった豆がいつまでも「いま買える」として並ぶ。

巡回は442店を13に割って1時間ごとに回しているので、「今回見ていない店」の
商品まで倒してはいけない。それを取り違えないよう、店ごとの場合分けを全部残す。
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from state import open_db, apply_snapshot, derive_status  # noqa: E402


def prod(roaster, handle, available=True):
    return {
        "key": f"{roaster}::{handle}", "roaster": roaster, "country": "JP",
        "title": handle, "url": f"https://x/{handle}", "image": "",
        "price": 1800.0, "currency": "JPY", "grams": 250, "per100": 720.0,
        "available": available, "origin": "Ethiopia", "process": "Washed",
        "tags": "", "notes": "", "city": "", "province": "", "kind": "c",
    }


def avail(con, key):
    r = con.execute("SELECT available FROM products WHERE key=?", (key,)).fetchone()
    return None if r is None else bool(r["available"])


def main() -> int:
    bad = []

    def check(label, got, want):
        if got != want:
            bad.append(f"{label}: {want} のはずが {got}")

    con = open_db(":memory:")

    # A店に2件、B店に1件。どれも在庫あり
    apply_snapshot(con, [prod("A", "a1"), prod("A", "a2"), prod("B", "b1")])
    check("最初はどれも在庫あり", (avail(con, "A::a1"), avail(con, "A::a2"), avail(con, "B::b1")),
          (True, True, True))

    # --- A店だけを巡回し、a2 が棚から消えた ---
    stats = apply_snapshot(con, [prod("A", "a1")])
    check("消えた a2 は在庫なしに倒れる", avail(con, "A::a2"), False)
    check("残っている a1 は在庫ありのまま", avail(con, "A::a1"), True)
    check("倒した件数を数えている", stats["gone"], 1)
    # 売り切れイベントは「在庫ありを見ていたのに無くなった」ときのもの。
    # 棚から消えたことでイベントを立てると、本当の売り切れが埋もれる
    check("棚落ちでは売り切れイベントを立てない", stats["soldout"], 0)

    # --- 今回巡回していないB店は触らない ---
    # ここを間違えると、一巡するまで図鑑の大半が売り切れになる
    check("見ていない店の商品は無事", avail(con, "B::b1"), True)

    # --- 0件しか返さなかった店は触らない ---
    # 店の一時的な不調と「全部下げた」を見分けられないため、次の巡回に持ち越す
    apply_snapshot(con, [])
    check("空の巡回では何も倒さない", avail(con, "B::b1"), True)
    check("空の巡回では a1 も無事", avail(con, "A::a1"), True)

    # --- 戻ってきたら在庫ありに戻る ---
    apply_snapshot(con, [prod("A", "a1"), prod("A", "a2")])
    check("棚に戻れば在庫ありに戻る", avail(con, "A::a2"), True)

    # --- 倒したものは SOLD OUT を経て ARCHIVE に送られる ---
    apply_snapshot(con, [prod("A", "a1")])          # a2 をもう一度落とす
    row = dict(con.execute("SELECT * FROM products WHERE key='A::a2'").fetchone())
    check("倒した直後は売り切れ表示", derive_status(row), "sold")
    row["last_status_change"] = time.time() - 15 * 86400
    check("14日たてば履歴送り", derive_status(row), "archive")

    # --- first_seen は残る（図鑑の「古い順」がこれを見る） ---
    fs = con.execute("SELECT first_seen FROM products WHERE key='A::a2'").fetchone()["first_seen"]
    check("初めて見つけた日は消さない", bool(fs), True)

    for line in bad:
        print("  ✗", line)
    if bad:
        print(f"\n{len(bad)}件の食い違い")
        return 1
    print("棚から消えた商品の扱い: すべて期待どおり")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
