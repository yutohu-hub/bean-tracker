"""sitemap + JSON-LD の経路を、店の応答を模したデータで確かめる。

開発環境からは実店舗に到達できないため、各ECが実際に吐いている書式
（Shopify / BASE / Squarespace / Wix が出す JSON-LD の代表的な3通り）を
そのまま並べて、そこから商品が組み立てられることを見る。

  python tests/test_generic_adapter.py
"""
from __future__ import annotations
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import crawler  # noqa: E402

SITEMAP_INDEX = """<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://shop.example/sitemap_pages_1.xml</loc></sitemap>
  <sitemap><loc>https://shop.example/sitemap_products_1.xml</loc></sitemap>
</sitemapindex>"""

SITEMAP_PRODUCTS = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://shop.example/products/ethiopia-guji-natural-200g</loc></url>
  <url><loc>https://shop.example/items/kenya-kiambu-washed-100g</loc></url>
  <url><loc>https://shop.example/collections/all</loc></url>
  <url><loc>https://shop.example/pages/about</loc></url>
  <url><loc>https://shop.example/products/drip-kettle</loc></url>
  <!-- 仕様では絶対URLだが、相対パスを書いている店が実在する。
       そのまま httpx に渡すと ValueError で巡回そのものが止まっていた。 -->
  <url><loc>/products/compostable-coffee-capsules-fivr</loc></url>
  <url><loc>mailto:shop@example.com</loc></url>
</urlset>"""

# 単体の Product（Squarespace / BASE などによくある形）
PAGE_PLAIN = """<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product",
 "name":"Ethiopia Guji Natural 200g",
 "image":"https://img.example/guji.jpg",
 "description":"<p>Tasting Notes: strawberry, jasmine, black tea</p><p>Natural process</p>",
 "offers":{"@type":"Offer","price":"1980","priceCurrency":"JPY",
           "availability":"https://schema.org/InStock"}}
</script></head><body></body></html>"""

# @graph でまとめる形（WordPress / Yoast などが出す）
PAGE_GRAPH = """<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
 {"@type":"WebPage","name":"商品ページ"},
 {"@type":"Product","name":"Kenya Kiambu Washed 100g",
  "image":["https://img.example/kenya.jpg"],
  "description":"Flavour notes: blackcurrant, orange, caramel",
  "offers":[{"@type":"AggregateOffer","lowPrice":"1450","priceCurrency":"JPY",
             "availability":"https://schema.org/OutOfStock"}]}]}
</script></head><body></body></html>"""

# JSON-LD が無いページ（器具など）
PAGE_NONE = "<html><head><title>Drip Kettle</title></head><body></body></html>"

PAGES = {
    "https://shop.example/sitemap.xml": SITEMAP_INDEX,
    "https://shop.example/sitemap_products_1.xml": SITEMAP_PRODUCTS,
    "https://shop.example/products/ethiopia-guji-natural-200g": PAGE_PLAIN,
    "https://shop.example/items/kenya-kiambu-washed-100g": PAGE_GRAPH,
    "https://shop.example/products/drip-kettle": PAGE_NONE,
}


class FakeResponse:
    def __init__(self, text: str, status: int = 200):
        self.text = text
        self.status_code = status


class FakeClient:
    """店の代わり。知っているURLだけ返し、他は404にする。"""

    def __init__(self):
        self.seen: list[str] = []

    async def get(self, url: str, params: dict | None = None):
        self.seen.append(url)
        if url in PAGES:
            return FakeResponse(PAGES[url])
        return FakeResponse("", 404)


def main() -> None:
    client = FakeClient()
    r = {"name": "Example Roasters", "country": "JP", "url": "https://shop.example", "currency": "JPY"}
    got = asyncio.run(crawler._fetch_generic(client, r))

    assert got is not None, "商品が1件も取れていない"
    assert len(got) == 2, f"商品ページ2枚から2件のはずが {len(got)}件"
    a, b = got

    assert a.title == "Ethiopia Guji Natural 200g", a.title
    assert a.price == 1980.0, a.price
    assert a.currency == "JPY", a.currency
    assert a.grams == 200, a.grams
    assert a.available is True, "InStock を売り切れにしている"
    assert a.origin == "Ethiopia", a.origin
    assert a.process == "Natural", a.process
    assert "strawberry" in a.notes, a.notes
    assert a.image == "https://img.example/guji.jpg", a.image

    assert b.title == "Kenya Kiambu Washed 100g", b.title
    assert b.price == 1450.0, b.price            # AggregateOffer の lowPrice
    assert b.available is False, "OutOfStock を在庫ありにしている"
    assert b.image == "https://img.example/kenya.jpg", b.image   # 配列の先頭
    assert "blackcurrant" in b.notes, b.notes

    # 一覧・固定ページは開かない（無駄な往復を増やさない）
    assert "https://shop.example/collections/all" not in client.seen
    assert "https://shop.example/pages/about" not in client.seen

    # 相対パスの <loc> は店のドメインに繋いでから開く。生のまま渡すと
    # httpx が ValueError を投げ、httpx.HTTPError では捕まらないので巡回が止まる。
    assert "/products/compostable-coffee-capsules-fivr" not in client.seen, "相対パスを生のまま開いている"
    assert "https://shop.example/products/compostable-coffee-capsules-fivr" in client.seen, \
        "相対パスの商品ページを開けていない"
    # http(s) でないものは開かない
    assert not any(u.startswith("mailto:") for u in client.seen), client.seen

    # 1店で例外が出ても、その店の失敗として返る（他の店の結果を道連れにしない）
    async def boom(*a, **k):
        raise ValueError("unknown url type: '/products/x'")

    orig, crawler._fetch_any = crawler._fetch_any, boom
    try:
        # client は robots.txt を読むのに実際に使われる（None は渡せない）
        _, res = asyncio.run(crawler.crawl_roaster(
            FakeClient(), {"name": "壊れた店", "url": "https://x.example"}, 2,
            asyncio.Semaphore(1)))
    finally:
        crawler._fetch_any = orig
    assert res is None, "例外を投げた店が成功扱いになっている"
    assert "ValueError" in crawler.LAST_REASON["壊れた店"], crawler.LAST_REASON["壊れた店"]

    # sitemap が無い店は、理由を残して None を返す
    class Empty(FakeClient):
        async def get(self, url, params=None):
            return FakeResponse("", 404)

    none = asyncio.run(crawler._fetch_generic(Empty(), {**r, "name": "No Sitemap"}))
    assert none is None, "sitemap が無いのに商品を返している"
    assert "sitemap" in crawler.LAST_REASON["No Sitemap"], crawler.LAST_REASON

    print(f"OK  商品{len(got)}件 / 開いたURL {len(client.seen)}本")
    for p in got:
        print(f"   {p.title[:34]:36s} {p.price:>8,.0f} {p.currency} "
              f"{'在庫あり' if p.available else '売り切れ'}  {p.notes[:34]}")


if __name__ == "__main__":
    main()
