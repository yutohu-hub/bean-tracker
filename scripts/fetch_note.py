"""note の記事一覧を取り込む。

About から note へリンクを置いているだけだったので、実際に何を書いているかは
開いてみないと分からなかった。記事の見出しをサイト側に出す。

静的サイトなので、ブラウザから note.com を直接読むことはできない
（RSS は CORS を許していないため fetch が落ちる）。豆の巡回と同じで、
取得はワークフロー側で行い、結果をJSONに焼き込んでフロントはそれを読む。

  python scripts/fetch_note.py

取得できなければ既存のJSONを残す。note が落ちている日に、
About から記事一覧が消えるほうが困る。
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from xml.etree import ElementTree

import httpx

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "components" / "data" / "note.generated.json"
USER = "higghhffuigfdty"
FEED = f"https://note.com/{USER}/rss"
MAX_ITEMS = 5
UA = "bean-tracker/1.0 (+https://github.com/yutohu-hub/bean-tracker)"

_TAGS = re.compile(r"(?is)<[^>]+>")
_WS = re.compile(r"\s+")


def _text(el, tag: str) -> str:
    node = el.find(tag)
    return (node.text or "").strip() if node is not None and node.text else ""


def _plain(html: str, limit: int = 90) -> str:
    """説明文からタグを落として1行にする。"""
    s = _TAGS.sub(" ", html or "")
    s = (s.replace("&nbsp;", " ").replace("&amp;", "&")
          .replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"'))
    s = _WS.sub(" ", s).strip()
    return s[:limit]


def parse(xml: str) -> list[dict]:
    """RSS から記事を取り出す。note は media:thumbnail に画像を入れている。"""
    ns = {"media": "http://search.yahoo.com/mrss/",
          "content": "http://purl.org/rss/1.0/modules/content/"}
    root = ElementTree.fromstring(xml)
    items = []
    for it in root.iterfind(".//item"):
        title = _text(it, "title")
        link = _text(it, "link")
        if not title or not link:
            continue
        thumb = ""
        node = it.find("media:thumbnail", ns)
        if node is not None:
            thumb = (node.text or node.get("url") or "").strip()
        # pubDate は "Sat, 02 Aug 2026 09:00:00 +0900" 形式。日付だけ取り出す
        pub = _text(it, "pubDate")
        m = re.search(r"(\d{1,2})\s+(\w{3})\s+(\d{4})", pub)
        MON = {"Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06",
               "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12"}
        date = f"{m.group(3)}-{MON.get(m.group(2), '01')}-{int(m.group(1)):02d}" if m else ""
        items.append({
            "title": title, "url": link, "date": date,
            "excerpt": _plain(_text(it, "description")),
            **({"img": thumb} if thumb else {}),
        })
        if len(items) >= MAX_ITEMS:
            break
    return items


def main() -> None:
    try:
        r = httpx.get(FEED, headers={"User-Agent": UA}, timeout=20, follow_redirects=True)
        if r.status_code != 200:
            print(f"note: HTTP {r.status_code} — 既存のまま据え置き")
            return
        items = parse(r.text)
    except Exception as e:
        print(f"note: 取得できず（{type(e).__name__}）— 既存のまま据え置き")
        return

    if not items:
        print("note: 記事が取れなかった — 既存のまま据え置き")
        return

    OUT.write_text(json.dumps({"user": USER, "items": items}, ensure_ascii=False),
                   encoding="utf-8")
    print(f"note: {len(items)}件を取り込みました")
    for i in items:
        print(f"   {i['date']}  {i['title'][:48]}")


if __name__ == "__main__":
    main()
