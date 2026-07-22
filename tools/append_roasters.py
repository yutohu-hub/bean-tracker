"""/tmp/ok_all.tsv の検証済み候補を重複排除して config/roasters.yaml の
該当地域セクションに追記する。国コード→セクション見出しの対応で振り分ける。"""
from __future__ import annotations
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CFG = ROOT / "config" / "roasters.yaml"

# 国コード → セクション見出し
SECTION = {
    "JP": "日本", "NO": "北欧", "DK": "北欧", "SE": "北欧", "FI": "北欧", "IS": "北欧",
    "UK": "欧州", "GB": "欧州", "DE": "欧州", "NL": "欧州", "IT": "欧州", "IE": "欧州",
    "FR": "欧州", "ES": "欧州", "AT": "欧州", "CH": "欧州", "PL": "欧州", "PT": "欧州",
    "BE": "欧州", "GE": "欧州", "RS": "欧州", "LV": "欧州",
    "US": "北米", "CA": "北米",
    "AU": "オセアニア", "NZ": "オセアニア",
    "MX": "中南米", "CR": "中南米", "CO": "中南米", "BR": "中南米",
    "RW": "アフリカ", "ET": "アフリカ", "ZA": "アフリカ",
    "AE": "中東", "LB": "中東", "TR": "中東",
    "SG": "アジア", "MY": "アジア", "PH": "アジア", "HK": "アジア",
    "TW": "アジア", "IN": "アジア", "KR": "アジア", "TH": "アジア", "VN": "アジア",
}


def norm(u: str) -> str:
    return u.rstrip("/").replace("https://", "").replace("http://", "").replace("www.", "").lower()


def main() -> None:
    cfg = yaml.safe_load(CFG.read_text(encoding="utf-8"))
    existing_names = {r["name"].strip().lower() for r in cfg["roasters"]}
    existing_urls = {norm(r["url"]) for r in cfg["roasters"]}

    seen_n, seen_u = set(), set()
    # 地域ごとに新規行を貯める
    buckets: dict[str, list[str]] = {}
    added = 0
    for line in Path("/tmp/ok_all.tsv").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split("\t")
        if len(parts) != 5:
            continue
        name, country, currency, url, _platform = parts
        nl, nu = name.strip().lower(), norm(url)
        if nl in existing_names or nu in existing_urls or nl in seen_n or nu in seen_u:
            continue
        seen_n.add(nl)
        seen_u.add(nu)
        section = SECTION.get(country, "その他")
        block = (f"  - name: {name}\n"
                 f"    country: \"{country}\"\n"
                 f"    url: {url}\n"
                 f"    currency: {currency}\n")
        buckets.setdefault(section, []).append(block)
        added += 1

    # 各セクション見出しの直後に挿入する
    text = CFG.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    out = []
    for ln in lines:
        out.append(ln)
        stripped = ln.strip()
        if stripped.startswith("# ----") and stripped.endswith("----"):
            heading = stripped.strip("# -")
            if heading in buckets:
                for block in buckets[heading]:
                    out.append(block)
                del buckets[heading]

    # 対応セクションが無かった国は末尾（その他があれば入れる、なければ新規）
    if buckets:
        leftovers = []
        for sec, blocks in buckets.items():
            leftovers.append(f"\n  # ---- {sec} ----\n")
            leftovers.extend(blocks)
        out.extend(leftovers)

    CFG.write_text("".join(out), encoding="utf-8")
    print(f"追記 {added} 件")


if __name__ == "__main__":
    main()
