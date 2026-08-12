"""店のページから Instagram のアカウント名を集めて config/instagram.yaml に貯める。

  python scripts/collect_instagram.py            全店を見て、結果を書き込む
  python scripts/collect_instagram.py 80         先頭80店だけ
  python scripts/collect_instagram.py 0 --dry    書き込まずに数えるだけ

■ なぜ毎時の巡回に混ぜないのか

アカウント名はめったに変わらない。毎時の巡回に1リクエスト足すと、
447店ぶんの負荷が毎時かかるだけで、得るものが無い。
たまに走らせてファイルに貯め、そのファイルを図鑑が読む形にする。

■ なぜ一度に全店を叩かないのか

実測: 447店を24軒ずつ並行で叩いたら、199軒が 429（レート制限）で落ちた。
GitHub の IP は共有なので、Shopify 側が早々に締める。
少しずつ回して、取れたぶんだけファイルに足していく（前の結果は消さない）。

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

CONCURRENCY = 6      # 24 で叩いたら 447店中199軒が429だった
TIMEOUT = 20.0
OUT = ROOT / "config" / "instagram.yaml"

_LINK = re.compile(
    r"(?:https?:)?//(?:www\.)?instagram\.com/([^/?\"'\s>&#]+)", re.I)

# アカウント名ではない場所。投稿・タグ・埋め込み・共有ボタンなど
_NOT_ACCOUNT = {
    "p", "reel", "reels", "tv", "stories", "explore", "accounts", "directory",
    "about", "developer", "legal", "privacy", "terms", "embed", "share",
    "sharer", "oauth", "web", "graphql", "api", "static", "images", "favicon",
}
# 店のアカウントではないと分かっているもの。
# 実測で Padre Coffee が @shopify になった（フッターの「Powered by Shopify」）。
# 店のページには、使っている道具や決済の会社の導線が必ず貼ってある。
# 名前が似ていないときの最後の手段（いちばん多く出てくるもの）が、これを拾う。
_NOT_A_SHOP = {
    "shopify", "shopifypartners", "shopifyplus", "instagram", "facebook", "meta",
    "klaviyo", "mailchimp", "squarespace", "wix", "wordpress", "woocommerce",
    "stripe", "paypal", "shoppay", "afterpay", "klarna", "square",
    "tiktok", "youtube", "twitter", "x", "pinterest", "linkedin", "threads",
    "spotify", "whatsapp", "google", "apple", "amazon", "etsy", "patreon",
    "kickstarter", "vimeo", "snapchat", "discord", "telegram", "reddit",
    "tumblr", "flickr", "behance", "dribbble", "medium", "substack", "github",
    "judgeme", "yotpo", "recharge", "gorgias", "okendo", "loox", "printful",
    "canva", "figma", "webflow", "wordpressdotcom", "godaddy",
}
# Instagram のアカウント名の決まり: 英数字・ピリオド・アンダースコア、30字まで。
# ただし4字以下は採らない。実測で 49th Parallel が @49th になった
# （店名の頭と一致するので「似ている」と判断された）。短い文字列は、
# 途中で切れたリンクや飾りからも簡単に出てくる。
_HANDLE = re.compile(r"^[A-Za-z0-9._]{5,30}$")
# 投稿のID。店のページに Instagram のフィードを貼っている店から拾える
_POST = re.compile(r"instagram\.com/(?:p|reel)/([A-Za-z0-9_-]{5,24})", re.I)


def handles_in(html: str) -> list[str]:
    out = []
    for raw in _LINK.findall(html or ""):
        h = raw.strip().strip(".").lower()
        if not h or h in _NOT_ACCOUNT or h in _NOT_A_SHOP or not _HANDLE.match(h):
            continue
        out.append(h)
    return out


# どの店の名前にも入っている業種の言葉。店を見分ける手がかりにならない
_GENERIC_WORDS = {
    "coffee", "coffees", "coffe", "cafe", "café", "caffe", "caffè", "kaffe",
    "kaffee", "koffie", "kahve", "cafes", "roasters", "roaster", "roasting",
    "roastery", "roasterie", "roast", "roasted", "beans", "bean", "espresso",
    "specialty", "speciality", "company", "coffeeroasters", "coffeeroasting",
    "coffeeco", "roastingco", "brewing", "brew", "torrefaction", "tostadores",
}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def pick_handle(found: list[str], shop_name: str) -> str:
    """候補の中から、その店のアカウントを選ぶ。

    出てくる回数だけで決めると、フッターに載っている制作会社や取引先を拾う。
    実測で Single O が @process_creative になった（サイトを作った会社）。

    店名と結びつくものだけを採る。結びつかないものは採らない。

    ■ 「いちばん多く出てくるもの」を最後の手段にしない

    はじめは、名前が似ていなければ回数で決めていた。実測で2件外した。

      Padre Coffee          → @shopify（フッターの「Powered by Shopify」）
      Slate Coffee Roasters → @xoilactvnet（店とは無関係の宣伝。何度も出てくる）

    回数は「店のものらしさ」を測っていない。ページに何度も貼られているだけの
    ものが勝つ。実データ308件のうち、回数だけで決まっていたのは3件。
    そのうち1件が上の間違いだった。残る2件（略称・日本語の店名）は、
    この表を手で直して足せばよい。

    間違ったアカウントを出すのは、何も出さないより悪い。別の人の投稿を
    「この店です」と紹介することになる。取りこぼしは次に集めれば埋まる。
    """
    if not found:
        return ""
    n = _norm(shop_name)
    if not n:
        # 日本語だけの店名。綴りの手がかりが無いので、ここでは決めない
        return ""
    counts = Counter(found)
    best = lambda hs: max(hs, key=lambda h: (counts[h], -len(h)))
    near = [h for h in counts if _norm(h).startswith(n) or n.startswith(_norm(h))]
    if near:
        return best(near)
    # 部分的に含むもの（"coffeecollective" と "coffeecollectif" のような揺れ）
    part = [h for h in counts if len(n) >= 5 and (n[:6] in _norm(h) or _norm(h)[:6] in n)]
    if part:
        return best(part)
    # 店名の単語が入っているもの（"Luna" → @enjoylunacoffee）。
    # ただし業種の言葉（coffee / roasters …）では照らし合わせない。
    # 実測で Dark Matter Coffee が @ridmanscoffee、Comete Coffee Roasters が
    # @interpret_coffee になった。どちらも "coffee" だけで一致していた。
    # 業種の言葉は、そのページに載っている他店のアカウントにも必ず入っている
    words = [w for w in re.findall(r"[a-z0-9]+", shop_name.lower())
             if len(w) >= 4 and w not in _GENERIC_WORDS]
    word = [h for h in counts if any(w in _norm(h) for w in words)]
    if word:
        return best(word)
    return ""


async def probe(client: httpx.AsyncClient, sem: asyncio.Semaphore, r: dict):
    base = r["url"].rstrip("/")
    async with sem:
        try:
            resp = await client.get(base)
        except httpx.HTTPError as e:
            return r, None, f"接続失敗({type(e).__name__})", []
    if resp.status_code != 200:
        return r, None, f"HTTP {resp.status_code}", []
    found = handles_in(resp.text)
    posts = _POST.findall(resp.text)
    if not found:
        return r, None, "リンク無し", posts
    h = pick_handle(found, r.get("name", ""))
    if not h:
        # 候補はあったが、店のものだと言い切れなかった。理由を分けて数える
        return r, None, "店のものか決められない", posts
    return r, h, "", posts


async def check_embed(handles: list[str], posts: list = ()) -> None:
    """プロフィールの埋め込みが本当に使えるかを確かめる。

    記憶で「使える/使えない」を決めない。実際に叩いて、返ってきたものを見る。
    Instagram は公開プロフィールの埋め込みを止めた（ログイン画面が返る）はずだが、
    仕様は変わるので、そのときの本当の応答で判断する。
    """
    print(f"\n■ 店のページから拾えた投稿ID: {len(posts)} 件")
    for name, code in posts[:5]:
        print(f"   {name[:26]:<26} /p/{code}/")
    urls = []
    for _, code in posts[:2]:
        urls.append((f"投稿の埋め込み /p/{code}", f"https://www.instagram.com/p/{code}/embed/"))
    for h in handles[:2]:
        urls.append((f"プロフィール埋め込み @{h}", f"https://www.instagram.com/{h}/embed"))
        urls.append((f"プロフィール       @{h}", f"https://www.instagram.com/{h}/"))
    async with httpx.AsyncClient(headers=REQ_HEADERS, timeout=TIMEOUT,
                                 follow_redirects=True) as client:
        print("\n■ 埋め込みが使えるか（実際に叩いて確かめる）")
        for label, u in urls:
            try:
                r = await client.get(u)
            except httpx.HTTPError as e:
                print(f"   {label:<28} 接続失敗 {type(e).__name__}")
                continue
            t = r.text
            wall = "ログイン" if re.search(r"login|Log in|loginForm", t, re.I) else ""
            print(f"   {label:<28} HTTP {r.status_code} / {len(t):>7}字 "
                  f"/ 最終URL {str(r.url)[:52]} {wall}")


async def run(shops: list) -> dict:
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(headers=REQ_HEADERS, timeout=TIMEOUT,
                                 follow_redirects=True) as client:
        results = await asyncio.gather(*(probe(client, sem, r) for r in shops))

    got = [(r["name"], h) for r, h, _, _ in results if h]
    miss = [(r["name"], why) for r, h, why, _ in results if not h]
    posts = [(r["name"], p) for r, _, _, ps in results for p in ps]
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

    if got:
        await check_embed([h for _, h in got], posts)

    # 同じアカウントが複数の店に付いたら、拾い方を間違えている疑い
    dup = [(h, n) for h, n in Counter(h for _, h in got).items() if n > 1]
    if dup:
        print("\n■ 複数の店で同じアカウントになった（拾い方の誤りを疑う）")
        for h, n in sorted(dup, key=lambda x: -x[1])[:15]:
            print(f"   @{h}  {n}軒")

    # 同じアカウントが複数店に付いたものは採らない。どちらかが間違っている
    bad = {h for h, n in Counter(h for _, h in got).items() if n > 1}
    return {name: h for name, h in got if h not in bad}


def load_known() -> dict:
    """すでに集めてあるぶん。取れなかった回に消してしまわないよう、必ず読む。"""
    if not OUT.exists():
        return {}
    d = yaml.safe_load(OUT.read_text(encoding="utf-8")) or {}
    return d.get("instagram", {}) or {}


def save(known: dict) -> None:
    """YAML として書く。

    以前は行を手で組み立てていて、yaml.safe_dump が文字列に付ける
    ドキュメント終端（...）がそのまま混ざり、読み込めないファイルになっていた。
    マッピングごと safe_dump に渡せば、引用符も終端も正しく付く。
    """
    # 見出しはここに全部書く。ファイル側に足した説明は、次に集めたときに消える
    head = ("# 店の Instagram アカウント名。scripts/collect_instagram.py が集める。\n"
            "# 店のトップページに貼ってある導線から拾っている。\n"
            "# 手で直したいときは、この表を直接編集してよい\n"
            "# （次に集めたとき、取れた店だけが上書きされる）。\n"
            "#\n"
            "# 店名の綴りと結びつかないものは自動では採らない。\n"
            "# 略称（Subtext → @sbtxt.coffee）や日本語だけの店名は、ここに手で足す。\n"
            "# 自動では選べないので、次に集めても消えない。\n")
    body = yaml.safe_dump({"instagram": dict(sorted(known.items(), key=lambda x: x[0].lower()))},
                          allow_unicode=True, sort_keys=False, default_flow_style=False)
    OUT.write_text(head + body, encoding="utf-8")


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry" in sys.argv
    limit = int(args[0]) if args else 0
    cfg = yaml.safe_load((ROOT / "config" / "roasters.yaml").read_text(encoding="utf-8"))
    shops = [r for r in cfg.get("roasters", []) if r.get("url")]
    known = load_known()
    # 図鑑から外した店・名前を直した店のぶんが表に残る。誰も使わないまま
    # 溜まっていくと、次に集めるときの「もう持っている」の判断が狂う
    listed = {r["name"] for r in cfg.get("roasters", [])}
    stale = [n for n in known if n not in listed]
    for n in stale:
        print(f"図鑑に無い店なので表から外す: {n}")
        known.pop(n)
    if limit:
        # まだ取れていない店を先に見る。何度か走らせれば全体が埋まる
        shops = sorted(shops, key=lambda r: r["name"] in known)[:limit]
    print(f"調べる店 {len(shops)} 軒（{CONCURRENCY}軒ずつ並行）"
          f" / すでに {len(known)} 軒ぶん持っている\n")
    found = asyncio.run(run(shops))
    if dry:
        print("\n--dry なので書き込まない")
        return
    added = {n: h for n, h in found.items() if n not in known}
    changed = {n: h for n, h in found.items() if n in known and known[n] != h}
    known.update(found)
    save(known)
    print(f"\n{OUT} に書き込んだ: 合計 {len(known)} 軒"
          f"（新しく {len(added)} 軒 / 変わった {len(changed)} 軒）")
    for n, h in list(changed.items())[:10]:
        print(f"   変更 {n}: @{h}")


if __name__ == "__main__":
    main()
