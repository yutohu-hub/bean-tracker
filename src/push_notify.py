"""巡回で見つけたものを、登録済みの端末へプッシュ通知する。

送信そのものは Supabase Edge Function（supabase/functions/send-push）が行う。
ここは「何を、どういう文面で、どれだけ送るか」を決める。

送りすぎないことがいちばん大事。1回の巡回で新着は数十件出るので、
そのまま流すと通知欄が埋まって切られる。次の2つだけに絞る。

  * 再入荷        … 待っていた人がいる。取り逃すと意味が無い
  * 新着のレアロット … ゲイシャ / シドラ / COE。数量が少なく、すぐ消える

さらに1回の巡回につき通知は1通にまとめる。件数が多い日でも1通で済ませる。

環境変数（無ければ何もしない）:
  SUPABASE_URL      https://xxxx.supabase.co
  PUSH_SEND_TOKEN   Edge Function と共有する合言葉
"""
from __future__ import annotations
import os
import re

import httpx

SITE = "https://yutohu-hub.github.io/bean-tracker/"
# レアロットの見分け。フロントの判定（scripts/build_frontend_data.py）と同じ言葉を使う
_RARE = re.compile(r"(?i)\b(geisha|gesha|sidra)\b|ゲイシャ|ゲシャ|シドラ|cup of excellence|\bcoe\b")


def _pick(events: list[dict]) -> tuple[list[dict], list[dict]]:
    restock = [e for e in events if e.get("type") == "restock"]
    rare = [e for e in events if e.get("type") == "new" and _RARE.search(e.get("title") or "")]
    return restock, rare


def _message(restock: list[dict], rare: list[dict]) -> dict | None:
    if not restock and not rare:
        return None

    # 1件だけなら、その豆の名前をそのまま出す。まとめ表現より伝わる
    if len(restock) == 1 and not rare:
        e = restock[0]
        back = f"（約{round(e['oos_hours'] / 24)}日ぶり）" if e.get("oos_hours") else ""
        return {"title": "再入荷しました",
                "body": f"{e['title']} — {e['roaster']}{back}",
                "url": "?v=zukan", "tag": "restock"}
    if len(rare) == 1 and not restock:
        e = rare[0]
        return {"title": "レアロットが入りました",
                "body": f"{e['title']} — {e['roaster']}",
                "url": "?v=geisha", "tag": "rare"}

    parts = []
    if restock:
        parts.append(f"再入荷 {len(restock)}件")
    if rare:
        parts.append(f"新着レアロット {len(rare)}件")
    head = (rare or restock)[0]
    return {"title": "・".join(parts),
            "body": f"{head['title']} — {head['roaster']} ほか",
            # レアロットがあるならそのタブへ、無ければ図鑑へ
            "url": "?v=geisha" if rare else "?v=zukan",
            "tag": "digest"}


def push(events: list[dict]) -> None:
    base = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    token = os.environ.get("PUSH_SEND_TOKEN") or ""
    if not base or not token:
        return                      # 未設定なら黙って何もしない（巡回は止めない）

    msg = _message(*_pick(events))
    if not msg:
        return
    try:
        r = httpx.post(f"{base}/functions/v1/send-push", json=msg, timeout=20,
                       headers={"x-push-token": token, "Content-Type": "application/json"})
        if r.status_code == 200:
            d = r.json()
            print(f"  → プッシュ通知 {d.get('sent', 0)}台に送信"
                  f"（宛先 {d.get('total', 0)} / 無効を {d.get('removed', 0)} 件削除）")
        else:
            print(f"  ✗ プッシュ通知 失敗: HTTP {r.status_code} {r.text[:120]}")
    except httpx.HTTPError as exc:
        print(f"  ✗ プッシュ通知 失敗: {type(exc).__name__}")
