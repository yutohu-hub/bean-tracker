"""「豆である証拠」で選ぶ取り方を、実際の店の商品で試す。

  python scripts/audit_bean_markers.py          全店
  python scripts/audit_bean_markers.py 60       先頭60店

■ なぜ要るのか

いまの取り方は「全部取ってから、豆でないものを外す」（引き算）。外す語は
各国語ぶん要るので一覧が終わらず、広げると本物の豆を巻き添えにする。
逆に「豆である証拠がある物だけ取る」（足し算）に変えたい。

ただし線引きを想像で決めると本物の豆が消える。消えたことは画面を見ても
分からない（無い物は見えない）。だから候補の規則を実データに当てて、
何を落とすかを目で見てから決める。

■ 1回目の測定で分かったこと（4127件）

  ・Shopify の重量欄は 92.4% の商品に入っていた。出荷重量なので、マグにも
    T シャツにも付く。単独では何も分けられない → 証拠から外した
  ・説明文から読んだ産地は当てにならない。CLEVER DRIPPER が「台湾」で
    産地ありになった。台湾製だから → 弱い証拠として区別する

そこで証拠を「商品名にある強い証拠」と「説明文にある弱い証拠」に分けた。

■ 出すもの

各規則について、通る件数と、**落とすものの中身**。とくに店が自分で
「コーヒー」と書いている商品を落とした場合は、本物の豆を切った疑いが濃いので
全部数えて例を出す。
"""
from __future__ import annotations
import asyncio
import random
import sys
from collections import Counter
from pathlib import Path

import httpx
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from crawler import (REQ_HEADERS, _grams_from_text, html_to_text,  # noqa: E402
                     shop_says, bean_markers, _looks_like_coffee, STRONG, WEAK)

CONCURRENCY = 24
TIMEOUT = 20.0

# 試す規則。名前 → 判定
#   S = 強い証拠の数（商品名・タグ）   K = 弱い証拠の数（説明文）
#   g = 重量欄あり                    c = 店がコーヒーと申告
RULES: dict = {
    "A 強1つ以上": lambda S, K, g, c: S >= 1,
    "B 強1つ以上 or (申告+重量)": lambda S, K, g, c: S >= 1 or (c and g),
    "C 強2つ以上": lambda S, K, g, c: S >= 2,
    "D 強1つ + (弱or申告)": lambda S, K, g, c: S >= 2 or (S >= 1 and (K >= 1 or c)),
    "E 強1つ以上 or 申告": lambda S, K, g, c: S >= 1 or c,
    "F 強2つ以上 or (強1+申告)": lambda S, K, g, c: S >= 2 or (S >= 1 and c),
}


async def fetch(client: httpx.AsyncClient, sem: asyncio.Semaphore, r: dict):
    base = r["url"].rstrip("/")
    async with sem:
        try:
            resp = await client.get(f"{base}/products.json", params={"limit": 250})
        except httpx.HTTPError:
            return r, None
    if resp.status_code != 200:
        return r, None
    try:
        return r, (resp.json().get("products", []) or None)
    except ValueError:
        return r, None


def markers_of(p: dict) -> set:
    v = (p.get("variants") or [{}])[0]
    titletext = f"{v.get('title', '')} {p.get('title', '')}"
    tagtext = (" ".join(p.get("tags", [])) if isinstance(p.get("tags"), list)
               else str(p.get("tags", "")))
    return bean_markers(
        title=f"{p.get('title', '')} {tagtext}",
        body=html_to_text(p.get("body_html") or "")[:1200],
        grams_field=int(v.get("grams") or 0),
        grams_title=_grams_from_text(titletext),
        kind=shop_says(p),
    )


async def run(shops: list) -> None:
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(headers=REQ_HEADERS, timeout=TIMEOUT,
                                 follow_redirects=True) as client:
        results = await asyncio.gather(*(fetch(client, sem, r) for r in shops))

    rows: list = []          # (店名, 商品名, 証拠, 店の申告, いまの引き算で通るか)
    reached = 0
    for r, prods in results:
        if not prods:
            continue
        reached += 1
        for p in prods:
            rows.append((r["name"][:14], (p.get("title") or "").strip()[:52],
                         markers_of(p), shop_says(p) == "c",
                         _looks_like_coffee(p)))

    total = len(rows)
    print(f"応答のあった店 {reached} 軒 / 商品 {total} 件\n")

    each: Counter = Counter()
    for _, _, m, _, _ in rows:
        for k in m:
            each[k] += 1
    print("■ 証拠ごとの件数")
    print("  強い証拠（商品名・タグ）")
    for k, label in zip(STRONG, ("内容量", "産地", "精製", "品種", "焙煎度")):
        print(f"    {k} {label:<6} {each[k]:>6} 件 ({each[k] / max(total, 1) * 100:5.1f}%)")
    print("  弱い証拠（説明文）")
    for k, label in zip(WEAK, ("産地", "精製", "品種", "焙煎度")):
        print(f"    {k} {label:<6} {each[k]:>6} 件 ({each[k] / max(total, 1) * 100:5.1f}%)")
    print(f"  参考  g 重量欄 {each['g']:>6} 件 / c 店の申告 {each['c']:>6} 件")

    rnd = random.Random(0)
    for name, ok in RULES.items():
        kept, dropped_declared, kept_undeclared = [], [], []
        for shop, title, m, declared, old in rows:
            S = sum(1 for k in STRONG if k in m)
            K = sum(1 for k in WEAK if k in m)
            passed = ok(S, K, "g" in m, declared)
            if passed:
                kept.append((shop, title))
                if not declared:
                    kept_undeclared.append((shop, title))
            elif declared:
                dropped_declared.append((shop, title))

        print(f"\n{'=' * 74}\n■ 規則 {name}")
        print(f"  通る {len(kept)} 件 ({len(kept) / max(total, 1) * 100:.1f}%)"
              f" / 落とす {total - len(kept)} 件")
        print(f"  うち「店がコーヒーと書いているのに落とした」 {len(dropped_declared)} 件"
              "  ← 本物の豆を切った疑い")
        for shop, title in dropped_declared[:14]:
            print(f"      {shop:<14} {title}")
        print("  店が何も書いていないのに通した物（この規則だけが根拠）:")
        for shop, title in rnd.sample(kept_undeclared,
                                      min(14, len(kept_undeclared))):
            print(f"      {shop:<14} {title}")


def main() -> None:
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    cfg = yaml.safe_load((ROOT / "config" / "roasters.yaml").read_text(encoding="utf-8"))
    shops = [r for r in cfg.get("roasters", []) if r.get("url")]
    if limit:
        shops = shops[:limit]
    print(f"調べる店 {len(shops)} 軒（1店あたり先頭250商品・{CONCURRENCY}軒ずつ並行）\n")
    asyncio.run(run(shops))


if __name__ == "__main__":
    main()
