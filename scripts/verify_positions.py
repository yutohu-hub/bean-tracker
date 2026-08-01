"""種データのロースター座標を、都市名から引いた実座標と突き合わせる。

手で置いた座標には、都市名と合っていないものが混じっている
（Girls Who Grind は city="Wiltshire" なのに coord=[0,20] の大西洋だった）。
店名ではなく **都市名** を基準に照合する。都市はその店の所在地として
すでに書かれている情報なので、これと座標が食い違っていれば座標のほうが誤り。

  python scripts/verify_positions.py            # 照合して差分を報告するだけ
  python scripts/verify_positions.py --apply    # キャッシュにある座標で修正する

--apply は問い合わせをしない。CI で貯めた config/citycoords.json だけを使うので、
ネットワークの無い環境でも実行でき、何が書き換わるかは差分で確認できる。
"""
from __future__ import annotations
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import geocode  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ROASTER_DIR = ROOT / "frontend" / "components" / "data" / "roasters"

# 1行目に name/city/country/coord が並ぶ書式を読む
ENTRY = re.compile(
    r'^\s+([A-Za-z0-9_]+): \{ name: "([^"]+)", city: "([^"]*)", country: "([^"]*)".*?'
    r'coord: \[\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\]', re.M)

# ここより離れていたら「置き場所が違う」とみなす。都市の広さと、
# 同じ都市圏に複数店がある場合の振れを考えて 60km。
TOLERANCE_KM = 60


def haversine(a, b) -> float:
    """[lon,lat] 同士の距離(km)。"""
    lon1, lat1, lon2, lat2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = (math.sin((lat2 - lat1) / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2)
    return 2 * 6371 * math.asin(math.sqrt(h))


def read_all():
    out = []
    for f in sorted(ROASTER_DIR.glob("*.js")):
        text = f.read_text(encoding="utf-8")
        for m in ENTRY.finditer(text):
            key, name, city, country, lon, lat = m.groups()
            out.append({"file": f, "key": key, "name": name, "city": city,
                        "country": country, "coord": [float(lon), float(lat)]})
    return out


def main() -> None:
    apply = "--apply" in sys.argv
    rows = read_all()
    print(f"種データのロースター: {len(rows)}軒")

    # 都市名が国コードそのままの行は照合できない（所在地が書かれていないのと同じ）
    checkable = [r for r in rows if r["city"] and r["city"].upper() != r["country"].upper()]
    print(f"都市名が入っていて照合できる: {len(checkable)}軒\n")

    if apply:
        coords = geocode.load_cache()
        print(f"キャッシュ {len(coords)}件を使って修正します（問い合わせはしません）\n")
    else:
        coords = geocode.resolve([(r["city"], r["country"]) for r in checkable], limit=500)
        print()

    far, missing, ok = [], 0, 0
    for r in checkable:
        real = coords.get(geocode.key_of(r["city"], r["country"]))
        if not real:
            missing += 1
            continue
        d = haversine(r["coord"], real)
        if d > TOLERANCE_KM:
            far.append((d, r, real))
        else:
            ok += 1

    far.sort(key=lambda x: -x[0])
    print(f"一致（{TOLERANCE_KM}km以内）: {ok}軒 / ずれ: {len(far)}軒 / 都市を引けず: {missing}軒\n")
    if far:
        print(f"{'距離':>9}  {'店名':<26} {'都市':<16} いまの座標 → 実際の座標")
        for d, r, real in far[:40]:
            print(f"{d:8.0f}km  {r['name'][:25]:<26} {r['city'][:15]:<16} {r['coord']} → {real}")

    if not apply:
        print("\n--apply を付けて実行すると、上のずれを実際の座標に書き換えます。")
        return

    # 書き換え。1行目の coord だけを差し替える。
    edited = 0
    for d, r, real in far:
        text = r["file"].read_text(encoding="utf-8")
        old = f'{r["key"]}: {{ name: "{r["name"]}"'
        i = text.find(old)
        if i < 0:
            continue
        line_end = text.find("\n", i)
        line = text[i:line_end]
        new_line = re.sub(r"coord: \[\s*-?[\d.]+,\s*-?[\d.]+\s*\]",
                          f"coord: [{real[0]}, {real[1]}]", line, count=1)
        if new_line == line:
            continue
        r["file"].write_text(text[:i] + new_line + text[line_end:], encoding="utf-8")
        edited += 1
    print(f"\n{edited}軒の座標を書き換えました。")


if __name__ == "__main__":
    main()
