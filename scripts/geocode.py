"""都市名 → 座標。地球儀の点を店の実際の場所に置くために使う。

なぜ要るか:
  巡回で追加した店の座標は国コード1つで決めていたので、同じ国の店が全部
  同じ点に重なっていた（米国の10軒はカンザスの1点、ドイツやフランスの店は
  国コードの表に無く大西洋上[0,20]に置かれていた）。
  Shopify の /meta.json が店の市区町村を返すので、それを座標に直す。

問い合わせ先は OpenStreetMap の Nominatim。利用規約に沿って
  * 1秒に1件までしか投げない
  * 連絡先の分かる User-Agent を送る
  * 一度引いた結果は config/citycoords.json に残して二度と引かない
とする。キャッシュはリポジトリに置いて中身を人が確認できるようにする。

ネットワークが無い/落ちた場合は、引けたぶんだけ使って残りは呼び出し側の
フォールバック（国の代表座標）に任せる。地球儀が出なくなるよりはよい。
"""
from __future__ import annotations
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "config" / "citycoords.json"
ENDPOINT = "https://nominatim.openstreetmap.org/search"
UA = "bean-tracker/1.0 (https://github.com/yutohu-hub/bean-tracker)"
PAUSE_SEC = 1.1          # Nominatim の利用規約は 1req/s。少し余裕を持たせる


def load_cache() -> dict:
    try:
        return json.loads(CACHE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_cache(cache: dict) -> None:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1, sort_keys=True),
                     encoding="utf-8")


def key_of(city: str, country: str) -> str:
    return f"{(city or '').strip().lower()}|{(country or '').strip().upper()}"


# 「引いたが該当が無い」と「そもそも問い合わせできなかった」は区別する。
# 一緒くたに null で覚えてしまうと、通信が一度落ちただけでその街は永久に
# 国の代表座標のままになる。届かなかったぶんは覚えず、次回また引く。
UNREACHABLE = object()


def _lookup(city: str, country: str):
    """引けたら [lon, lat]、該当が無ければ None、問い合わせ自体が駄目なら UNREACHABLE。"""
    import httpx
    params = {"q": city, "format": "json", "limit": 1, "addressdetails": 0}
    if country:
        params["countrycodes"] = country.lower()
    try:
        r = httpx.get(ENDPOINT, params=params, headers={"User-Agent": UA}, timeout=20)
        if r.status_code != 200:
            return UNREACHABLE
        rows = r.json()
        if not rows:
            return None                 # 応答はあった。その街は見つからない
        return [round(float(rows[0]["lon"]), 4), round(float(rows[0]["lat"]), 4)]
    except Exception:
        return UNREACHABLE


def resolve(places: list[tuple[str, str]], limit: int = 80) -> dict:
    """[(city, country), ...] を座標に直す。返すのは key_of() -> [lon, lat]。

    limit は1回の実行で新規に引く上限。巡回のたびに数百件投げないための蓋で、
    残りは次回以降に持ち越す（キャッシュが育つので回を重ねるほど引かなくなる）。
    """
    cache = load_cache()
    todo = []
    for city, country in places:
        if not city:
            continue
        k = key_of(city, country)
        if k not in cache and k not in [t[0] for t in todo]:
            todo.append((k, city, country))

    if not todo:
        return cache

    added = unreachable = 0
    for k, city, country in todo[:limit]:
        coord = _lookup(city, country)
        if coord is UNREACHABLE:
            unreachable += 1
            if unreachable >= 3:        # 連続で駄目なら回線側。残りは次回に回す
                print("  geocode: 問い合わせ先に届かないため中断（次回やり直します）")
                break
            time.sleep(PAUSE_SEC)
            continue
        cache[k] = coord                # 該当なしは null で覚え、毎回引き直さない
        added += 1
        print(f"  geocode: {city} ({country}) → {coord if coord else '見つからず'}")
        time.sleep(PAUSE_SEC)

    if added:
        save_cache(cache)
        print(f"座標を {added}件 追加（キャッシュ計 {len(cache)}件）")
    remaining = len(todo) - added
    if remaining > 0:
        print(f"未取得 {remaining}件は次回に持ち越し")
    return cache
