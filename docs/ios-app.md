# iOSアプリにする

結論から言うと、**ホーム画面に追加すれば今日からアプリとして使えます**（PWA）。
App Store に並べたい場合だけ、追加の作業と費用と審査が要ります。

| | ホーム画面に追加（PWA） | App Store（Capacitor） |
| --- | --- | --- |
| 費用 | 0円 | Apple Developer Program 年99ドル |
| 必要なもの | なし | Mac + Xcode（または CI の macOS ランナー） |
| 審査 | なし | あり（数日〜） |
| 更新 | デプロイした瞬間 | 審査を通ってから |
| 通知 | 受け取れる（iOS 16.4以降・ホーム画面追加が条件） | 受け取れる |
| プレミアムの課金 | Stripe のまま（手数料はStripeのみ） | **Appleの課金が必須・15〜30%** |
| 検索で見つかる | 検索エンジン | App Store |

---

## 1. ホーム画面に追加（実装済み）

対応済みの内容:

- `manifest.webmanifest` … `display: standalone` / アイコン3種（maskable含む）
- `sw.js` … オフラインで開ける（stale-while-revalidate）＋プッシュ通知の受け取り
- `viewport-fit=cover` と `env(safe-area-inset-*)` … ノッチと下端に黒帯を出さず、中身も潜らせない
- タップ時の灰色ハイライトを消す / 引っ張った時にページ全体が跳ねないようにする
- `InstallHint` … 初回だけ「共有 →ホーム画面に追加」を案内（閉じたら二度と出ない）

利用者の手順は **Safari で開く → 下部の共有 → ホーム画面に追加** だけです。

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

送るときは、巡回ワークフローから Edge Function を叩きます。

```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-push" \
  -H "x-push-token: $PUSH_SEND_TOKEN" -H "content-type: application/json" \
  -d '{"title":"再入荷しました","body":"Onyx / Colombia Gesha","url":"?b=3500","tag":"restock-3500"}'
```

`--no-verify-jwt` で公開する代わりに、合言葉（`PUSH_SEND_TOKEN`）で守っています。
これが無いと、URLを知った人が全端末に通知を送れてしまいます。

## 3. App Store に出す場合

静的書き出し（`frontend/out`）をそのまま包めるので、**Capacitor** が最短です。

```bash
npm i -D @capacitor/cli && npx cap init "BEAN TRACKER" com.example.beantracker
npm i @capacitor/core @capacitor/ios
# webDir を frontend/out に設定してから
npx cap add ios && npx cap sync ios && npx cap open ios
```

**審査で必ず当たる2点**（先に決めておくべきこと）:

- **4.2 最低限の機能** — Webサイトを包んだだけのアプリは落とされます。
  ネイティブならではの価値が要る。このアプリの場合は**プッシュ通知**（再入荷）が
  その根拠になるので、2 を先に済ませてから申請するのが順序です。
- **3.1.1 アプリ内課金** — アプリの中でプレミアム（デジタルな権利）を売るなら
  Apple の課金が必須で、手数料15〜30%。いまの Stripe 決済はアプリ内では使えません。
  一方、**豆を買うリンク（物理商品・外部EC）は対象外**なので送客はそのままで問題ありません。
  避けるなら「アプリ内では購入導線を出さない（Webで契約済みの人は使える）」形にします。

## いまの状態

- 1 は完了。ホーム画面に追加すればアプリとして動きます
- 2 はコードが入っています。上の①②③を設定すれば、その日から通知が届きます
- 3 は未着手。Apple Developer Program の契約が要るため、判断してから着手します
