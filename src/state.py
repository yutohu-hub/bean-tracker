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
  origin TEXT, process TEXT, tags TEXT,
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
            con.execute(
                """INSERT INTO products VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (p["key"], p["roaster"], p["country"], p["title"], p["url"], p["image"],
                 p["price"], p["currency"], p["grams"], p["per100"],
                 int(p["available"]), p["origin"], p["process"], p["tags"],
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
               price=?,currency=?,grams=?,per100=?,available=?,origin=?,process=?,tags=?,
               last_seen=?, last_status_change=CASE WHEN available!=? THEN ? ELSE last_status_change END
               WHERE key=?""",
            (p["roaster"], p["country"], p["title"], p["url"], p["image"],
             p["price"], p["currency"], p["grams"], p["per100"], int(is_available),
             p["origin"], p["process"], p["tags"], now,
             int(is_available), now, p["key"]))

    con.commit()
    return stats


def export_for_site(con: sqlite3.Connection, event_days: int = 14) -> dict:
    """サイト生成用にDBの中身をJSON化。"""
    cutoff = time.time() - event_days * 86400
    products = [dict(r) for r in con.execute(
        "SELECT * FROM products ORDER BY last_seen DESC").fetchall()]
    events = [dict(r) for r in con.execute(
        "SELECT e.*, p.title, p.roaster, p.country, p.url, p.image, p.price, p.currency, "
        "p.grams, p.per100, p.available, p.origin, p.process "
        "FROM events e JOIN products p ON p.key = e.key "
        "WHERE e.ts > ? ORDER BY e.ts DESC LIMIT 500", (cutoff,)).fetchall()]
    return {"products": products, "events": events}
