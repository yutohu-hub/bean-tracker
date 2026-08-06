# プレミアムプラン — 設計と有効化手順

## 何を売っているか

| | FREE | PREMIUM（¥480/月・¥4,800/年） |
|---|---|---|
| 図鑑・地球儀・診断・味わいマップ | ○ | ○ |
| レアロット | 各カテゴリ **10 銘柄まで** | **全件** |
| 再入荷ウォッチ | **3 銘柄まで** | **上限なし** |
| 味の記録（写真1枚つき） | ○ | ○ |
| 複数端末で同期 | ○ | ○ |

上限は `frontend/components/lib/entitlements.js` の `LIMITS` が唯一の出どころ。
画面ごとに数字を書かない。

**新着レアロット通知は料金に含めていない。** 配信の仕組み（巡回の検知 → メール／Web Push）
がまだ動いていないため、画面では「準備中」と表示し、設定だけ預かっている。
動いていないものを課金対象にすると返金対応になる。

## 権限がどこから来るか

```
Stripe Checkout（Payment Link, client_reference_id = Supabase の user.id）
   ↓ 決済完了
Stripe Webhook → Supabase Edge Function（署名を検証）
   ↓ service_role キーで書き込み
entitlements(user_id, plan, status, current_period_end)
   ↓ RLS: 自分の行だけ読める
フロント lib/entitlements.js → usePlan() → 各画面のゲート
```

要点は3つ。

1. **フロントから権限を書く口を作らない。** `entitlements` に anon の書き込みポリシーを
   与えていないので、利用者側のキーでは insert も update もできない。
   （以前は画面のボタンが localStorage に `premium` を書いていたため、
   決済せずにプレミアムになれた。`store.js` の `setPlan` は削除済み。）
2. **決済と利用者を結ぶのは `client_reference_id`。** これが無いと入金はされるのに
   誰の支払いか分からず、「払ったのに解放されない」が必ず起きる。
   `lib/billing.js` の `checkoutUrl()` は userId が無いとリンクを組み立てない。
3. **オフラインの扱いは `current_period_end` で決める。** 端末に残す写しには支払い済み
   期間の終わりを持たせ、その日までは通信できなくてもプレミアムとして扱う。
   期限切れの写しは無効。圏外で締め出さず、解約した人も居座らない。

## どこまで守れているか（正直な話）

静的サイトなので、**ゲートは画面の制御であって、防壁ではない。**
豆のデータは公開バンドルに全部入っているため、その気になれば
localStorage の写しを書き換えたり JSON を直接読んだりして中身は見られる。

それでも今回の変更に意味があるのは、守る対象が違うから。

- 直すべきだったのは「**アプリの画面にある普通のボタンを押すだけで無料でプレミアムになれる**」
  こと。これは事故ではなく仕様の穴で、押した人に悪意は要らない。これは塞いだ。
- 残るのは「localStorage を手で書き換える」経路。オンラインになった瞬間に
  `resolvePlan()` が権威を取り直して上書きするので、続かない。

本当に秘匿したいもの（有料会員だけに配る情報など）を将来足すなら、
それはバンドルに入れず、RLS 付きのテーブルから取得する形にする必要がある。

## 有効化の手順

### 1. Supabase

```bash
# SQL Editor で実行
supabase/schema.sql
```

`entitlements` と `stripe_events`（Webhook の二重処理防止）ができる。

### 2. Stripe に商品を作る

1. 商品 → 「PREMIUM 月額 ¥480」「PREMIUM 年額 ¥4,800」を **継続課金** で作成
2. それぞれ Payment Link を発行
3. Payment Link の設定で **決済後のリダイレクト先** を
   `https://yutohu-hub.github.io/bean-tracker/?checkout=success` にする
   （`?checkout=success` が付いていないと、戻ってきても反映待ちの画面が出ない）
4. 発行された `https://buy.stripe.com/...` を `frontend/components/lib/billing.js` の
   `PAYMENT_LINKS` に貼る

### 3. Webhook

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_MONTHLY=price_... \
  STRIPE_PRICE_YEARLY=price_...
```

Stripe 管理画面 → 開発者 → Webhook で、
`https://<project>.supabase.co/functions/v1/stripe-webhook` を登録し、
次のイベントを送る:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`

`--no-verify-jwt` が要るのは、呼ぶのが Stripe であってログイン済みの利用者ではないため。
代わりに Stripe の署名を検証している。**署名検証を外すと、誰でもこの URL を叩いて
自分にプレミアムを付けられる。**

### 4. 解約導線

Stripe 管理画面 → 設定 → 請求 → カスタマーポータル でリンクを発行し、
`lib/billing.js` の `CUSTOMER_PORTAL_URL` に貼る。貼るまでは画面に
「領収書メールのリンクから解約」と出る。

### 5. 本番へ切り替え

`PAYMENT_LINKS` がテストモードの URL（`/test_` を含む）の間は、画面に
「現在テストモードです。実際の請求は発生しません」と出る。
本番の Payment Link に差し替えるとこの表示は消える。

## 動作確認

自分にプレミアムを付けて画面を確認するには、Stripe を通さず SQL で行を入れる
（`supabase/schema.sql` の末尾にコメントで置いてある）。
UUID は Authentication → Users で確認する。

決済まで通して確認する場合は Stripe のテストカード `4242 4242 4242 4242`。

## 未了

- 新着レアロット通知の配信（メール / Web Push）。設定は預かっているが送っていない
- App Store / Google Play の課金（アプリ版を出す場合、Stripe ではなく IAP が必須）
- 為替アラート
