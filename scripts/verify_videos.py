"""レシピに貼る動画が、本当にその人の回かを確かめる。

  python scripts/verify_videos.py

IDを1文字間違えると、まったく別の動画が本人の名前の下に載る。見た目には
気づけないので、貼る前に必ず通す。開発環境からは外に出られないので runner で走らせる。

YouTube の oEmbed は鍵なしで題名と投稿者を返す。RecipeView.jsx から video のIDを
拾って照合し、題名に競技者の名前と年が入っているかまで見る。
"""
from __future__ import annotations
import re
import sys
import unicodedata
from pathlib import Path
from urllib.parse import quote

import httpx

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "frontend" / "components" / "views" / "RecipeView.jsx"

def entries(src: str) -> list[dict]:
    out = []
    # レシピは "comp:" で始まる塊。塊ごとに切ってから読む
    for block in src.split("    comp:")[1:]:
        y = re.search(r'year:\s*"(\d{4})"', block)
        w = re.search(r'winner:\s*"([^"]+)"', block)
        v = re.search(r'video:\s*"([^"]*)"', block)
        if y and w:
            out.append({"year": y.group(1), "winner": w.group(1), "video": v.group(1) if v else ""})
    return out


def norm(s: str) -> str:
    """照合用。全角・記号・大小を均す。"""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", s.lower())


def main() -> None:
    src = SRC.read_text(encoding="utf-8")
    rows = entries(src)
    print(f"レシピ {len(rows)} 件 / 動画あり {sum(1 for r in rows if r['video'])} 件\n")

    ng = 0
    with httpx.Client(timeout=20, follow_redirects=True,
                      headers={"User-Agent": "bean-tracker video check"}) as c:
        for r in rows:
            if not r["video"]:
                print(f"—  {r['year']}  {r['winner']:<28} 動画なし")
                continue
            url = f"https://www.youtube.com/watch?v={r['video']}"
            try:
                resp = c.get(f"https://www.youtube.com/oembed?url={quote(url, safe='')}&format=json")
            except httpx.HTTPError as e:
                print(f"✗  {r['year']}  {r['winner']:<28} 届かない（{type(e).__name__}）")
                ng += 1
                continue
            if resp.status_code != 200:
                # 404 = 消えたか非公開。401/403 = 埋め込み不可
                print(f"✗  {r['year']}  {r['winner']:<28} HTTP {resp.status_code}（{r['video']}）")
                ng += 1
                continue
            d = resp.json()
            title, author = d.get("title", ""), d.get("author_name", "")
            t = norm(title)
            # 題名に本人の名字か年が入っているか。どちらも無ければ人違いを疑う
            names = [norm(x) for x in re.split(r"[ 　（(]", r["winner"]) if len(x) > 2]
            hit_name = any(n and n in t for n in names)
            hit_year = r["year"] in title
            mark = "✓" if (hit_name and hit_year) else "▲"
            if mark == "▲":
                ng += 1
            print(f"{mark}  {r['year']}  {r['winner']:<28} {title[:58]}")
            print(f"       投稿: {author}  /  名前{'一致' if hit_name else '不一致'}・年{'一致' if hit_year else '不一致'}")

    print()
    if ng:
        print(f"★ 確かめられなかったものが {ng} 件あります。貼る前に見直してください。")
        sys.exit(1)
    print("すべて本人の回でした。")


if __name__ == "__main__":
    main()
