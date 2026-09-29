"""豆の番号が、巡回のたびに変わらないことを確かめる。

■ 何が起きていたか

番号は 100000 から「上から順に」振っていた。並びを決めていたのは
`SELECT * FROM products ORDER BY last_seen DESC` で、これは巡回のたびに変わる。
つまり同じ番号が翌時間には別の豆を指していた。

味の記録は beanId だけで豆に結び付いている。写真も IndexedDB で beanId を
鍵にしている。だから番号がずれると、自分が付けた評価・メモ・写真が
別の豆に付いて見える。共有リンク(?b=) も別の豆を開く。

実測では、手元の6件で並びを1つずらしただけで4件が別の豆を指した。

■ ここで守ること

番号は key（店名::商品handle）だけから決まり、並び順にも、
他の豆が増えたか減ったかにも左右されないこと。
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from build_frontend_data import bean_id, assign_bean_ids, ID_BASE  # noqa: E402

KEYS = [
    "Onibus Coffee::ethiopia-guji-natural",
    "The Barn::kenya-karatina-aa",
    "Fuglen::house-blend",
    "Gardelli::la-argentina-geisha",
    "Tim Wendelboe::kapsokisio",
]


def prods(keys):
    return [{"key": k} for k in keys]


def main() -> int:
    bad = []

    def check(label, got, want):
        if got != want:
            bad.append(f"{label}: {want} のはずが {got}")

    # --- 並び順に左右されない ---
    a = assign_bean_ids(prods(KEYS))
    check("並びを逆にしても同じ番号", assign_bean_ids(prods(list(reversed(KEYS)))), a)
    check("並びをずらしても同じ番号", assign_bean_ids(prods(KEYS[2:] + KEYS[:2])), a)

    # --- 他の豆が増減しても、残った豆の番号は動かない ---
    # ここが崩れると、1件売り切れただけで以降の記録が全部ずれる（前はそうなっていた）
    fewer = assign_bean_ids(prods(KEYS[1:]))
    check("1件消えても、残りの番号は変わらない",
          {k: fewer[k] for k in KEYS[1:]}, {k: a[k] for k in KEYS[1:]})
    more = assign_bean_ids(prods(KEYS + ["New Shop::brand-new-lot"]))
    check("1件増えても、元からある豆の番号は変わらない",
          {k: more[k] for k in KEYS}, a)

    # --- 何度作り直しても同じ ---
    check("作り直しても同じ番号", assign_bean_ids(prods(KEYS)), a)

    # --- 昔の番号と見分けが付く ---
    # 表示側の付け替え(relink.js)が「10億未満なら昔の番号」で判断している
    check("番号は10億以上", all(v >= ID_BASE for v in a.values()), True)
    # JS の安全な整数の範囲に収まること。超えると端末側で丸められて別の豆になる
    check("JSの安全な整数に収まる", all(v < 2 ** 53 for v in a.values()), True)

    # --- ぶつからない ---
    check("番号が重ならない", len(set(a.values())), len(a))
    # 同じ key からは必ず同じ番号
    check("同じ key からは同じ番号", bean_id(KEYS[0]), bean_id(KEYS[0]))
    check("違う key からは違う番号", bean_id(KEYS[0]) != bean_id(KEYS[1]), True)

    # --- 大きな集合でも重ならない ---
    many = assign_bean_ids(prods([f"Shop{i // 50}::lot-{i}" for i in range(9000)]))
    check("9000件でも番号が重ならない", len(set(many.values())), 9000)

    for line in bad:
        print("  ✗", line)
    if bad:
        print(f"\n{len(bad)}件の食い違い")
        return 1
    print("豆の番号の安定性: すべて期待どおり")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
