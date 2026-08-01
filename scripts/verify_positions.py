"""種データのロースター座標を、都市名から引いた実座標と突き合わせる。

手で置いた座標には、都市名と合っていないものが混じっている
（Girls Who Grind は city="Wiltshire" なのに coord=[0,20] の大西洋だった）。
店名ではなく **都市名** を基準に照合する。都市はその店の所在地として
すでに書かれている情報なので、これと座標が食い違っていれば座標のほうが誤り。

  python scripts/verify_positions.py                  # 照合して差分を報告するだけ
  python scripts/verify_positions.py --apply key1,key2  # 指定した店だけ書き換える

**まとめて自動適用はしない。** 実際にやってみたところ、引いた座標のほうが
間違っている例が大半だった:
  * 同名の別地点を拾う（Acton は George Howell のいるマサチューセッツではなく
    カリフォルニアが返る。Nelsonville も同様）
  * 都市欄に国名や州名が入っている店（「インド」「フィリピン」「Arkansas」）
  * 「京都 / 紫竹」のように複合表記だと別の場所になる
手で置かれた座標は 402/411 が市の中心から60km以内、319軒は5km以内で、
基本的に正しい。だから既定は報告だけにして、直すものは名指しで指定する。
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
    # --apply の後ろにキーを列挙したときだけ書き換える（名指ししたものに限る）
    apply_keys = set()
    if "--apply" in sys.argv:
        i = sys.argv.index("--apply")
        if i + 1 < len(sys.argv):
            apply_keys = {k.strip() for k in sys.argv[i + 1].split(",") if k.strip()}
        if not apply_keys:
            print("--apply には書き換える店のキーを指定してください（例: --apply sonora,atkinsons）")
            return
    rows = read_all()
    print(f"種データのロースター: {len(rows)}軒")

    # 都市名が国コードそのままの行は照合できない（所在地が書かれていないのと同じ）
    checkable = [r for r in rows if r["city"] and r["city"].upper() != r["country"].upper()]
    print(f"都市名が入っていて照合できる: {len(checkable)}軒\n")

    if apply_keys:
        coords = geocode.load_cache()
        print(f"キャッシュ {len(coords)}件を使い、指定された {len(apply_keys)}軒だけ書き換えます\n")
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

    if not apply_keys:
        print("\n直すものは1軒ずつ確かめてから --apply <キー> で指定してください。")
        print("（引いた座標のほうが誤っている場合が多いため、一括では適用しません）")
        return

    # 書き換え。名指しされた店の coord だけを差し替える。
    edited = 0
    for d, r, real in far:
        if r["key"] not in apply_keys:
            continue
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
