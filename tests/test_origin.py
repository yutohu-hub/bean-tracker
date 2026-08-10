"""産地の読み取りと、「分からない」の扱いを確かめる。

  python tests/test_origin.py

■ なぜ要るのか

図鑑は産地でしぼり込めて、地球儀も診断も産地を材料にしている。
それなのに、読み取れなかった産地を「ブレンド」で埋めていた。実測すると
「ブレンド」2,945件のうち、店が本当にブレンドと書いていたのは13.8%だけで、
残りの2,538件は「読めなかっただけ」だった。産地でしぼると、その2,538件が
ブレンドとして出てくる。

読み取り側も英語と日本語の国名40語しか見ておらず、"Etiopía"（西）、"Perú"、
"México" のようなアクセント付きの綴りや、"Yirgacheffe"（→エチオピア）の
ような地域名を落としていた。実データで318件が拾えるようになる。
"""
from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))
from crawler import _guess_origin  # noqa: E402
from build_frontend_data import _origin_or_unknown  # noqa: E402

# (文字列, 期待する産地) — すべて実データに出てきたもの
ORIGIN_CASES = [
    # 英語の国名（従来どおり）
    ("Ethiopia Guji Uraga", "Ethiopia"),
    ("Colombia El Diviso", "Colombia"),
    # アクセント付き・他言語の綴り。ここを落としていた
    ("Etiopía Mustefa Abakeno", "Ethiopia"),
    ("Perú Carnaval", "Peru"),
    ("México El Plátano", "Mexico"),
    ("Brasil Jaguara", "Brazil"),
    ("衣索比亞 耶加雪菲", "Ethiopia"),
    # 国名は無いが、地域名・農園名で産地が決まる
    ("Yirgacheffe Kochere Washed", "Ethiopia"),
    ("Huila El Paraiso", "Colombia"),
    ("Kenya Gichathaini AA", "Kenya"),
    ("阿里山 咖啡豆", "Taiwan"),
    ("MOGIANA", "Brazil"),
    ("Huye Mountain Espresso", "Rwanda"),
    # 長い呼び名を先に当てる（"costa rica" が "rica" に負けない）
    ("Costa Rica Brumas del Zurquí", "Costa Rica"),
    # 産地の分からないもの
    ("House Blend", ""),
    ("Pañuelo", ""),
    ("Morning Sun", ""),
]

# (商品, 期待する表示) — 「ブレンド」と「不明」を混ぜない
BLEND_CASES = [
    ({"title": "Ethiopia Guji", "origin": "Ethiopia"}, "エチオピア", "読み取れた産地"),
    ({"title": "House Blend", "origin": ""}, "ブレンド", "店がブレンドと書いている"),
    ({"title": "ハウスブレンド", "origin": ""}, "ブレンド", "日本語"),
    ({"title": "綜合咖啡豆", "origin": ""}, "ブレンド", "中国語"),
    ({"title": "Mezcla de la casa", "origin": ""}, "ブレンド", "スペイン語"),
    ({"title": "Mélange du jour", "origin": ""}, "ブレンド", "フランス語"),
    ({"title": "Pañuelo", "origin": ""}, "不明", "何も分からないものは不明"),
    ({"title": "Morning Sun", "origin": ""}, "不明", "名前だけでは分からない"),
]


def run() -> None:
    ng = 0
    print("■ 産地の読み取り")
    for text, want in ORIGIN_CASES:
        got = _guess_origin(text)
        mark = "✓" if got == want else "✗"
        if got != want:
            ng += 1
        print(f"  {mark} {text[:34]:<34} → {got or '(分からない)'}")

    print("\n■「ブレンド」と「不明」を分ける")
    for p, want, label in BLEND_CASES:
        got = _origin_or_unknown(p)
        mark = "✓" if got == want else "✗"
        if got != want:
            ng += 1
        print(f"  {mark} {label:<24} {p['title'][:22]:<22} → {got}")

    if ng:
        print(f"\n★ {ng} 件おかしい。")
        raise SystemExit(1)
    print(f"\n{len(ORIGIN_CASES) + len(BLEND_CASES)} 件すべて期待どおり。")


if __name__ == "__main__":
    run()
