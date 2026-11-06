"""中国語圏の店の「精製」と「内容量」の読み方を確かめる。

実測（2026-08、Coffee Stopover / 台湾）: og: の見出しから40件が取れる
ようになったが、産地は読めるのに精製が1件も読めず、内容量も全件 ?g だった。
店は「水洗」「日曬」「蜜處理」と書き、量を「1/4磅」と刻んでいる。

内容量が読めないと100gあたりの値段が出ない。豆である証拠も1つ減る。

  python tests/test_cjk_spec.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from crawler import _guess_origin, _guess_process, _grams_from_text  # noqa: E402

fails = []


def check(label, got, want):
    if got != want:
        fails.append(f"{label}: {got!r} ≠ {want!r}")


# ---- 実際に取れた商品名（Coffee Stopover）----
for title, origin, process, grams in [
    ("淺中｜肯亞 奇里 奇姆 | 水洗 ｜1/4磅", "Kenya", "Washed", 113),
    ("深｜肯亞 奇里雅佳 辛巴 | 日曬｜1/4磅", "Kenya", "Natural", 113),
    ("中｜哥斯大黎加 塔拉珠 荒野莊園  | 蜜處理｜1/4磅", "Costa Rica", "Honey", 113),
    ("淺｜哥斯大黎加 奇里波山谷 美景莊園 | 藝妓 | 黑蜜｜1/4磅", "Costa Rica", "Honey", 113),
    ("中深｜祕魯 亞馬遜 米拉 | 爪哇 | 水洗｜1/4磅", "Peru", "Washed", 113),
]:
    check(f"産地 {title[:16]}", _guess_origin(title), origin)
    check(f"精製 {title[:16]}", _guess_process(title), process)
    check(f"内容量 {title[:16]}", _grams_from_text(title), grams)

# 長い語を先に見ること。「厭氧日曬」を「日曬」で取ると嫌気性が消える
check("厭氧日曬", _guess_process("淺｜哥倫比亞 香蕉妹妹 | 厭氧日曬｜1/4磅"), "Anaerobic Natural")
check("厭氧水洗", _guess_process("厭氧水洗"), "Anaerobic Washed")
check("簡体字も読む", _guess_process("厌氧日晒"), "Anaerobic Natural")
check("濕剝", _guess_process("蘇門答臘 濕剝"), "Wet Hulled")

# ---- 量の書き方 ----
check("1磅", _grams_from_text("肯亞 1磅"), 453)
check("1/2磅", _grams_from_text("肯亞 1/2磅"), 226)
check("克はグラム", _grams_from_text("衣索比亞 耶加雪菲 200克"), 200)
check("公斤はキロ", _grams_from_text("巴西 1公斤"), 1000)
check("0で割らない", _grams_from_text("肯亞 1/0磅"), 0)

# ---- いま読めているものを壊していないこと ----
#
# ポンドの規則を後ろに足したのは、前に置くと既存の読み方を横取りするから。
# 読めなかったときだけ中国語の書き方を見る。
for text, want in [("Ethiopia Guji Natural 200g", 200), ("8.8oz bag", 249),
                   ("5lbs", 2268), ("1kg", 1000), ("250 g", 250),
                   ("no weight here", 0)]:
    check(f"既存 {text}", _grams_from_text(text), want)
for text, want in [("Anaerobic Natural", "Anaerobic Natural"), ("washed", "Washed"),
                   ("honey", "Honey"), ("ナチュラル", "Natural"),
                   ("嫌気性ウォッシュ", "Anaerobic Washed"), ("nothing", "")]:
    check(f"既存 {text}", _guess_process(text), want)

if fails:
    print("✗ 中国語圏の読み方")
    for f in fails:
        print("   " + f)
    raise SystemExit(1)
print("✓ 中国語圏の精製と内容量、既存の読み方を壊していないこと 33件")
