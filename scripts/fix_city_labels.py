"""都市欄に国名・地域名が入っている店の表示名を、座標から引き直す。

対象はごく少数で、いずれも **座標は正しい**（香港の店は香港に、Onyx は
アーカンソー州ロジャーズに置かれている）。誤っているのは表示名だけなので、
その座標を逆引きして本当の市区町村名に差し替える。

  python scripts/fix_city_labels.py           # 逆引きして結果を表示するだけ
  python scripts/fix_city_labels.py --apply   # 表示名を書き換える
"""
from __future__ import annotations
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import geocode  # noqa: E402
from verify_positions import read_all  # noqa: E402

# 都市名ではなく国・州の名前が入っているもの
COUNTRYISH = {"香港", "台湾", "インド", "フィリピン", "マレーシア", "タイ", "ベトナム",
              "インドネシア", "シンガポール", "中国", "韓国", "日本", "Arkansas",
              "Hong Kong", "India", "Philippines", "Malaysia", "Taiwan"}


def main() -> None:
    apply = "--apply" in sys.argv
    targets = [r for r in read_all()
               if r["city"] in COUNTRYISH or r["city"].upper() == r["country"].upper()]
    print(f"表示名を直す対象: {len(targets)}軒\n")
    for r in targets:
        city = geocode.reverse(r["coord"][0], r["coord"][1])
        print(f"  {r['name'][:26]:28s} {r['city']:<10} → {city or '(引けず)'}   {r['coord']}")
        if apply and city and city != r["city"]:
            text = r["file"].read_text(encoding="utf-8")
            i = text.find(f'{r["key"]}: {{ name: "{r["name"]}"')
            if i < 0:
                continue
            end = text.find("\n", i)
            line = text[i:end]
            new = re.sub(r'city: "[^"]*"', f'city: "{city}"', line, count=1)
            if new != line:
                r["file"].write_text(text[:i] + new + text[end:], encoding="utf-8")
        time.sleep(1.1)
    print("\n--apply を付けると書き換えます。" if not apply else "\n書き換えました。")


if __name__ == "__main__":
    main()
