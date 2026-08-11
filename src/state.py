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
  origin TEXT, process TEXT, tags TEXT, notes TEXT,
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
    for col in ("city", "province", "kind"):
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
    stats = {"new": 0, "restock": 0, "soldout": 0}
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
                    origin, process, tags, notes, city, province, kind,
                    first_seen, last_seen, last_status_change)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (p["key"], p["roaster"], p["country"], p["title"], p["url"], p["image"],
                 p["price"], p["currency"], p["grams"], p["per100"],
                 int(p["available"]), p["origin"], p["process"], p["tags"],
                 p.get("notes") or "", p.get("city") or "", p.get("province") or "",
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
               city=?, province=?, kind=?,
               last_seen=?, last_status_change=CASE WHEN available!=? THEN ? ELSE last_status_change END
               WHERE key=?""",
            (p["roaster"], p["country"], p["title"], p["url"], p["image"],
             p["price"], p["currency"], p["grams"], p["per100"], int(is_available),
             p["origin"], p["process"], p["tags"], p.get("notes") or "",
             p.get("city") or "", p.get("province") or "", p.get("kind") or "", now,
             int(is_available), now, p["key"]))

    con.commit()
    return stats


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
