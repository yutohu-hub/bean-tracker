"""通知の絞り込みと文面を、送信せずに確かめる。

1回の巡回で新着は数十件出る。そのまま流すと通知欄が埋まって切られるので、
「何を送らないか」がこの機能の本体になる。そこを固定する。

  python tests/test_push_notify.py
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import push_notify as pn  # noqa: E402

EV = [
    {"type": "new", "title": "Ethiopia Chelbesa Washed 200g", "roaster": "A"},
    {"type": "new", "title": "Panama Geisha Natural 100g", "roaster": "B"},
    {"type": "new", "title": "Colombia Sidra Anaerobic", "roaster": "C"},
    {"type": "new", "title": "Cup of Excellence #12 Guatemala", "roaster": "D"},
    {"type": "new", "title": "House Blend 250g", "roaster": "E"},
    {"type": "soldout", "title": "Kenya AA", "roaster": "F"},
    {"type": "restock", "title": "Ethiopia Guji", "roaster": "G", "oos_hours": 72},
]


def main() -> None:
    restock, rare = pn._pick(EV)
    assert len(restock) == 1, restock
    # ゲイシャ・シドラ・COE の3件だけが拾われ、普通の新着とブレンドは入らない
    assert len(rare) == 3, [r["title"] for r in rare]
    assert all("Blend" not in r["title"] for r in rare)
    # 売り切れは通知しない（買えないものを知らせても仕方がない）
    assert not any(e["type"] == "soldout" for e in restock + rare)

    m = pn._message(restock, rare)
    assert m and "再入荷 1件" in m["title"] and "新着レアロット 3件" in m["title"], m
    assert m["url"].startswith("?"), m           # 行き先はサイト内のみ
    print(f"まとめ: {m['title']} / {m['body'][:40]} → {m['url']}")

    # 1件だけのときは、まとめずに銘柄名を出す
    one = pn._message(restock, [])
    assert "Ethiopia Guji" in one["body"] and "日ぶり" in one["body"], one
    print(f"再入荷1件: {one['title']} / {one['body']}")

    one_rare = pn._message([], rare[:1])
    assert one_rare["url"] == "?v=geisha", one_rare
    print(f"レアロット1件: {one_rare['title']} / {one_rare['body'][:40]}")

    # 何も無ければ送らない（毎時「0件です」を送らない）
    assert pn._message([], []) is None

    # 未設定の環境では、例外を投げずに黙って何もしない（巡回を止めない）
    pn.push(EV)
    print("OK")


if __name__ == "__main__":
    main()
