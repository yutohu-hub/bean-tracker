"""図鑑から外した店の商品が、DBからも消えることを確かめる。

  python tests/test_prune.py

■ なぜ要るのか

巡回する店は config/roasters.yaml で決めているが、取り込んだ商品は
state.db に残る。店を1行消しても、その店の豆は図鑑に並んだままだった。
誰も見に行かないので在庫も動かず、いつまでも「いま買える」と出る。

書き出しの最後には「雑貨中心の店なら config/roasters.yaml から外す」と
出していたのに、外しても消えなかった。助言のとおりにしても効かない状態だった。

■ ここで確かめること

  ・外した店の商品とイベントが消えること
  ・残す店には触らないこと（分割巡回で今回見ていない店も含む）
  ・一度に消しすぎないこと。設定を書き損じて店の一覧が短くなったとき、
    黙って何千件も消えてはいけない。消すのは簡単だが戻すのは難しい
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from state import open_db, apply_snapshot, prune_missing_roasters  # noqa: E402


def prod(roaster, handle, available=True):
    return {
        "key": f"{roaster}::{handle}", "roaster": roaster, "country": "JP",
        "title": handle, "url": f"https://x/{handle}", "image": "",
        "price": 1800.0, "currency": "JPY", "grams": 250, "per100": 720.0,
        "available": available, "origin": "Ethiopia", "process": "Washed",
        "tags": "", "notes": "", "city": "", "province": "", "kind": "c",
    }


def count(con, table, where="", args=()):
    q = f"SELECT COUNT(*) n FROM {table}" + (f" WHERE {where}" if where else "")
    return con.execute(q, args).fetchone()["n"]


def main() -> int:
    bad = []

    def check(label, got, want):
        if got != want:
            bad.append(f"{label}: {want} のはずが {got}")

    con = open_db(":memory:")
    # A店8件・B店1件・C店1件。C店を図鑑から外す想定
    items = ([prod("A", f"a{i}") for i in range(8)] + [prod("B", "b1")] + [prod("C", "c1")])
    apply_snapshot(con, items)
    check("最初は10件", count(con, "products"), 10)
    check("新着イベントも10件", count(con, "events"), 10)

    dropped = prune_missing_roasters(con, {"A", "B"})
    check("消した店を返す", dropped, [("C", 1)])
    check("外した店の商品が消えた", count(con, "products", "roaster='C'"), 0)
    check("外した店のイベントも消えた", count(con, "events", "key='C::c1'"), 0)
    check("残す店は無事", count(con, "products"), 9)

    # 分割巡回では今回見ていない店がある。一覧に載っていれば触らない
    check("見ていない店も一覧にあれば残る", count(con, "products", "roaster='B'"), 1)

    # --- 一度に消しすぎない ---
    # A店8件は全体の9割近い。設定の読み違いで一覧が短くなった場合に相当する
    left = prune_missing_roasters(con, {"B"})
    check("多すぎるときは何もしない", left, [])
    check("商品も消えていない", count(con, "products"), 9)

    # 一覧が空（読み込みに失敗した等）のときも何もしない
    check("一覧が空なら何もしない", prune_missing_roasters(con, set()), [])
    check("空でも商品は無事", count(con, "products"), 9)

    # 割合の上限を上げれば消える。「消せない」のではなく「黙って消さない」だけ
    forced = prune_missing_roasters(con, {"B"}, max_share=1.0)
    check("上限を上げれば消える", forced, [("A", 8)])
    check("残るのはB店だけ", count(con, "products"), 1)

    for line in bad:
        print("  ✗", line)
    if bad:
        print(f"\n{len(bad)}件の食い違い")
        return 1
    print("図鑑から外した店の扱い: すべて期待どおり")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
