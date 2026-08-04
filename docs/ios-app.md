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

## 3. App Store 版（Capacitor・雛形は作成済み）

静的書き出し（`frontend/out`）をそのまま包む形にしてあります。

| ファイル | 役割 |
| --- | --- |
| `capacitor.config.ts` | アプリID・名前・`webDir`・iOSの見た目 |
| `package.json`（リポジトリ直下） | Capacitor の依存と `app:build` / `app:sync` / `app:ios` |
| `scripts/build-app.sh` | **サブパス無しで**書き出し、中身を検査する |
| `.github/workflows/ios-build.yml` | macOS ランナーで組み立て、署名なしでビルドが通るか見る |

Mac での手順はこれだけです。

```bash
npm install
npm run app:ios      # 書き出し → cap sync → Xcode が開く
```

`ios/` はコミットしていません（Xcode の生成物で差分が大きく、`npx cap add ios` で
作り直せるため）。`.gitignore` 済みです。

### 気をつける点（すでに仕込んであります）

- **基準パスを外す。** Web版は `/bean-tracker` の下に置くので `NEXT_PUBLIC_BASE_PATH` を
  渡していますが、アプリの中では `capacitor://localhost` が起点です。同じものを入れると
  `/bean-tracker/_next/...` を探しに行って**真っ白**になります。`build-app.sh` は基準パスを
  空にして書き出し、書き出し結果に `/bean-tracker/_next` が残っていないか検査してから終わります。
- **外部ECは外のブラウザで開く。** `allowNavigation` を空にしてあるので、豆を買うリンクは
  アプリの中に閉じ込められず、外で開きます。

### 課金の出し分け（実装済み）

Apple は「アプリの中でデジタルな権利を売るなら自社の課金を使え」と定めています
（3.1.1）。手数料15〜30%を払って Apple の課金を実装するか、アプリの中では売らないかの
二択です。**後者を採っています。**

`lib/native.js` が App Store 版かどうかを判定し、アプリの中では申し込みボタンを出さず
「お申し込みはウェブサイトから／契約済みならこのアプリでもそのまま使えます」と表示します。
豆を買うリンク（物理商品・外部EC）は 3.1.1 の対象外なので、そのまま出します。

### プッシュ通知は作り直しになります

2 で実装した Web Push は **ブラウザ（およびホーム画面PWA）向け**の仕組みです。
App Store 版では使えず、APNs（`@capacitor/push-notifications` + Apple の鍵）に
置き換えが必要です。宛先の保管場所（`push_subscriptions`）と送信の呼び出し口は
そのまま使えますが、送信部分は書き直しになります。
これは Apple Developer Program の契約後でないと鍵が作れないため、契約後に着手します。

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
- 3 は雛形まで作成済み。あとは Apple Developer Program の契約と、Mac での署名・申請
  （および審査に向けた APNs 対応）が残っています
