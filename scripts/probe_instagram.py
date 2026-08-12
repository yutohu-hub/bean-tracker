"""店のページから Instagram のアカウント名が取れるかを実測する。

  python scripts/probe_instagram.py        全店
  python scripts/probe_instagram.py 80     先頭80店

■ なぜ要るのか

図鑑のロースター欄に Instagram を出したい。ただし 447 店ぶんの
アカウント名をどこからも持っていない。手で集めるのは現実的でないので、
店のトップページに貼ってある導線から拾えるかを先に測る。

取れる割合が低ければ、その機能は「ある店には出る、無い店には出ない」に
なるので、どういう見せ方にするかが変わる。だから先に数える。

■ 拾い方

トップページの HTML から instagram.com へのリンクを全部拾い、
アカウント名の形をしていないもの（投稿・タグ・共有ボタンなど）を落とす。
複数見つかったときは、いちばん多く出てくるものを店のアカウントとみなす
（フッターとヘッダーの両方に置く店が多い。他店への言及は1回しか出ない）。
"""
from __future__ import annotations
import asyncio
import re
import sys
from collections import Counter
from pathlib import Path

import httpx
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from crawler import REQ_HEADERS  # noqa: E402

CONCURRENCY = 24
TIMEOUT = 20.0

_LINK = re.compile(
    r"(?:https?:)?//(?:www\.)?instagram\.com/([^/?\"'\s>&#]+)", re.I)

# アカウント名ではない場所。投稿・タグ・埋め込み・共有ボタンなど
_NOT_ACCOUNT = {
    "p", "reel", "reels", "tv", "stories", "explore", "accounts", "directory",
    "about", "developer", "legal", "privacy", "terms", "embed", "share",
    "sharer", "oauth", "web", "graphql", "api", "static", "images", "favicon",
}
# Instagram のアカウント名の決まり: 英数字・ピリオド・アンダースコア、30字まで
_HANDLE = re.compile(r"^[A-Za-z0-9._]{1,30}$")


def handles_in(html: str) -> list[str]:
    out = []
    for raw in _LINK.findall(html or ""):
        h = raw.strip().strip(".").lower()
        if not h or h in _NOT_ACCOUNT or not _HANDLE.match(h):
            continue
        out.append(h)
    return out


async def probe(client: httpx.AsyncClient, sem: asyncio.Semaphore, r: dict):
    base = r["url"].rstrip("/")
    async with sem:
        try:
            resp = await client.get(base)
        except httpx.HTTPError as e:
            return r, None, f"接続失敗({type(e).__name__})"
    if resp.status_code != 200:
        return r, None, f"HTTP {resp.status_code}"
    found = handles_in(resp.text)
    if not found:
        return r, None, "リンク無し"
    # いちばん多く出てくるものを店のアカウントとみなす
    return r, Counter(found).most_common(1)[0][0], ""


async def run(shops: list) -> None:
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(headers=REQ_HEADERS, timeout=TIMEOUT,
                                 follow_redirects=True) as client:
        results = await asyncio.gather(*(probe(client, sem, r) for r in shops))

    got = [(r["name"], h) for r, h, _ in results if h]
    miss = [(r["name"], why) for r, h, why in results if not h]
    print(f"調べた店 {len(results)} 軒 / アカウントが取れた {len(got)} 軒 "
          f"({len(got) / max(len(results), 1) * 100:.1f}%)\n")

    print("■ 取れた例（先頭30）")
    for name, h in got[:30]:
        print(f"   {name[:26]:<26} @{h}")

    print("\n■ 取れなかった理由")
    for why, n in Counter(w for _, w in miss).most_common():
        print(f"   {why:<20} {n} 軒")
    print("\n■ 取れなかった店（先頭20）")
    for name, why in miss[:20]:
        print(f"   {name[:26]:<26} {why}")

    # 同じアカウントが複数の店に付いたら、拾い方を間違えている疑い
    dup = [(h, n) for h, n in Counter(h for _, h in got).items() if n > 1]
    if dup:
        print("\n■ 複数の店で同じアカウントになった（拾い方の誤りを疑う）")
        for h, n in sorted(dup, key=lambda x: -x[1])[:15]:
            print(f"   @{h}  {n}軒")


def main() -> None:
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    cfg = yaml.safe_load((ROOT / "config" / "roasters.yaml").read_text(encoding="utf-8"))
    shops = [r for r in cfg.get("roasters", []) if r.get("url")]
    if limit:
        shops = shops[:limit]
    print(f"調べる店 {len(shops)} 軒（{CONCURRENCY}軒ずつ並行）\n")
    asyncio.run(run(shops))


if __name__ == "__main__":
    main()
