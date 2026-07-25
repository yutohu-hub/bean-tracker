#!/usr/bin/env python3
"""クローラ出力(data/site.json) → フロント用オーバーレイ(frontend/.../live.generated.json)。

手書きの種データ(seed)に、巡回で取得した実データをキー一致で重ねる。
- 種データに同名ロースターがあれば、その key を再利用して「豆だけ」実データに置換
  （店舗のメタ情報=座標/都市/bio は種のまま維持）。
- 種に無い新規ロースターは、メタ情報も生成して追加。
実行タイミングは巡回ワークフロー(track.yml)。ネット不要のテストは:
  python main.py --mock fixtures && python scripts/build_frontend_data.py
"""
from __future__ import annotations
import json
import re
import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "data" / "site.json"
ROASTER_DIR = ROOT / "frontend" / "components" / "data" / "roasters"
OUT = ROOT / "frontend" / "components" / "data" / "live.generated.json"

STOP = re.compile(r"\b(coffee|roasters?|roastery|roasting|company|co|the|specialty|cafe|café|espresso|works|stand|brewers?|kaffe|koffie)\b")
def norm(s: str) -> str: return re.sub(r"[^a-z0-9]", "", STOP.sub("", (s or "").lower()))
def slug(s: str) -> str: return (re.sub(r"[^a-z0-9]", "", (s or "").lower())[:24] or "roaster")

C2REGION = {"JP": "eastAsia", "KR": "eastAsia", "TW": "eastAsia", "CN": "eastAsia", "HK": "eastAsia",
            "US": "northAmerica", "CA": "northAmerica", "NO": "nordic", "SE": "nordic", "DK": "nordic",
            "FI": "nordic", "IS": "nordic", "UK": "uk", "GB": "uk", "AU": "oceania", "NZ": "oceania",
            "ID": "seAsiaIndia", "VN": "seAsiaIndia", "TH": "seAsiaIndia", "MY": "seAsiaIndia",
            "PH": "seAsiaIndia", "SG": "seAsiaIndia", "IN": "seAsiaIndia", "BR": "latinAmerica",
            "CO": "latinAmerica", "MX": "latinAmerica", "GT": "latinAmerica", "CR": "latinAmerica",
            "PE": "latinAmerica", "AE": "africaMideast", "SA": "africaMideast", "ZA": "africaMideast",
            "ET": "africaMideast", "KE": "africaMideast", "RW": "africaMideast"}
C2COORD = {"JP": [139.7, 35.68], "KR": [126.98, 37.57], "TW": [121.5, 25.0], "CN": [116.4, 39.9],
           "HK": [114.1, 22.3], "US": [-98, 39], "CA": [-106, 56], "NO": [10.75, 59.9], "SE": [18.07, 59.3],
           "DK": [12.57, 55.7], "FI": [24.94, 60.17], "IS": [-21.9, 64.1], "UK": [-1.5, 52.5], "GB": [-1.5, 52.5],
           "AU": [145, -37.8], "NZ": [174.8, -41.3], "ID": [106.8, -6.2], "VN": [106.7, 10.8], "TH": [100.5, 13.75],
           "MY": [101.7, 3.14], "PH": [121, 14.6], "SG": [103.8, 1.35], "IN": [77.2, 28.6], "BR": [-46.6, -23.5],
           "CO": [-74.1, 4.6], "MX": [-99.1, 19.4], "GT": [-90.5, 14.6], "CR": [-84.1, 9.9], "PE": [-77, -12],
           "AE": [55.3, 25.2], "SA": [46.7, 24.7], "ZA": [18.4, -33.9], "ET": [38.7, 9.0], "KE": [36.8, -1.3], "RW": [30.1, -1.9]}
PAL = [["#DCD6C8", "#8A3B2E"], ["#2E2A24", "#C8A96A"], ["#B8433A", "#F2E9DC"], ["#3A2E4F", "#D9B44A"],
       ["#EFE9DA", "#2F5233"], ["#5A2E3A", "#E8C8A0"], ["#22303A", "#C8792E"], ["#7C4D8F", "#F2E9DC"],
       ["#F4F1E8", "#1A1815"], ["#6B2D3C", "#EFE9DA"]]


def load_seed_keys() -> dict:
    m = {}
    for f in ROASTER_DIR.glob("*.js"):
        for km in re.finditer(r'^\s+([a-z0-9]+): \{ name: "([^"]+)"', f.read_text(encoding="utf-8"), re.M):
            m[norm(km.group(2))] = km.group(1)
    return m


def host(url: str) -> str:
    m = re.match(r"https?://([^/]+)", url or "")
    return (m.group(1) if m else "").replace("www.", "")


def main() -> None:
    if not SITE.exists():
        OUT.write_text('{"roasters":{},"beans":[]}', encoding="utf-8")
        print("no site.json; wrote empty overlay")
        return
    data = json.loads(SITE.read_text(encoding="utf-8"))
    seed = load_seed_keys()
    roasters: dict = {}
    beans: list = []
    by_roaster: dict = {}
    for p in data.get("products", []):
        by_roaster.setdefault(p.get("roaster") or "Unknown", []).append(p)

    bid = 100000
    today = datetime.date.today().isoformat()
    year = today[:4]
    for rname, prods in by_roaster.items():
        key = seed.get(norm(rname)) or slug(rname)
        country = (prods[0].get("country") or "JP").upper()
        if key not in seed:  # 新規ロースターはメタ情報も生成
            roasters[key] = {
                "name": rname, "city": country, "country": country,
                "region": C2REGION.get(country, "europe"), "platform": "Shopify",
                "note": "巡回で取得したロースター", "coord": C2COORD.get(country, [0, 20]),
                "url": host(prods[0].get("url")), "founded": "—", "style": "—",
                "ship": "—", "focus": "—",
                "bio": f"{rname}（{country}）。巡回システムが公式ECから取得したロースターです。",
            }
        for i, p in enumerate(prods):
            grams = int(p.get("grams") or 0)
            col, acc = PAL[(bid) % len(PAL)]
            bean = {
                "id": bid, "r": key, "name": p.get("title") or "Lot",
                "origin": p.get("origin") or "ブレンド", "process": p.get("process") or "Washed",
                "amount": round(float(p.get("price") or 0)) or 1, "cur": p.get("currency") or "JPY",
                "per": f"{grams}g" if grams else "250g",
                "status": p.get("status") or ("now" if p.get("available") else "sold"),
                "color": col, "accent": acc, "year": year, "updatedAt": today,
            }
            if p.get("image"):
                bean["img"] = p["image"]
            beans.append(bean)
            bid += 1

    OUT.write_text(json.dumps({"roasters": roasters, "beans": beans}, ensure_ascii=False), encoding="utf-8")
    print(f"live overlay: {len(roasters)} new roasters, {len(beans)} beans -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
