# 新着レアロット通知 & 課金 — 設計メモ

Bean Tracker の「新着レアロット通知」と「プレミアム課金」の設計。現状フロントは静的
（GitHub Pages, `output: export`）で、通知購読・プラン・ウォッチリストは **端末内
(localStorage) のプロトタイプ受け皿**として実装済み。本ドキュメントは、それをバック
エンド連携で本番化するための設計を示す。

現状の受け皿（実装済み・端末内）:

| 機能 | 保存キー | 実装 |
|---|---|---|
| プラン選択（FREE / PREMIUM 月額・年額） | `bt_plan` | `lib/store.js` `getPlan/setPlan`、`views/PremiumView.jsx` |
| 通知購読（カテゴリ / メール / ブラウザ通知） | `bt_notify` | `getNotify/setNotify`、Notification API 許可・テスト |
| 再入荷ウォッチリスト | `bt_restocks` | `getRestocks/isRestock/toggleRestock`、`ui/DetailSheet.jsx` |
| 味の記録・ローカルアカウント | `bt_tastings` / `bt_user` | 既存 |

---

## 1. 新着レアロット通知

### パイプライン
```
巡回クローラ (src/*.py)
  └─ 商品ページ取得・差分検出
       ├─ 新規ロット出現 (GEISHA / SIDRA / COE 入賞 など)
       └─ 在庫変化 (sold → now = 再入荷)
  → イベントを events テーブルに書き込み (roaster, bean, type, detected_at)
       │
Notification Service (ワーカー)
  ├─ events を購読者条件 (subscriptions) とマッチング
  ├─ 重複排除 (event_id × user)・レート制限 (1通/イベント/ユーザ)
  └─ 配信キューへ
       ├─ メール:  Resend / Amazon SES（テンプレ + ワンクリック解除）
       ├─ Web Push: VAPID + Service Worker (`web-push`)
       └─ モバイル: APNs / FCM（アプリ版）
```

### マッチング条件（購読）
- カテゴリ: `geisha` / `sidra` / `coe` / `restock`（`bt_notify.cats` に対応）
- 将来: 産地・価格帯・ロースター・国のフィルタも購読条件化（図鑑フィルタと共通語彙）。

### データモデル（案）
```sql
subscriptions(id, user_id, channel, cats jsonb, email, push_endpoint, created_at)
events(id, kind, roaster_key, bean_id, payload jsonb, detected_at)
deliveries(id, event_id, user_id, channel, status, sent_at)  -- 重複排除の一意キー: (event_id, user_id, channel)
restock_watch(user_id, bean_id, created_at)                   -- bt_restocks に対応
```

### Web Push（受け皿→本番）
- 実装済み: `PremiumView` で `Notification.requestPermission()` と `new Notification(...)` のテスト送出。
- 本番: Service Worker 登録 → `PushManager.subscribe({ applicationServerKey: VAPID公開鍵 })` →
  endpoint をサーバ保存 → ワーカーが `web-push` で送信。

---

## 2. 課金（プレミアム）

### プラン
| プラン | 価格 | 主な特典 |
|---|---|---|
| FREE | ¥0 | 図鑑・地球儀・診断・味わい・レアロット閲覧、味の記録（端末内） |
| PREMIUM 月額 | ¥480 / 月 | 新着レアロット即時通知、再入荷アラート、ウォッチリスト無制限、為替アラート(予定) |
| PREMIUM 年額 | ¥4,800 / 年 | 月額の全機能 + 約2ヶ月分お得 |

### 決済フロー（Stripe）
```
PremiumView「クレジットカードで申し込む」
  → POST /api/checkout (server) → Stripe Checkout Session 作成 → リダイレクト
  → 成功/キャンセルで戻り
  → Stripe Webhook (checkout.session.completed / customer.subscription.updated|deleted)
       → entitlements テーブル更新（user_id, plan, status, current_period_end）
  → Customer Portal で解約・支払い方法変更
```
- アプリ版は App Store / Google Play IAP（ストア規約上、デジタル特典はIAP必須）。
- エンタイトルメント判定はサーバ signed session or JWT claim で行い、UI は表示制御のみ。

### 特典ゲーティング
- 通知の**即時配信**・再入荷アラート・ウォッチリスト無制限をプレミアム機能に。
- FREE は遅延ダイジェスト（例: 1日1回まとめ）などに制限する余地。

---

## 3. アカウント（複数端末同期・今後）

現状はローカルプロフィール（`bt_user`）と端末内保存のみ。複数端末同期の本ログインは
バックエンド連携で追加予定:
- 認証: Supabase Auth もしくは Auth.js（メール/パスワード, マジックリンク, OAuth）。
- サインイン時に端末内データ（`bt_tastings` / `bt_notify` / `bt_restocks` / `bt_plan`）を
  サーバへマイグレーション&マージ。以後は user_id 紐付けで全端末同期。
- Stripe customer は user_id に 1:1 で紐付け。

---

## 4. 段階的リリース
1. **（済）受け皿**: 端末内でプラン・通知・ウォッチリストを保存する UI。
2. アカウント基盤（Auth + DB）と端末内データ移行。
3. クローラの差分検出 → events、購読マッチング → メール配信（まずメールのみ）。
4. Stripe 課金 + エンタイトルメントで特典ゲーティング。
5. Web Push / モバイルプッシュ、購読条件の拡張（産地・価格帯など）。
