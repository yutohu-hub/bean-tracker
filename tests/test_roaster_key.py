"""巡回で取れた店を、図鑑のどの店に結びつけるかを確かめる。

  python tests/test_roaster_key.py

■ なぜ要るのか

ここを間違えると、豆が別の店のページに並ぶ。利用者から見ると
「この店がこの豆を売っている」という嘘になり、画面を見ても気づけない。

実データで実際に起きていた。

  丸山珈琲 と 堀口珈琲 が同じ店として扱われ、丸山珈琲の豆が
  堀口珈琲のページに入っていた。突き合わせ用の名前が、どちらも
  空文字になっていたため（英数字以外を捨てていた）。

突き合わせは「業種の言葉を落として名前を比べる」というあいまいな方法なので、
落とし穴が多い。分かっているものを全部ここに残す。
"""
from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from build_frontend_data import norm, bare_domain  # noqa: E402


def main() -> int:
    bad = []

    def check(label, got, want):
        if got != want:
            bad.append(f"{label}: {want!r} のはずが {got!r}")

    # --- 業種の言葉を落とす（この方法の目的） ---
    # 図鑑の表と config/roasters.yaml で、同じ店の書き方が違うことへの対処。
    # 突き合わせるのは名前どうしで、図鑑の鍵（onyx など）とは別物
    check("Coffee の有無を吸収する",
          norm("George Howell Coffee") == norm("George Howell"), True)
    check("Roasters の有無を吸収する",
          norm("April Coffee Roasters") == norm("April"), True)
    check("The の有無を吸収する", norm("The Barn") == norm("Barn"), True)
    # 落とすのは業種の言葉だけ。店を見分ける語まで落とすと別の店と混ざる
    check("Lab は落とさない", norm("Onyx Coffee Lab"), "onyxlab")

    # --- 日本語だけの店名が、ひとつに潰れないこと ---
    check("丸山珈琲は空にならない", norm("丸山珈琲") != "", True)
    check("堀口珈琲は空にならない", norm("堀口珈琲") != "", True)
    check("日本語の別の店は別の鍵になる", norm("丸山珈琲") == norm("堀口珈琲"), False)
    check("同じ店なら同じ鍵（前後の空白は無視）", norm(" 丸山珈琲 "), norm("丸山珈琲"))

    # --- 英数字の名前では、これまでと同じ結果になること ---
    # ここが変わると、既存の全店で豆の行き先が変わる
    for name, want in [("Onyx Coffee Lab", "onyxlab"), ("The Barn", "barn"),
                       ("Tim Wendelboe", "timwendelboe"), ("% Arabica", "arabica"),
                       ("49th Parallel", "49thparallel")]:
        check(f"英数字の店は従来どおり（{name}）", norm(name), want)

    # --- ドメインの取り出し（名前が当てにならないときの検算に使う） ---
    check("scheme と www を落とす", bare_domain("https://www.example.com/x"), "example.com")
    check("shop. も落とす", bare_domain("https://shop.example.com"), "example.com")
    check("空でも落ちない", bare_domain(""), "")
    # 別の店を見分けられること（実データで取り違えていた組）
    check("Luna と Luna Coffee は別のドメイン",
          bare_domain("https://enjoylunacoffee.com") == bare_domain("https://lunacoffeeroasters.com"),
          False)

    for line in bad:
        print("  ✗", line)
    if bad:
        print(f"\n{len(bad)}件の食い違い")
        return 1
    print("店の結びつけ: すべて期待どおり")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
