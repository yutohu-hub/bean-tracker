"""取り込みの門（has_bean_evidence）を確かめる。

この門は「豆である証拠が無いものは取らない」。引き算（豆でないものの名前を
数える）をやめて足し算にしたのは、外す語が各国語ぶん必要で終わらないから。

ここで守りたいのは二つ。

  1. 本物の豆を落とさないこと
     落ちた豆は画面に出ないので、間違えても誰も気づけない。
     とくに名前が短い豆（"Morning Sun" のような屋号だけの銘柄）が危ない。

  2. こちらが名前を知らない雑貨が落ちること
     ノルウェー語の水筒も台湾の濾杯も、語を知らないまま落ちてほしい。

商品名は実際の店から取ったものを使う。作り話で試すと、作り話にだけ効く
規則ができあがる。
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from crawler import has_bean_evidence  # noqa: E402


def prod(title, ptype="", tags=None, variant_title="", options=None):
    return {"title": title, "product_type": ptype, "tags": tags or [],
            "options": options or [],
            "variants": [{"title": variant_title, "grams": 0}]}


def grind_opt(*values):
    """挽き方を選ぶ欄。豆にしか付かない。"""
    return [{"name": "Grind", "values": list(values) or ["Whole bean"]}]


# --- 通らねばならないもの（本物の豆） ---------------------------------------
# 「落とした豆は見えない」ので、こちらが本命。
MUST_PASS = [
    # 産地が名前にある。証拠として一番多い
    prod("Ethiopia Guji Hambela Wate Washed G1"),
    prod("Kenya Nyeri Kiandu AB"),
    prod("Colombia Huila Finca Buena Vista"),
    prod("Burundi Kayanza Buzira CWS Natural"),
    prod("エチオピア イルガチェフェ ウォッシュド"),
    # 産地の語が国名でなく地域名・農園名のもの
    prod("Yirgacheffe Kochere"),
    prod("Hacienda La Esmeralda - Jaramillo"),
    prod("Mwendi Wega"),                       # ケニアの水洗工場。過去に一度落とした
    # 品種
    prod("Gesha - Nirvana - Finca Deborah"),
    prod("SL28 - Natural - Jardines del Eden"),
    prod("Carlos Guamanga (Pink Bourbon)"),
    # 焙煎度
    prod("浅煎り ブレンド"),
    prod("Medium Roast House Blend"),
    # 内容量が名前か規格にある
    prod("Gichathaini, 250g"),
    prod("Seasonal Blend [200g]"),
    prod("Morning Sun", variant_title="340g"),   # 屋号だけの銘柄。重さだけが頼り
    # 名前に何の証拠も無いが、店が「コーヒー」と書いている。
    # 実データではこの型が2339件あり、落とすと本物の豆が大量に消えた
    prod("Big Truck", ptype="Coffee"),
    prod("Hoop", ptype="Whole Bean Coffee"),
    prod("オニバスブレンド【ONIBUSオリジナルブレンド】", ptype="コーヒー豆"),
    prod("キッサブレンド", ptype="Coffee"),
    prod("Grunyí", ptype="Filter"),
    # 店の申告が中国語・北欧語でも通ること（門は語の一覧に頼らない）
    prod("耶加雪菲 日曬", ptype="咖啡豆"),

    # --- 挽き方の欄だけが頼りのもの ---
    # 実測でここを落としかけた。名前が水洗工場の名だけで、産地の語も内容量も
    # 焙煎度も無く、店は product_type を空にしていた。
    # 挽き方を選ばせている以上、豆でしかありえない。
    prod("Kapsokisio", options=grind_opt("Whole bean", "Filter", "Espresso")),
    prod("Scattered Salinas", options=grind_opt()),
    prod("Pañuelo", options=[{"name": "挽き方", "values": ["豆のまま", "中挽き"]}]),
    # options を持たず、規格名に入れている店
    prod("Nano Challa", variant_title="Whole Bean / 250 g"),
]

# --- 落ちてほしいもの（雑貨・器具） -----------------------------------------
# こちらが語を知らなくても落ちること、が要点。
MUST_DROP = [
    # 実データで「証拠ゼロ」だったもの
    prod("Gift Card"),
    prod("Digital Gift Card"),
    prod("Shipping"),
    prod("Large Saucer"),
    prod("Large cup & saucer"),
    prod("Basic Kintsugi Repair Kit"),
    prod("Kurasu original postcard"),
    prod("ONIBUS COFFEE ブランドブック"),
    prod("ONIBUS COFFEE オリジナルデザイン ショッパー"),
    # 器具。名前を知らなくても、産地も精製も品種も焙煎度も内容量も無いので落ちる
    prod("V60 Dripper - Switch"),
    prod("HARIO V60 グラスサーバー600"),
    prod("Kalita Wave Dripper 155"),
    prod("Origami Pinn"),
    prod("APAX LAB Nano Konflux"),
    # 雑貨。利用者が名指しで消してほしいと言ったもの
    prod("NO COFFEE × CLUBHAUS NALGENE"),
    prod("NO COFFEE WALLMUG SLEEK ver.2"),
    prod("ONIBUS オリジナルハンカチ 3カラー [WHW! コラボ]"),
    prod("【EC限定】THE COMMONS Tシャツ"),
    prod("ONIBUSオリジナル ステッカー (5枚入り)"),
    prod("Original Tote Bag"),
    prod("Goodman original cotton 巾着袋"),
]

# --- 門は通すが、豆ではないもの ---------------------------------------------
# 門は「証拠が無い物」を止めるだけで、証拠がある物の中身は見ない。
# コーヒーの言葉が別の意味でも使われているために証拠が立ってしまう物がある。
# これらは名前を知っていれば外せるので、表示側の isCoffeeBean が受け持つ
# （tests/test_is_coffee.mjs で落ちることを確かめている）。
#
# ここでわざと「通る」ことを確かめておく。門を厳しくして本物の豆を落とす方が
# 害が大きいので、この線引きを後から誰かが締め直さないように残す。
PASSES_GATE_ON_PURPOSE = [
    # "Acaia" はブラジルの品種名であり、はかりの銘柄でもある
    (prod("Acaia Pearl S"), "品種名と同じ綴りのはかり"),
    # "Natural" は精製方法であり、ふつうの英単語でもある
    (prod("ONA Natural Staple T-Shirt"), "精製語と同じ綴りのTシャツ"),
    # 産地の語はあるが、売っているのは紙
    (prod("Origin Series Poster | Rwanda"), "産地名の入った印刷物"),
    # 内容量はあるが、中身は茶
    (prod("Earl Grey 1kg"), "内容量のある紅茶"),
    # オンスは袋の大きさでもあり、水筒の大きさでもある。
    # 米国の店は豆を "8.8oz" "12oz" と書くので、オンスを読まないと本物の豆が落ちる
    # （実測で Onyx Coffee Lab の商品が規格 "8.8oz" だけのために落ちていた）。
    # 読むようにすると、こんどは 16oz のタンブラーが通る。豆を落とすよりましと考えた
    (prod("ONIBUSオリジナル タンブラー 16oz [MiiR]"), "オンス表記の水筒"),
]


# --- 商品の種類を1つも書かない店での扱い -------------------------------------
# そういう店では店の申告が使えないので、門が不当に厳しくなる。
# 実測44軒中1軒（Tim Wendelboe）で、そこだけ出荷重量を最後の手がかりにする。
def shipped(title, grams):
    return {"title": title, "product_type": "", "tags": [], "options": [],
            "variants": [{"title": "Default Title", "grams": grams}]}


SILENT_SHOP = [
    # 実物。銘柄名だけ・種類なし・規格なし・出荷重量311g
    (shipped("Kapsokisio", 311), True, "袋らしい重さの豆"),
    (shipped("Tariku Kare", 280), True, "袋らしい重さの豆"),
    # 重さが袋の範囲から外れるもの
    (shipped("Espresso Machine", 12000), False, "重すぎる"),
    (shipped("Digital Gift Card", 0), False, "重さが無い"),
    (shipped("Silver Logo Stickers", 12), False, "軽すぎる"),
]


def main() -> int:
    bad = []
    for p in MUST_PASS:
        if not has_bean_evidence(p):
            bad.append(f"豆なのに落とした: {p['title']!r} (product_type={p['product_type']!r})")
    for p in MUST_DROP:
        if has_bean_evidence(p):
            bad.append(f"雑貨なのに通した: {p['title']!r}")
    for p, why in PASSES_GATE_ON_PURPOSE:
        if not has_bean_evidence(p):
            bad.append(f"門が想定より厳しい（{why}）: {p['title']!r} — "
                       "落とせたように見えるが、同じ厳しさで本物の豆も落ちる。"
                       "外すなら表示側の isCoffee.js で名指しすること")

    for p, want, why in SILENT_SHOP:
        got = has_bean_evidence(p, shop_writes_type=False)
        if got != want:
            bad.append(f"種類を書かない店（{why}）: {p['title']!r} — "
                       f"{'通す' if want else '落とす'}はずが"
                       f"{'通した' if got else '落とした'}")
    # 種類を書く店では、この逃げ道は使わない。使うと雑貨が大量に通る
    for p, _want, _why in SILENT_SHOP:
        if has_bean_evidence(p, shop_writes_type=True):
            bad.append(f"種類を書く店なのに重さだけで通した: {p['title']!r}")

    for line in bad:
        print("  ✗", line)
    total = (len(MUST_PASS) + len(MUST_DROP) + len(PASSES_GATE_ON_PURPOSE)
             + len(SILENT_SHOP) * 2)
    if bad:
        print(f"\n{len(bad)}件の食い違い / {total}件中")
        return 1
    print(f"取り込みの門: {total}件すべて期待どおり "
          f"（通す{len(MUST_PASS)}件・落とす{len(MUST_DROP)}件・"
          f"わざと通す{len(PASSES_GATE_ON_PURPOSE)}件・"
          f"種類を書かない店{len(SILENT_SHOP)}件×2）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
