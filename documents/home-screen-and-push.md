# ホーム画面に追加して使う / 通知を受け取る

App Store に並べるアプリは作りません。**ホーム画面に追加すれば、今日からアプリとして
使えます**（PWA）。費用も審査も要らず、更新はデプロイした瞬間に反映されます。

利用者の手順は **Safari で開く → 下部の共有 → ホーム画面に追加** だけです。

---

## 1. ホーム画面に追加（実装済み）

対応済みの内容:

- `manifest.webmanifest` … `display: standalone` / アイコン3種（maskable含む）
- `sw.js` … オフラインで開ける＋プッシュ通知の受け取り
  （ページそのものは「つながっていれば必ず取りに行く」。落ちたときだけ保存した分を出す）
- `viewport-fit=cover` と `env(safe-area-inset-*)` … ノッチと下端に黒帯を出さず、中身も潜らせない
- タップ時の灰色ハイライトを消す / 引っ張った時にページ全体が跳ねないようにする
- `InstallHint` … 初回だけ「共有 →ホーム画面に追加」を案内（閉じたら二度と出ない）

## 2. プッシュ通知（コードは実装済み・設定が3つ必要）

「再入荷を待つ」はアプリを閉じている間に効いてほしい機能なので、ここが本命です。
iOS は 16.4 以降、**ホーム画面に追加した状態でのみ**受け取れます（Safariのタブでは不可）。
アプリ側はその条件を判定して、受け取れないときは理由を出します。

必要な設定:

**① 鍵を作る**

```bash
npx web-push generate-vapid-keys
```

**② サーバ側に入れる**

```bash
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
                     VAPID_SUBJECT=mailto:あなたのメール \
                     PUSH_SEND_TOKEN=$(openssl rand -hex 32)
supabase functions deploy send-push --no-verify-jwt
```

`supabase/schema.sql` の `push_subscriptions` も実行しておきます（宛先の保管場所）。

**③ 公開鍵をフロントに入れる**

`.github/workflows/deploy-frontend.yml` のビルド時に環境変数として渡します。

```yaml
env:
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: ${{ vars.VAPID_PUBLIC_KEY }}
```

**送信は巡回に組み込み済み**（`src/push_notify.py`）。設定さえ入れば自動で飛びます。

送りすぎないことがいちばん大事なので、次の2つだけに絞り、**1回の巡回につき1通**にまとめます。

| 送る | 送らない |
| --- | --- |
| 再入荷（待っていた人がいる） | ふつうの新着（1回で数十件出る） |
| 新着のレアロット（ゲイシャ / シドラ / COE） | 売り切れ（買えないものを知らせても仕方がない） |

ワークフローに渡す値:

```yaml
# .github/workflows/track.yml（設定済み）
SUPABASE_URL:    ${{ vars.SUPABASE_URL }}
PUSH_SEND_TOKEN: ${{ secrets.PUSH_SEND_TOKEN }}
```

未設定なら送信そのものを行いません（巡回は止まりません）。

`--no-verify-jwt` で公開する代わりに、合言葉（`PUSH_SEND_TOKEN`）で守っています。
これが無いと、URLを知った人が全端末に通知を送れてしまいます。

## 3. App Store 版は作らない

一度 Capacitor で雛形を用意しましたが、作らない方針にしたので取り外しました
（`capacitor.config.ts` / リポジトリ直下の `package.json` / `scripts/build-app.sh` /
`.github/workflows/ios-build.yml` / `lib/native.js`）。

作らないことで避けられるもの:

| | ホーム画面に追加（いまの形） | App Store |
| --- | --- | --- |
| 費用 | 0円 | Apple Developer Program 年99ドル |
| 必要なもの | なし | Mac + Xcode（または CI の macOS ランナー） |
| 審査 | なし | あり（数日〜） |
| 更新 | デプロイした瞬間 | 審査を通ってから |
| プレミアムの課金 | Stripe のまま | **Appleの課金が必須・15〜30%** |
| 通知 | Web Push（iOS 16.4以降・ホーム画面追加が条件） | APNs への作り直しが必要 |

もし将来また作るなら、審査で必ず当たるのは次の2点です。

- **4.2 最低限の機能** — Webサイトを包んだだけのアプリは落とされます。
  ネイティブならではの価値が要る。このアプリの場合はプッシュ通知（再入荷）が根拠になります。
- **3.1.1 アプリ内課金** — アプリの中でプレミアムを売るなら Apple の課金が必須。
  豆を買うリンク（物理商品・外部EC）は対象外です。
