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
                     shop_says, bean_markers, _looks_like_coffee, option_text,
                     has_bean_evidence, shop_denies_hard,
                     STRONG, WEAK)

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
    opts = option_text(p)
    tagtext = (" ".join(p.get("tags", [])) if isinstance(p.get("tags"), list)
               else str(p.get("tags", "")))
    return bean_markers(
        title=f"{p.get('title', '')} {tagtext}",
        body=html_to_text(p.get("body_html") or "")[:1200],
        grams_field=int(v.get("grams") or 0),
        grams_title=_grams_from_text(f"{p.get('title', '')} {opts}"),
        kind=shop_says(p),
        options=opts,
    )


async def run(shops: list) -> None:
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(headers=REQ_HEADERS, timeout=TIMEOUT,
                                 follow_redirects=True) as client:
        results = await asyncio.gather(*(fetch(client, sem, r) for r in shops))

    rows: list = []          # (店名, 商品名, 証拠, 店の申告, いまの引き算で通るか)
    reached = 0
    # 落ちた理由を1件ずつ確かめたい商品。実物の中身を出す。
    # 「なぜ落ちたのか」を想像で語らないため。
    WATCH = ("kapsokisio", "io-e-1", "scattered salinas")
    watched: list = []
    for r, prods in results:
        if not prods:
            continue
        reached += 1
        for p in prods:
            title = (p.get("title") or "").strip()
            rows.append((r["name"][:14], title[:52],
                         markers_of(p), shop_says(p) == "c",
                         _looks_like_coffee(p), r["name"],
                         (p.get("product_type") or "").strip(),
                         int((p.get("variants") or [{}])[0].get("grams") or 0),
                         has_bean_evidence(p), shop_denies_hard(p),
                         (p.get("tags") or [])))
            if any(w in title.lower() for w in WATCH):
                watched.append((r["name"], title, p))

    if watched:
        print("■ 名指しで中身を見る商品")
        for shop, title, p in watched[:6]:
            print(f"  {shop} / {title}")
            print(f"    product_type = {p.get('product_type')!r}")
            print(f"    options      = {p.get('options')}")
            print(f"    variants     = "
                  f"{[(v.get('title'), v.get('grams')) for v in (p.get('variants') or [])][:4]}")
            print(f"    tags         = {p.get('tags')}")
            print(f"    証拠         = {''.join(sorted(markers_of(p)))}")
        print()

    total = len(rows)
    print(f"応答のあった店 {reached} 軒 / 商品 {total} 件\n")

    # 商品の種類を1つも書いていない店。そういう店では店の申告が使えないので、
    # 門が不当に厳しくなる（Tim Wendelboe がこれ。全商品で product_type が空）。
    silent_shops = {s for _, _, _, _, _, s, *_ in rows}
    for _, _, _, _, _, shop, ptype, *_ in rows:
        if ptype:
            silent_shops.discard(shop)
    print(f"■ 商品の種類を1つも書いていない店 {len(silent_shops)} 軒: "
          f"{', '.join(sorted(silent_shops)[:12])}\n")

    each: Counter = Counter()
    for _, _, m, _, _, _, _, *_ in rows:
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

    report_hard_deny(rows, total)

    rnd = random.Random(0)
    for name, ok in RULES.items():
        kept, dropped_declared, kept_undeclared = [], [], []
        for shop, title, m, declared, old, _s, _pt, _g, *_ in rows:
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

    # 門の候補ごとに「今日の巡回で何が消えるか」を出す。
    # 規則を数字で比べるだけでは踏み切れない。落ちる物の中身を見ないと、
    # 本物の豆が混じっていることに気づけない（実際 Kapsokisio で気づいた）。
    # silent = 商品の種類を1つも書かない店の商品。店の申告に頼れない
    # ship = Shopify の出荷重量
    GATES = {
        "いま入っている門（強1つ以上 or 申告）":
            lambda S, K, d, silent, ship: S >= 1 or d,
        "＋説明文の証拠が2つ以上あれば通す":
            lambda S, K, d, silent, ship: S >= 1 or d or K >= 2,
        "＋種類を書かない店では、袋らしい重さ（150〜1500g）も証拠に数える":
            lambda S, K, d, silent, ship: (S >= 1 or d
                                           or (silent and 150 <= ship <= 1500)),
        "＋その店で、説明文の証拠が1つ以上あるものに限る":
            lambda S, K, d, silent, ship: (S >= 1 or d
                                           or (silent and 150 <= ship <= 1500
                                               and K >= 1)),
    }
    old = [(s, t) for s, t, m, d, o, _s, _pt, _g in rows if o]
    for label, gate in GATES.items():
        now, newly_cut = [], []
        for shop, title, m, declared, o, sname, _pt, ship in rows:
            if not o:
                continue                      # もともと取っていない物は関係ない
            S = sum(1 for k in STRONG if k in m)
            K = sum(1 for k in WEAK if k in m)
            (now if gate(S, K, declared, sname in silent_shops, ship)
             else newly_cut).append((shop, title))
        print(f"\n{'=' * 74}\n■ {label}")
        print(f"  これまでの取り込み {len(old)} 件 → これから {len(now)} 件"
              f"（{len(newly_cut)} 件 減る）")
        print("  新たに落ちるもの（20件を無作為に）:")
        for shop, title in rnd.sample(newly_cut, min(20, len(newly_cut))):
            print(f"      {shop:<14} {title}")


def main() -> None:
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    cfg = yaml.safe_load((ROOT / "config" / "roasters.yaml").read_text(encoding="utf-8"))
    shops = [r for r in cfg.get("roasters", []) if r.get("url")]
    if limit:
        shops = shops[:limit]
    print(f"調べる店 {len(shops)} 軒（1店あたり先頭250商品・{CONCURRENCY}軒ずつ並行）\n")
    asyncio.run(run(shops))


def report_hard_deny(rows: list, total: int) -> None:
    """店が「器具・雑貨・講座」と書いているのに、いまの門を通っている物を数える。

    いまの門（has_bean_evidence）は「豆の証拠が1つでもあれば通す」ので、
    店の否定より名前の中の産地が勝つ。実データでは Fellow の器具が
    "Fellow Costa Rica, La Guaca" という名前で図鑑に並んでいた。

    ここで出すのは2つだけ。
      ・この規則を足すと消える件数と、その中身
      ・そのうち「本物の豆かもしれない物」＝店の否定と豆の証拠が食い違う物
    """
    import random
    passes = [r for r in rows if r[8]]
    denied = [r for r in passes if r[9]]
    print(f"\n{'=' * 74}")
    print("■ 店がはっきり「コーヒーではない」と書いているのに、いまの門を通る物")
    print(f"  いまの門を通る {len(passes)} 件 / うち店が否定 {len(denied)} 件"
          f" （通る物の {len(denied) / max(len(passes), 1) * 100:.1f}%）")
    kinds: Counter = Counter(r[6].lower() for r in denied)
    print("  店が書いている種類（多い順）")
    for k, n in kinds.most_common(12):
        print(f"      {(k or '(タグでの否定)')[:34]:<36} {n:>5} 件")
    rnd = random.Random(1)
    print("  中身（無作為20件）")
    for shop, title, *_rest in rnd.sample(denied, min(20, len(denied))):
        print(f"      {shop:<14} {title}")
    # 否定されているのに強い証拠が2つ以上ある物。豆を切る危険はここに出る
    risky = [r for r in denied if sum(1 for k in STRONG if k in r[2]) >= 2]
    print(f"  うち強い証拠が2つ以上ある物 {len(risky)} 件 ← 豆を切る危険はここ")
    for shop, title, *_rest in rnd.sample(risky, min(20, len(risky))):
        print(f"      {shop:<14} {title}")


if __name__ == "__main__":
    main()

