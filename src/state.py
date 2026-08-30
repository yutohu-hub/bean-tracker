"""SQLiteに商品スナップショットを保存し、前回との差分から
新着 / 再入荷 / 売り切れ イベントを検出する。"""
from __future__ import annotations
import sqlite3
import time

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
  key TEXT PRIMARY KEY,
  roaster TEXT, country TEXT, title TEXT, url TEXT, image TEXT,
  price REAL, currency TEXT, grams INTEGER, per100 REAL,
  available INTEGER,
  origin TEXT, process TEXT, tags TEXT, notes TEXT, note_src TEXT,
  city TEXT, province TEXT,
  kind TEXT,
  first_seen REAL, last_seen REAL,
  last_status_change REAL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT, type TEXT, ts REAL, oos_hours REAL
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC);
"""


def open_db(path: str) -> sqlite3.Connection:
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    # 既存DBには列を後から足す（キャッシュから復元した古いDBでも動くように）
    cols = {r["name"] for r in con.execute("PRAGMA table_info(products)")}
    if "notes" not in cols:
        con.execute("ALTER TABLE products ADD COLUMN notes TEXT")
        con.commit()
    # 店の所在地。地球儀の点をこれで置く。
    # kind = 店が「これはコーヒーだ」と書いていたか（表示側が名前からの当て推量を
    # 使うかどうかの判断に使う）。
    for col in ("city", "province", "kind", "note_src"):
        if col not in cols:
            con.execute(f"ALTER TABLE products ADD COLUMN {col} TEXT")
    con.commit()
    # ALTER で足した notes は列順が末尾になる。SCHEMA の並び（tags の次）を前提にした
    # 位置指定INSERTが notes と first_seen を入れ違いに書いた行が残っているので戻す。
    # first_seen は REAL 宣言なので、ノート文字列が入った行だけ typeof が text になる。
    con.execute("""UPDATE products SET notes = first_seen, first_seen = last_seen
                   WHERE typeof(first_seen) = 'text'""")
    con.commit()
    return con


def apply_snapshot(con: sqlite3.Connection, products: list[dict],
                   min_oos_hours: float = 12.0) -> dict:
    """スナップショットを取り込み、イベント件数を返す。"""
    now = time.time()
    stats = {"new": 0, "restock": 0, "soldout": 0, "gone": 0}
    seen_keys = set()

    for p in products:
        seen_keys.add(p["key"])
        row = con.execute("SELECT * FROM products WHERE key=?", (p["key"],)).fetchone()

        if row is None:
            # 列名を明示する。ALTER で足した列は末尾に付くため、位置指定だと
            # 新規DBと移行済みDBで並びが違い、値が隣の列に書き込まれる。
            con.execute(
                """INSERT INTO products
                   (key, roaster, country, title, url, image,
                    price, currency, grams, per100, available,
                    origin, process, tags, notes, note_src, city, province, kind,
                    first_seen, last_seen, last_status_change)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (p["key"], p["roaster"], p["country"], p["title"], p["url"], p["image"],
                 p["price"], p["currency"], p["grams"], p["per100"],
                 int(p["available"]), p["origin"], p["process"], p["tags"],
                 p.get("notes") or "", p.get("note_src") or "",
                 p.get("city") or "", p.get("province") or "",
                 p.get("kind") or "",
                 now, now, now))
            if p["available"]:
                con.execute("INSERT INTO events (key,type,ts,oos_hours) VALUES (?,?,?,?)",
                            (p["key"], "new", now, None))
                stats["new"] += 1
            continue

        was_available = bool(row["available"])
        is_available = bool(p["available"])

        if is_available and not was_available:
            oos_h = (now - row["last_status_change"]) / 3600
            if oos_h >= min_oos_hours:
                con.execute("INSERT INTO events (key,type,ts,oos_hours) VALUES (?,?,?,?)",
                            (p["key"], "restock", now, round(oos_h, 1)))
                stats["restock"] += 1
        elif was_available and not is_available:
            con.execute("INSERT INTO events (key,type,ts,oos_hours) VALUES (?,?,?,?)",
                        (p["key"], "soldout", now, None))
            stats["soldout"] += 1

        con.execute(
            """UPDATE products SET roaster=?,country=?,title=?,url=?,image=?,
               price=?,currency=?,grams=?,per100=?,available=?,origin=?,process=?,tags=?,notes=?,
               note_src=?, city=?, province=?, kind=?,
               last_seen=?, last_status_change=CASE WHEN available!=? THEN ? ELSE last_status_change END
               WHERE key=?""",
            (p["roaster"], p["country"], p["title"], p["url"], p["image"],
             p["price"], p["currency"], p["grams"], p["per100"], int(is_available),
             p["origin"], p["process"], p["tags"], p.get("notes") or "",
             p.get("note_src") or "",
             p.get("city") or "", p.get("province") or "", p.get("kind") or "", now,
             int(is_available), now, p["key"]))

    stats["gone"] = _mark_withdrawn(con, products, seen_keys, now)
    con.commit()
    return stats


def _mark_withdrawn(con: sqlite3.Connection, products: list[dict],
                    seen_keys: set, now: float) -> int:
    """店の棚から消えた商品を「買えない」に倒す。

    ■ なぜ要るのか

    これまで、一度入った商品は available=1 のまま残り続けていた。棚から
    消えても誰も 0 に戻さないので、derive_status はいつまでも "now"（いま買える）
    を返す。売り終わった豆も、店が下げた商品も、図鑑では買えるように見えていた。

    取り込みの門（has_bean_evidence）を入れても、これのせいで効き目が
    出なかった。門は「これから取らない」を決めるだけで、すでに入っている
    雑貨は誰も下げないため、図鑑にはずっと並んだままになる。

    ■ 消さずに倒すだけにする理由

    行ごと消すと first_seen（初めて見つけた日）が失われ、図鑑の「古い順」が
    狂う。available=0 にしておけば SOLD OUT に移り、14日後に ARCHIVE へ送られる。
    店が戻せば次の巡回で在庫ありに戻る。

    ■ どの店を対象にするか

    巡回は 442 店を 13 に割って1時間ごとに回している。今回見ていない店の商品まで
    倒すと、全店が一巡するまで図鑑が売り切れだらけになる。
    そこで「今回1件以上返してきた店」だけを対象にする。これで自動的に、

      ・今回のスライスに入っていない店 → 対象外
      ・取得に失敗した店（429・接続断）  → 対象外
      ・0件しか返さなかった店           → 対象外

    が全部除かれる。0件の店を外すのは、店の一時的な不調と「全部下げた」を
    見分けられないため。倒しすぎるより、次の巡回に持ち越す方が安全。

    ■ イベントは立てない

    売り切れイベントは「在庫ありを見ていたのに無くなった」という知らせで、
    棚から消えたことはそれとは別。ここでイベントを立てると、門を入れた直後の
    巡回で何千件も売り切れが流れ、本当の売り切れが埋もれる。
    """
    returned = {p["roaster"] for p in products if p.get("roaster")}
    gone = 0
    for rname in returned:
        rows = con.execute(
            "SELECT key FROM products WHERE roaster=? AND available=1", (rname,)).fetchall()
        missing = [r["key"] for r in rows if r["key"] not in seen_keys]
        if not missing:
            continue
        con.executemany(
            "UPDATE products SET available=0, last_status_change=? WHERE key=?",
            [(now, k) for k in missing])
        gone += len(missing)
    return gone


SHOP_HEALTH = """
CREATE TABLE IF NOT EXISTS shop_health (
  roaster TEXT PRIMARY KEY,
  fails INTEGER DEFAULT 0,      -- 続けて失敗した回数
  last_ok REAL,                 -- 最後に取れた時刻
  last_try REAL                 -- 最後に試した時刻
);
"""


def record_health(con: sqlite3.Connection, ok_names: set[str],
                  failed_names: set[str]) -> None:
    """店ごとに、取れたか取れなかったかを覚えておく。

    毎回の巡回で、応答しない店にも同じだけ時間と回数を使っている。
    実測では 442店のうち豆が取れているのは 274店で、残り 168店は
    毎周ぶんの枠を使って何も返していない。

    ここに記録を残しておくと、続けて失敗している店を後回しにできる
    （→ due_shops）。相手の制限とは関係なく、同じ回数で「取れる店」を
    今より短い間隔で回せるようになる。
    """
    con.executescript(SHOP_HEALTH)
    now = time.time()
    con.executemany(
        "INSERT INTO shop_health (roaster, fails, last_ok, last_try) VALUES (?,0,?,?) "
        "ON CONFLICT(roaster) DO UPDATE SET fails=0, last_ok=?, last_try=?",
        [(n, now, now, now, now) for n in ok_names])
    con.executemany(
        "INSERT INTO shop_health (roaster, fails, last_ok, last_try) VALUES (?,1,NULL,?) "
        "ON CONFLICT(roaster) DO UPDATE SET fails=fails+1, last_try=?",
        [(n, now, now) for n in failed_names])
    con.commit()


def due_shops(con: sqlite3.Connection, names: list[str], now: float | None = None,
              dead_after: int = 10, retry_hours: float = 24.0) -> tuple[list, list]:
    """今回みる店と、今回は飛ばす店に分ける。

    続けて dead_after 回（既定10回）失敗している店は、毎回叩いても同じ結果に
    なることが多い。retry_hours（既定24時間）に1回だけ試す。

    ■ 見捨てはしない

    店は復活する。ドメインを変えただけの店も、一時的に落ちている店もある。
    だから「もう見ない」ではなく「頻度を落とす」。24時間に1回は必ず試すので、
    復活すれば遅くとも1日で戻る。

    ■ 10回という数

    1周8時間なので、10回続けて失敗＝3日以上ずっと取れていない店。
    429（レート制限）は同じ店で10回続けて起きることは少なく、
    起きたとしても24時間ごとの再試行で戻る。
    """
    con.executescript(SHOP_HEALTH)
    now = now or time.time()
    rows = {r["roaster"]: r for r in con.execute(
        "SELECT roaster, fails, last_try FROM shop_health")}
    due, skip = [], []
    for n in names:
        r = rows.get(n)
        if r and r["fails"] >= dead_after and r["last_try"] \
                and (now - r["last_try"]) < retry_hours * 3600:
            skip.append(n)
        else:
            due.append(n)
    return due, skip


def prune_missing_roasters(con: sqlite3.Connection, keep: set[str],
                           max_share: float = 0.2) -> list[tuple[str, int]]:
    """図鑑から外した店の商品を、DBからも消す。消した店と件数を返す。

    ■ なぜ要るのか

    巡回する店は config/roasters.yaml で決めているが、取り込んだ商品は
    state.db に残り続ける。店を1行消しても、その店の豆は図鑑に並んだままで、
    在庫ありのまま動かない（誰も見に行かないので available も変わらない）。

    実際、書き出しの最後には「雑貨中心の店なら config/roasters.yaml から外す」
    と出していた。ところが外しても消えない。助言のとおりにしても効かなかった。

    同じ店が2行あるとき（例: Square Mile と Square Mile Coffee）も、
    片方を消さないと店の数と国の数が本当より多く出る。

    ■ 倒すのではなく消す理由

    棚から消えた商品（_mark_withdrawn）は「店にはまだ聞いている」ので、
    在庫なしに倒して様子を見る。こちらは人が「この店はもう載せない」と
    決めた場合なので、残す理由がない。売り切れ棚に置いても誰も戻せない。

    ■ 一度に消しすぎない

    設定ファイルの読み違いや書き損じで店の一覧が短くなると、この処理は
    黙って何千件も消す。全体の max_share（既定2割）を超えるときは何もせず、
    何が起きたかだけを知らせる。消すのはいつでもできるが、戻すのは難しい。
    """
    if not keep:
        return []
    rows = con.execute("SELECT roaster, COUNT(*) n FROM products GROUP BY roaster").fetchall()
    total = sum(r["n"] for r in rows) or 1
    drop = [(r["roaster"], r["n"]) for r in rows if (r["roaster"] or "") not in keep]
    if not drop:
        return []
    share = sum(n for _, n in drop) / total
    if share > max_share:
        print(f"⚠ 図鑑に無い店の商品が {sum(n for _, n in drop)}件（全体の{share:.0%}）ありました。"
              f"多すぎるので消していません。config/roasters.yaml を確かめてください")
        for name, n in sorted(drop, key=lambda x: -x[1])[:10]:
            print(f"    {name} {n}件")
        return []
    for name, _ in drop:
        con.execute("DELETE FROM events WHERE key IN "
                    "(SELECT key FROM products WHERE roaster=?)", (name,))
        con.execute("DELETE FROM products WHERE roaster=?", (name,))
    con.commit()
    return sorted(drop, key=lambda x: -x[1])


def derive_status(product: dict, now: float | None = None,
                  archive_days: int = 14) -> str:
    """在庫状態から表示ステータスを決める。
    now    = いまECで買える（products.json で available=true）
    sold   = 欠品したが archive_days 未満（＝売り切れ表示）
    archive= 売り切れが archive_days（既定14日=2週間）以上続いたもの
    """
    if now is None:
        now = time.time()
    if product["available"]:
        return "now"
    age_days = (now - (product["last_status_change"] or now)) / 86400
    return "archive" if age_days >= archive_days else "sold"


def export_for_site(con: sqlite3.Connection, event_days: int = 14,
                    archive_days: int = 14) -> dict:
    """サイト生成用にDBの中身をJSON化。各商品に status を付与する。"""
    now = time.time()
    cutoff = now - event_days * 86400
    products = [dict(r) for r in con.execute(
        "SELECT * FROM products ORDER BY last_seen DESC").fetchall()]
    for p in products:
        p["status"] = derive_status(p, now, archive_days)
    events = [dict(r) for r in con.execute(
        "SELECT e.*, p.title, p.roaster, p.country, p.url, p.image, p.price, p.currency, "
        "p.grams, p.per100, p.available, p.origin, p.process "
        "FROM events e JOIN products p ON p.key = e.key "
        "WHERE e.ts > ? ORDER BY e.ts DESC LIMIT 500", (cutoff,)).fetchall()]
    return {"products": products, "events": events}
