"""風味（tasting notes）の取り出しを確かめる。

実測（50店・豆1262件）で 33.9% から風味が取れた。中身はほぼ正しかったが、
出てきた文字列に整形の壊れが混ざっていた。ここに並べたのは全部そのとき見たもの。

  （味わい）：甘み、チョコレート、ワイン        ラベルが残る（全角カッコで見出し判定が外れる）
  Our tasting notes : Grapefruit body...   ラベルが残る（見出しの前に語がある）
  red apple and toffee define define ...   語が重複している
  CARAMEL.BERRYCHOCOLATE                   区切りが消えている

風味は図鑑の味わいマップと、法人向けレポートの材料になる。
ラベルの残骸が混ざったまま集計すると、「tasting」や「味わい」が
風味の語として数えられてしまう。
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from crawler import extract_notes, extract_notes_src  # noqa: E402


def p(*paras):
    return "".join(f"<p>{x}</p>" for x in paras)


# (説明, HTML, 期待する文字列)
CASES = [
    # --- 見出しがそのまま行頭にある。ここは元から取れていた ---
    ("英語の見出し", p("Tasting Notes: Grape, Guava, Floral"), "Grape, Guava, Floral"),
    ("見出しだけの行、中身は次の行", p("Tasting Notes", "peach, honeysuckle, lemon"),
     "peach, honeysuckle, lemon"),

    # --- ラベルが残っていたもの ---
    ("全角カッコの見出し", p("（味わい）：甘み、チョコレート、ワイン"), "甘み、チョコレート、ワイン"),
    ("隅付きカッコの見出し", p("【FLAVOR】", "CARAMEL, BERRY, CHOCOLATE"), "CARAMEL, BERRY, CHOCOLATE"),
    # 末尾の句点は元から落としている（飾りなので残す意味が無い）
    ("角カッコの見出し", p("[Flavor notes] EARL GREY. LEMON."), "EARL GREY. LEMON"),
    ("見出しの前に語がある", p("Our tasting notes : Grapefruit body, vibrant lavender"),
     "Grapefruit body, vibrant lavender"),

    # --- 語の重複 ---
    ("同じ語が続く", p("Tasting Notes: red apple and toffee define define Decaf"),
     "red apple and toffee define Decaf"),

    # --- 区切りの消え ---
    ("ピリオドのあとに空白が無い", p("Tasting Notes: CARAMEL.BERRY.CHOCOLATE"),
     "CARAMEL. BERRY. CHOCOLATE"),

    # --- 見出しが無い店（当て推量）。風味語が2つ以上ある短い行を採る ---
    ("見出し無し", p("Grown at 1900m.", "starfruit, honeysuckle, mango"),
     "starfruit, honeysuckle, mango"),

    # --- 取ってはいけないもの ---
    # 見出しの判定を広げたぶん、こちらの歯止めが要る。
    # 見出しがあっても、風味の語が無ければ採らない
    ("配送の注意書き（見出しはあるが風味ではない）",
     p("Notes: we ship on Mondays and Thursdays."), ""),
    ("【】で囲った別の見出し", p("【配送について】", "月曜と木曜に発送します"), ""),
    ("風味語が1つだけの地の文", p("This lot was dried on raised beds with cherry left on."), ""),
    ("説明文が無い", "", ""),

    # --- 13店に広げて見つかった壊れ（2回目の実測） ---
    ("日本語の別の見出し", p("テイスティングコメント：ストロベリージャム、白ぶどう、フローラルな香り"),
     "ストロベリージャム、白ぶどう、フローラルな香り"),
    ("Tastes Like という見出し", p("Tastes Like: Green Grape, Geranium, Pear"),
     "Green Grape, Geranium, Pear"),
    ("括弧つきの前置き", p("(with tasting notes of mango, melon, lychee)"),
     "mango, melon, lychee"),
    ("notes of で始まる", p("Notes of redcurrant, brown sugar and almond"),
     "redcurrant, brown sugar and almond"),

    # --- アレルギー表示を風味として採らない ---
    # 実測: Proud Mary のチャイで「MAY CONTAIN PEANUT, ALMOND」を風味にしていた
    ("アレルギー表示", p("MAY CONTAIN PEANUT, ALMOND"), ""),
    ("含有表示（日本語）", p("アレルギー：乳、大豆、落花生を含みます"), ""),
    ("見出しのあとがアレルギー表示",
     p("Tasting Notes: contains almond and peanut traces"), ""),

    # --- 見出しそぎ落としが、中身まで削らないこと ---
    ("見出しに見える語が中身の一部", p("Tasting Notes: chocolate notes with orange"),
     "chocolate notes with orange"),
    ("コロンが無ければ途中の語は落とさない",
     p("Deep chocolate and caramel notes fill the cup here")," Deep chocolate and caramel notes fill the cup here".strip()),
]


# 風味をどの道で取ったかも残す。集計で「確かな方だけ使う」を選べるようにするため。
# label=店が見出しを付けている / guess=説明文から拾った / ""=見つからない
SRC_CASES = [
    ("見出しあり", p("Tasting Notes: Grape, Guava, Floral"), "label"),
    ("見出しあり（全角カッコ）", p("（味わい）：甘み、チョコレート、ワイン"), "label"),
    ("見出しあり（Tastes Like）", p("Tastes Like: Green Grape, Geranium, Pear"), "label"),
    ("当て推量", p("Grown at 1900m.", "starfruit, honeysuckle, mango"), "guess"),
    ("説明文の地の文も当て推量", p("A comforting sweet coffee with chocolate and cherry"), "guess"),
    ("見つからない", p("Grown at 1900m by Mr. Tesfaye."), ""),
    ("アレルギー表示は採らないので道も空", p("MAY CONTAIN PEANUT, ALMOND"), ""),
]


def main() -> int:
    bad = []
    for label, html, want in CASES:
        got = extract_notes(html)
        if got != want:
            bad.append(f"{label}\n      期待 {want!r}\n      実際 {got!r}")
    for label, html, want in SRC_CASES:
        got = extract_notes_src(html)[1]
        if got != want:
            bad.append(f"取り方 {label}\n      期待 {want!r}\n      実際 {got!r}")

    for line in bad:
        print("  ✗", line)
    if bad:
        print(f"\n{len(bad)}件の食い違い / {len(CASES) + len(SRC_CASES)}件中")
        return 1
    print(f"風味の取り出し: {len(CASES) + len(SRC_CASES)}件すべて期待どおり")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
