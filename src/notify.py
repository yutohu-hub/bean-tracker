"""Discord Webhook通知（任意）。環境変数 DISCORD_WEBHOOK_URL があれば
新着・再入荷イベントをDiscordに投げる。"""
from __future__ import annotations
import os
import httpx

LABEL = {"new": "⤴ 新着", "restock": "↻ 再入荷", "soldout": "✕ 売り切れ"}


def notify(events: list[dict], limit: int = 15) -> None:
    url = os.environ.get("DISCORD_WEBHOOK_URL")
    if not url or not events:
        return
    lines = []
    for e in events[:limit]:
        extra = f"（約{round(e['oos_hours']/24, 1)}日ぶり）" if e.get("oos_hours") else ""
        lines.append(f"{LABEL.get(e['type'], e['type'])} **{e['title']}** — "
                     f"{e['roaster']} {extra}\n<{e['url']}>")
    body = {"content": "\n".join(lines)[:1900]}
    try:
        httpx.post(url, json=body, timeout=10)
        print(f"  → Discord通知 {min(len(events), limit)}件")
    except httpx.HTTPError as exc:
        print(f"  ✗ Discord通知失敗: {exc}")
