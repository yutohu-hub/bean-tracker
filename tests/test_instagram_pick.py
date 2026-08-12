"""店の Instagram アカウントの選び方を、実際に踏んだ間違いで確かめる。

  python tests/test_instagram_pick.py

■ なぜ要るのか

ページに貼ってある instagram.com への導線は、店のアカウントとは限らない。
実測で2件、別のアカウントを店のものとして書き込んでいる。

  ・Single O    → @process_creative（サイトを作った会社。フッターに載っていた）
  ・Padre Coffee → @shopify（「Powered by Shopify」の導線）

どちらも、書き込まれた後で気づいた。図鑑に出てしまえば、利用者には
「この店のアカウント」に見える。間違ったものを出すのは、何も出さないより悪い。

外に出られない開発環境では、選び方を直しても runner を回すまで確かめられない。
選ぶところだけは HTML を模したデータで通せるようにしておく。
"""
from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from collect_instagram import handles_in, pick_handle  # noqa: E402


def link(h: str) -> str:
    return f'<a href="https://www.instagram.com/{h}/">Instagram</a>'


CASES = [
    # (店名, ページのHTML, 期待するアカウント, 何を見ているか)
    ("Padre Coffee",
     link("shopify") + '<p>Powered by Shopify</p>',
     "", "決済・カートの会社は店ではない"),
    ("Single O",
     link("process_creative") + link("process_creative") + link("single_o"),
     "single_o", "多く出てくる制作会社より、名前が似ている方"),
    ("Coffee Collective",
     link("coffeecollectif") + link("coffeecollectif"),
     "coffeecollectif", "綴りの揺れがあっても店のものと分かる"),
    ("Padre Coffee",
     link("padrecoffee") + link("shopify"),
     "padrecoffee", "紛れていても名前で選べる"),
    ("Luna",
     link("enjoylunacoffee") + link("enjoylunacoffee"),
     "enjoylunacoffee", "頭は違うが、店名の単語が入っている"),
    ("Slate Coffee Roasters",
     link("xoilactvnet") * 6,
     "", "何度も出てきても、店名と結びつかないものは採らない"),
    ("Some Roastery",
     link("randomperson"),
     "", "名前も似ておらず1回だけ。店のものとは言えない"),
    ("丸山珈琲",
     link("maruyama_coffee") + link("someoneelse"),
     "", "綴りの手がかりが無い店名は、ここでは決めない（表に手で足す）"),
    ("Fuglen Coffee Roasters",
     link("fuglencoffee_tokyo") + '<a href="https://instagram.com/p/ABC123/">post</a>',
     "fuglencoffee_tokyo", "投稿のURLはアカウント名ではない"),
    ("Mecca Coffee",
     link("meccacoffee") + link("meccacoffee") + link("instagram"),
     "meccacoffee", "Instagram 自身の導線は数えない"),
    ("49th Parallel",
     link("49th") + link("49th"),
     "", "店名の頭と一致しても、短すぎるものは採らない"),
    ("49th Parallel",
     link("49th") + link("49thparallelroasters"),
     "49thparallelroasters", "短いものを外したうえで、名前が似ている方を選ぶ"),
]


def main() -> int:
    bad = []
    for name, html, want, why in CASES:
        got = pick_handle(handles_in(html), name)
        mark = "✓" if got == want else "✗"
        if got != want:
            bad.append(f"{name}: {want!r} のはずが {got!r}（{why}）")
        print(f"  {mark} {name[:24]:<24} → {got or '（採らない）':<22} {why}")
    for line in bad:
        print("  ✗", line)
    if bad:
        print(f"\n{len(bad)}件の食い違い")
        return 1
    print(f"\nアカウントの選び方: {len(CASES)}件すべて期待どおり")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
