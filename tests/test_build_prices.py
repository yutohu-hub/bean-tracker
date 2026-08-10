"""店の相場から桁違いに外れた値段を、値段として扱わないことを確かめる。

  python tests/test_build_prices.py

図鑑もレアロットも100gあたりの安い順に並ぶので、取り違えた1件が先頭に居座る。
実例は Glitch Coffee の「¥18 / 160g」で、同じ店の他の豆は 110〜160g で
¥3,200〜¥10,200 だった（相場の 1/259）。

セール品を巻き添えにしないことも一緒に見る。実測では本物のセールは 1/12 までで、
取り違えは 1/259 だったので、境目は 1/20 に置いてある。
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from build_frontend_data import drop_impossible_prices, _per100  # noqa: E402


def bean(shop, name, amount, per="100g", cur="JPY", status="now"):
    return {"r": shop, "name": name, "amount": amount, "per": per, "cur": cur, "status": status}


def run():
    ng = 0

    def check(title, fn):
        nonlocal ng
        try:
            fn()
            print(f"✓ {title}")
        except AssertionError as e:
            print(f"✗ {title}\n    {e}")
            ng += 1

    def normal(shop, n=10, price=3000):
        return [bean(shop, f"豆{i}", price) for i in range(n)]

    def t_broken():
        beans = normal("glitch") + [bean("glitch", "Ethiopia Yirgacheffe Koke", 18, "160g")]
        dropped = drop_impossible_prices(beans)
        assert len(dropped) == 1, f"落ちた件数が違う: {dropped}"
        assert beans[-1]["amount"] == 0, "値段が取り下げられていない"
        assert beans[0]["amount"] == 3000, "ふつうの豆まで巻き添えになっている"

    def t_sale():
        # 1/12 のセール品は残す（本物のセールはこのくらいまで実在する）
        beans = normal("woodberry") + [bean("woodberry", "【SALE】コーヒーバッグ", 250)]
        drop_impossible_prices(beans)
        assert beans[-1]["amount"] == 250, "セール品まで取り下げている"

    def t_small_shop():
        # 銘柄が少ない店は相場が出せないので触らない
        beans = normal("tiny", n=4) + [bean("tiny", "変な値段", 5)]
        drop_impossible_prices(beans)
        assert beans[-1]["amount"] == 5, "相場の出せない店にまで手を出している"

    def t_units():
        # 同じ店・同じ通貨どうしの比較なので、袋の大きさが違っても効く
        beans = [bean("s", f"豆{i}", 6000, "200g") for i in range(10)]
        beans.append(bean("s", "取り違え", 30, "1000g"))
        drop_impossible_prices(beans)
        assert beans[-1]["amount"] == 0, "内容量が違うと見逃している"

    def t_unknown_weight():
        # 内容量が取れていないものは、そもそも100gあたりが出ないので対象外
        assert _per100(bean("s", "重さ不明", 6500, "")) == 0
        beans = normal("s") + [bean("s", "重さ不明", 6500, "")]
        drop_impossible_prices(beans)
        assert beans[-1]["amount"] == 6500, "内容量不明の値段まで消している"

    check("店の相場の1/259の値段は、値段として扱わない", t_broken)
    check("1/12のセール品は残す", t_sale)
    check("銘柄が少なくて相場の出せない店には手を出さない", t_small_shop)
    check("袋の大きさが違っても、同じ店どうしなら見分けられる", t_units)
    check("内容量が取れていないものには手を出さない", t_unknown_weight)

    if ng:
        print(f"\n★ {ng} 件おかしい。")
        raise SystemExit(1)
    print("\n値段の取り下げは、すべて期待どおり。")


if __name__ == "__main__":
    run()
