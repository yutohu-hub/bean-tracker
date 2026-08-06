"""ログインが成立しない原因を、Supabase 側に聞いて切り分ける。

「ログインできない」には原因がいくつもあり、画面からは区別がつかない。
実際に起きるのは次のどれかで、直す場所がそれぞれ違う。

  1. プロジェクトが止まっている／URLやキーが違う   → account.js の SUPABASE
  2. メールログイン(magic link)が無効になっている   → Authentication → Providers
  3. 戻り先URLが許可されていない                    → Authentication → URL Configuration
  4. テーブル(tastings / entitlements)が無い        → documents/account-sync.md の SQL
  5. メール送信の回数制限に当たっている              → 時間をおく／SMTPを設定

開発環境からは supabase.co に到達できない（社内ポリシーで 403）ため、
ネットワークのある runner で走らせる。読むだけで、何も書き換えない。
公開鍵(publishable)しか使わないので、秘密は一切扱わない。

  python scripts/diag_auth.py
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
ACCOUNT = ROOT / "frontend" / "components" / "lib" / "account.js"
SITE = "https://yutohu-hub.github.io/bean-tracker/"


def read_config() -> tuple[str, str]:
    """フロントが実際に使っている接続先を、そのまま読み取る。"""
    src = ACCOUNT.read_text(encoding="utf-8")
    url = re.search(r'url:\s*"([^"]+)"', src)
    key = re.search(r'anonKey:\s*"([^"]+)"', src)
    return (url.group(1) if url else "", key.group(1) if key else "")


def main() -> None:
    url, key = read_config()
    if not url or not key:
        print("account.js に接続先が入っていない（= ログイン機能は出ない）")
        sys.exit(0)
    print(f"接続先: {url}")
    print(f"公開鍵: {key[:12]}…（末尾は伏せる）\n")

    client = httpx.Client(timeout=20, follow_redirects=True)
    ok = True

    # 1) プロジェクトが生きているか／メールログインが有効か
    try:
        r = client.get(f"{url}/auth/v1/settings", headers={"apikey": key})
        print(f"1. 認証の設定  HTTP {r.status_code}")
        if r.status_code == 200:
            s = r.json()
            ext = s.get("external", {})
            print(f"   メールログイン(email): {'有効' if ext.get('email') else '無効 ← ここが原因'}")
            print(f"   新規登録の受付(disable_signup): {s.get('disable_signup')}"
                  f"{' ← true だと未登録の人はログインできない' if s.get('disable_signup') else ''}")
            print(f"   メール確認の要否(mailer_autoconfirm): {s.get('mailer_autoconfirm')}")
        else:
            ok = False
            print(f"   応答: {r.text[:200]}")
            print("   → URLかキーが違う、またはプロジェクトが停止している")
    except httpx.HTTPError as e:
        ok = False
        print(f"1. 認証の設定  到達できず（{type(e).__name__}）")

    # 2) 戻り先URLが許可されているか。
    #    許可されていないと、Supabase は Site URL 側へ飛ばす（=リンクを開いても戻ってこない）。
    #    実際にメールを出さずに確かめるため、verify のリダイレクト先だけを見る。
    try:
        r = client.get(f"{url}/auth/v1/verify",
                       params={"token": "diag-not-a-real-token", "type": "magiclink",
                               "redirect_to": SITE},
                       headers={"apikey": key}, follow_redirects=False)
        loc = r.headers.get("location", "")
        print(f"\n2. 戻り先URLの許可  HTTP {r.status_code}")
        print(f"   期待: {SITE}")
        print(f"   実際: {loc[:120] or '(リダイレクトなし)'}")
        if loc.startswith(SITE):
            print("   → 許可されている（トークンは偽物なのでエラー付きで戻るのが正常）")
        else:
            ok = False
            print("   → 許可されていない。Authentication → URL Configuration の")
            print(f"      Redirect URLs に {SITE} を末尾スラッシュ付きで追加する")
    except httpx.HTTPError as e:
        ok = False
        print(f"\n2. 戻り先URLの許可  到達できず（{type(e).__name__}）")

    # 3) テーブルがあるか。RLS があるので中身は見えないが、有無は分かる。
    print("\n3. テーブル")
    for table in ("tastings", "entitlements"):
        try:
            r = client.get(f"{url}/rest/v1/{table}", params={"select": "*", "limit": 1},
                           headers={"apikey": key, "Authorization": f"Bearer {key}"})
            if r.status_code == 200:
                print(f"   {table:<13} ある（未ログインなので0件で正常）")
            elif r.status_code in (401, 403):
                print(f"   {table:<13} ある（RLSで拒否＝設計どおり）")
            elif r.status_code == 404:
                ok = False
                print(f"   {table:<13} 無い ← documents/account-sync.md の SQL を実行する")
            else:
                print(f"   {table:<13} HTTP {r.status_code} {r.text[:100]}")
        except httpx.HTTPError as e:
            print(f"   {table:<13} 到達できず（{type(e).__name__}）")

    print("\n" + ("すべて通りました。あとはメールが届くかだけです。"
                  if ok else "上の ← の箇所が、ログインできない原因です。"))


if __name__ == "__main__":
    main()
