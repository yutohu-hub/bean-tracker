"""Shopify 経路を、店の応答を模したデータで確かめる。

  python tests/test_shopify_adapter.py

■ なぜ要るのか

巡回の中身は runner でしか動かしていなかった。開発環境からは外に出られないので、
配線を間違えても手元では分からず、GitHub Actions で初めて落ちる。実際に

  ・返り値の数を1か所直し忘れて ValueError（監査スクリプト）
  ・書き出した YAML が読めない形になっていた（同上）

を runner で踏んでいる。商品の取り込みは同じ作りなので、同じ間違いが起きうる。

Shopify はこの図鑑の商品のほぼ全部を運んでいる経路なので、ここだけでも
ネット無しで通せるようにしておく。

■ 何を見るか

products.json を1枚渡して、そこから組み上がった Product の中身を全部見る。
とくに、あとから足した欄（note_src / kind / city）が落ちていないこと。
欄を足すときは Product・state.db・図鑑の3か所を直す必要があり、
どこか1つ忘れても画面には出ないまま静かに欠ける。
"""
from __future__ import annotations
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import crawler  # noqa: E402

META = {"currency": "JPY", "city": "京都市", "province": "京都府", "country": "JP"}

PRODUCTS = {"products": [
    {   # 見出しつきの風味・産地も精製も名前にある、いちばん素直な豆
        "title": "Ethiopia Guji Natural 200g", "handle": "eth-guji",
        "product_type": "Coffee", "tags": ["single origin"],
        "body_html": "<p>Tasting Notes: Strawberry, Jasmine, Cacao</p>",
        "images": [{"src": "https://img.example/a.jpg"}],
        "options": [{"name": "Grind", "values": ["Whole bean"]}],
        "variants": [{"title": "200g", "grams": 220, "price": "1800", "available": True}],
    },
    {   # 見出しが無く、説明文から拾う豆
        "title": "Kenya Karatina AA", "handle": "ken-karatina",
        "product_type": "Coffee", "tags": [],
        "body_html": "<p>A washed lot with blackcurrant and grapefruit sweetness.</p>",
        "images": [], "options": [],
        "variants": [{"title": "250g", "grams": 270, "price": "2200", "available": False}],
    },
    {   # 豆ではないもの。門で落ちる
        "title": "V60 Dripper", "handle": "v60",
        "product_type": "Brewing Tools", "tags": [],
        "body_html": "<p>Made in Japan.</p>", "images": [], "options": [],
        "variants": [{"title": "01", "grams": 300, "price": "1200", "available": True}],
    },
]}


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status
        self.text = json.dumps(payload) if isinstance(payload, dict) else str(payload)

    def json(self):
        if not isinstance(self._payload, dict):
            raise ValueError("not json")
        return self._payload


class FakeClient:
    """店の代わり。products.json と meta.json だけ答える。"""

    def __init__(self):
        self.seen = []

    async def get(self, url, params=None):
        self.seen.append(url)
        if url.endswith("/meta.json"):
            return FakeResponse(META)
        if url.endswith("/products.json"):
            # 2ページ目は空。1ページで終わることを伝える
            if (params or {}).get("page", 1) > 1:
                return FakeResponse({"products": []})
            return FakeResponse(PRODUCTS)
        return FakeResponse("", 404)


def main() -> int:
    bad = []

    def check(label, got, want):
        if got != want:
            bad.append(f"{label}: {want!r} のはずが {got!r}")

    crawler._SHOP_CUR.clear()
    r = {"name": "Test Roastery", "country": "JP",
         "url": "https://shop.example", "currency": "JPY"}
    got = asyncio.run(crawler._fetch_shopify_path(
        FakeClient(), r, 2, "/products.json"))

    check("豆だけが取れる（器具は門で落ちる）", [p.title for p in got],
          ["Ethiopia Guji Natural 200g", "Kenya Karatina AA"])
    if len(got) != 2:
        for line in bad:
            print("  ✗", line)
        return 1

    a, b = got
    print("■ 見出しつきの豆")
    check("風味", a.notes, "Strawberry, Jasmine, Cacao")
    # 欄を足したときに落ちやすい。3か所（Product/state.db/図鑑）を通す必要がある
    check("風味の取り方", a.note_src, "label")
    check("産地", a.origin, "Ethiopia")
    check("精製", a.process, "Natural")
    check("内容量", a.grams, 220)
    check("値段", a.price, 1800.0)
    check("在庫", a.available, True)
    check("店の申告", a.kind, "c")
    check("通貨", a.currency, "JPY")
    check("市区町村", a.city, "京都市")
    check("画像", a.image, "https://img.example/a.jpg")
    check("100gあたり", a.per100, round(1800 / 220 * 100, 2))
    check("鍵", a.key, "Test Roastery::eth-guji")
    check("商品ページ", a.url, "https://shop.example/products/eth-guji")

    print("■ 説明文から拾った豆")
    check("風味", b.notes, "A washed lot with blackcurrant and grapefruit sweetness")
    check("風味の取り方", b.note_src, "guess")
    check("産地", b.origin, "Kenya")
    check("精製", b.process, "Washed")
    check("在庫なし", b.available, False)
    check("画像が無ければ空", b.image, "")

    for line in bad:
        print("  ✗", line)
    if bad:
        print(f"\n{len(bad)}件の食い違い")
        return 1
    print("Shopify経路: すべて期待どおり")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
