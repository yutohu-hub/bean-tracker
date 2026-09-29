"""店が返す通貨と、こちらが付ける名札が合っていることを確かめる。

実測（2026-08、FILTER SUPPLY / 福岡）:

    /meta.json  currency='JPY'     ← 店の通貨
    /cart.js    currency='USD'     ← こちらの居場所で返ってくる通貨
    products.json  price='11.00'   ← USD建て

これを JPY と名乗って取り込むと、COLOMBIA LOS PINOS 100g が「11円」に
なる（本当は $11 ≒ ¥1,650）。値段が無いより、間違った値段のほうが悪い。

原因は「?currency= が効いたか」の判定を先頭1件だけで見ていたこと。
並びが変わっただけでも「効いた」と読んでしまう。

  python tests/test_currency.py
"""
from __future__ import annotations
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import crawler  # noqa: E402

fails = []


def check(label, got, want):
    if got != want:
        fails.append(f"{label}: {got!r} ≠ {want!r}")


class Resp:
    def __init__(self, payload, status=200):
        self.text = json.dumps(payload)
        self.status_code = status
        self.content = self.text.encode()

    def json(self):
        return json.loads(self.text)


def page(prices, handle="p"):
    return {"products": [
        {"handle": f"{handle}{i}", "title": f"Ethiopia Guji Natural {200}g",
         "product_type": "Coffee", "tags": ["coffee"],
         "variants": [{"price": p, "available": True, "grams": 200}]}
        for i, p in enumerate(prices)]}


class Html:
    """HTMLを返す応答。トップページから通貨を読むために使う。"""

    def __init__(self, text, status=200):
        self.text, self.status_code = text, status
        self.content = text.encode()

    def json(self):
        raise ValueError("HTML")


class Shop:
    """通貨の返し方を変えられる偽の店。

    cart_ok=False は cart.js が読めない店。robots.txt が Disallow: /cart と
    書いている店（実測: FILTER SUPPLY / KIELO / BRÜCKE / LUSH-COFFEE）と、
    店が弾く店がある。そのときはトップページの Shopify.currency から読む。
    """

    def __init__(self, home, presentment, plain, asked, cart_ok=True):
        self.home, self.presentment = home, presentment
        self.plain, self.asked = plain, asked
        self.cart_ok = cart_ok

    async def get(self, url, params=None, headers=None):
        params = params or {}
        if url.endswith("/robots.txt"):
            return Resp({})
        if url.endswith("/meta.json"):
            return Resp({"currency": self.home, "city": "福岡市",
                         "province": "", "country": "JP"})
        if url.endswith("/cart.js"):
            if not self.cart_ok:
                return Resp({}, 404)
            return Resp({"currency": self.presentment})
        if "products.json" in url:
            return Resp(page(self.asked if params.get("currency") else self.plain))
        if url == "https://t.example":
            return Html('<html><script>var Shopify = {};'
                        'Shopify.currency = {"active":"%s","rate":"1.0"};'
                        '</script></html>' % self.presentment)
        return Resp({}, 404)


def run(home, presentment, plain, asked, cart_ok=True):
    crawler._SHOP_CUR.clear()
    crawler._ROBOTS.clear()
    crawler._REFUSED.clear()
    r = {"name": "T", "url": "https://t.example", "country": "JP", "currency": "JPY"}
    got = asyncio.run(crawler._fetch_shopify_path(
        Shop(home, presentment, plain, asked, cart_ok), r, 1, "/products.json"))
    return got


# ---- ?currency= が無視される店（FILTER SUPPLY と同じ形）----
#
# 付けても付けなくても同じ値段が返る。返ってくるのは USD なので、
# USD と名乗らなければならない。
got = run("JPY", "USD", ["11.00", "20.00", "37.00"], ["11.00", "20.00", "37.00"])
check("無視された店の通貨", got[0].currency if got else None, "USD")
check("無視された店の値段", got[0].price if got else None, 11.0)

# 先頭1件だけ違う応答。これを「効いた」と読むと、USD の値段を JPY と
# 名乗ることになる。並びが変わっただけかもしれないので、効いたとは言わない。
got = run("JPY", "USD", ["11.00", "20.00", "37.00"], ["99.00", "20.00", "37.00"])
check("1件だけ違うのは効いたと言わない", got[0].currency if got else None, "USD")

# ---- ?currency= が本当に効く店 ----
# 値段がひとつ残らず入れ替わっていれば、現地通貨で取れている
got = run("JPY", "USD", ["11.00", "20.00", "37.00"], ["1650.00", "3000.00", "5500.00"])
check("効いた店の通貨", got[0].currency if got else None, "JPY")
check("効いた店の値段", got[0].price if got else None, 1650.0)

# ---- 通貨が食い違わない店（大多数）----
got = run("JPY", "JPY", ["1650.00"], ["1650.00"])
check("食い違わない店", got[0].currency if got else None, "JPY")
check("食い違わない店の値段", got[0].price if got else None, 1650.0)

# ---- 店の通貨が読めない店 ----
got = run("", "", ["1650.00"], ["1650.00"])
check("読めなければ設定の通貨", got[0].currency if got else None, "JPY")

# ---- cart.js が読めない店 ----
#
# 実測（FILTER SUPPLY / 福岡）: robots.txt が Disallow: /cart と書いているので
# cart.js を叩かない。返ってくる通貨が分からず、店の通貨 JPY で名乗っていた。
# 値段は USD建てなので COLOMBIA LOS PINOS 100g が「11円」になる。
# トップページの Shopify.currency から読めば、USD と名乗れる。
got = run("JPY", "USD", ["11.00", "20.00"], ["11.00", "20.00"], cart_ok=False)
check("cart.jsが読めなくてもトップから読む", got[0].currency if got else None, "USD")
check("そのときの値段", got[0].price if got else None, 11.0)

# トップページからも読めない店は、店の通貨のまま（今までどおり）
crawler._SHOP_CUR.clear()
crawler._ROBOTS.clear()


class NoTop(Shop):
    async def get(self, url, params=None, headers=None):
        if url == "https://t.example":
            return Resp({}, 404)
        return await super().get(url, params, headers)


r0 = {"name": "T", "url": "https://t.example", "country": "JP", "currency": "JPY"}
got = asyncio.run(crawler._fetch_shopify_path(
    NoTop("JPY", "USD", ["1650.00"], ["1650.00"], cart_ok=False), r0, 1,
    "/products.json"))
check("どこからも読めなければ店の通貨", got[0].currency if got else None, "JPY")

# ---- 値段の並びを取り出す ----
check("値段の並び", crawler._price_list(page(["1", "2"])), ["1", "2"])
check("商品が無い", crawler._price_list({}), [])
check("数を切る", crawler._price_list(page([str(i) for i in range(30)]), n=3),
      ["0", "1", "2"])

if fails:
    print("✗ 通貨の名札")
    for f in fails:
        print("   " + f)
    raise SystemExit(1)
print("✓ 店が返す通貨と名札が合っていること 13件")
