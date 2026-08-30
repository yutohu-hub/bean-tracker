"""応答しない店を後回しにする処理を確かめる。

  python tests/test_health.py

■ なぜ要るのか

実測で 442店のうち豆が取れているのは 274店。残り 168店は毎周ぶんの枠を
使って何も返していない。応答しない店は時間切れまで待つので、1店あたりの
費用はむしろ高い。ここを後回しにすると、同じ回数で「取れる店」を
今より短い間隔で回せる。相手のレート制限とは関係なく効く。

■ 間違えるとどうなるか

  飛ばしすぎ … 復活した店にいつまでも気づかない。図鑑がその店だけ古くなる。
  飛ばさない … いまのまま。速くならない。

店は復活する（ドメイン変更・一時的な障害・レート制限）。だから
「もう見ない」ではなく「頻度を落とす」。ここではその境目を全部確かめる。
"""
from __future__ import annotations
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from state import open_db, record_health, due_shops  # noqa: E402

NAMES = ["A", "B", "C"]


def main() -> int:
    bad = []

    def check(label, got, want):
        if got != want:
            bad.append(f"{label}: {want!r} のはずが {got!r}")

    con = open_db(":memory:")
    now = time.time()

    # 記録が無い店は、当然みる
    due, skip = due_shops(con, NAMES, now)
    check("記録が無ければ全部みる", (sorted(due), skip), (["A", "B", "C"], []))

    # 9回続けて失敗しても、まだ毎回みる（境目の手前）
    for _ in range(9):
        record_health(con, {"A"}, {"B", "C"})
    due, skip = due_shops(con, NAMES, now)
    check("9回では飛ばさない", skip, [])

    # 10回目でようやく後回しになる
    record_health(con, {"A"}, {"B", "C"})
    due, skip = due_shops(con, NAMES, now)
    check("10回続けて失敗したら後回し", (sorted(due), sorted(skip)), (["A"], ["B", "C"]))

    # 24時間たてば、必ずもう一度試す（見捨てない）
    due, skip = due_shops(con, NAMES, now + 25 * 3600)
    check("24時間たてば試す", (sorted(due), skip), (["A", "B", "C"], []))

    # 一度でも取れたら、数え直して毎回みるほうに戻る
    record_health(con, {"B"}, set())
    due, skip = due_shops(con, NAMES, now)
    check("取れたら毎回みるほうに戻る", "B" in due, True)
    check("戻った店は飛ばさない", "B" in skip, False)

    # 取れている店は、失敗が積み上がらない
    for _ in range(20):
        record_health(con, {"A"}, set())
    due, skip = due_shops(con, NAMES, now)
    check("取れ続けている店は常にみる", "A" in due, True)

    # 境目は呼び出し側で変えられる（1周の長さが変われば調整するため）
    due, skip = due_shops(con, NAMES, now, dead_after=3)
    check("境目を下げれば早く後回しになる", "C" in skip, True)

    for line in bad:
        print("  ✗", line)
    if bad:
        print(f"\n{len(bad)}件の食い違い")
        return 1
    print("応答しない店の扱い: すべて期待どおり")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
