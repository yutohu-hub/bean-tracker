# メールログイン & 複数端末同期 & プレミアム連動 — Supabase 設計/手順

「味の記録」を複数端末で同期し、プレミアムの決済ランクと連動させるための構成。
静的サイト（GitHub Pages）のまま、ブラウザから Supabase を直接呼ぶ方式で実装する
（サーバー不要・anon キーのみをフロントに置く）。

実装済みの受け皿:
- `components/lib/account.js` … 設定（`SUPABASE.url` / `SUPABASE.anonKey`）、メールログイン
  （マジックリンク）、セッション確立、tastings の pull/push、entitlements 取得。
- `components/views/MyLogView.jsx` … クラウド設定時はメールログイン UI・同期ボタン・
  プレミアム表示。未設定時は従来の端末内保存で動作。
- `components/lib/store.js` … `mergeTastings()`（クラウド取得分を端末内へ統合）。

---

## 1. セットアップ手順
1. https://supabase.com で無料プロジェクトを作成。
2. **Project Settings → API** で「Project URL」「anon public」キーを取得。
3. `components/lib/account.js` の `SUPABASE` に貼り付けてコミット（**anon キーは公開可**。
   `service_role` は絶対に貼らない）。
4. **Authentication → URL Configuration** を設定する。ここが合っていないと、
   メールのリンクを開いてもログインが成立しない（リンクが別の場所へ飛ぶ、
   あるいは `Email link is invalid` になる）。アプリ側はこの2つを直す手段が無いので、
   「同期できない」ときは最初にここを疑う。
   - **Redirect URLs** に末尾スラッシュ付きで追加: `https://yutohu-hub.github.io/bean-tracker/`
     （アプリは `window.location.origin + pathname` を `redirect_to` に渡すため、
     この文字列と完全に一致する必要がある）
   - **Site URL** も同じ値にしておく（Redirect URLs に一致が無いときの退避先になるため）
5. 下記 SQL を **SQL Editor** で実行してテーブルと RLS を作成。

## 2. テーブル & RLS（SQL）
```sql
-- 味の記録
create table if not exists public.tastings (
  user_id uuid not null references auth.users(id) on delete cascade,
  bean_id integer not null,
  r text, name text, roaster text, origin text,
  rating integer, notes text,
  at bigint,
  updated_at timestamptz not null default now(),
  primary key (user_id, bean_id)
);
alter table public.tastings enable row level security;
create policy "own tastings" on public.tastings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- プレミアム権利（Stripe 入金で更新）
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',          -- free | premium_monthly | premium_yearly
  status text not null default 'inactive',    -- active | inactive | canceled
  stripe_customer_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
create policy "read own entitlement" on public.entitlements
  for select using (auth.uid() = user_id);
-- 書き込みは service_role（Webhook）のみ。anon/authenticated には insert/update を付与しない。
```

## 3. プレミアム連動（Stripe → entitlements）
決済ランクとの連動は、Stripe の Webhook を **Supabase Edge Function** で受けて
`entitlements` を更新することで実現する（フロントは読むだけ）。

```
Stripe Checkout / Billing
  └─ Webhook: checkout.session.completed / customer.subscription.updated|deleted
       → Supabase Edge Function（service_role キーで DB 更新）
           upsert entitlements(user_id, plan, status, current_period_end, stripe_customer_id)
```
- user_id と Stripe customer の紐付け: Checkout 作成時に `client_reference_id` や
  `metadata.user_id` に Supabase の user.id を渡す（Payment Links の場合は
  `client_reference_id` をクエリで付与、または Checkout Session をサーバ生成）。
- フロントは `cloudGetPlan()` で `entitlements.plan` を取得し、ローカルの `setPlan()` に
  反映 → レアロットの表示上限やプレミアム表示が連動する。

## 4. 同期の流れ（実装済みの挙動）
1. メールアドレスでログインリンクを送信（`signInWithEmail`）。
2. メールのリンクを開くと本サイトに戻り、URLハッシュのトークンから
   セッション確立（`captureSessionFromUrl`）。
3. ログイン後（および「今すぐ同期」ボタン）で:
   - クラウドの記録を取得しローカルへマージ（`mergeTastings`、`at` の新しい方を採用）
   - ローカルの記録をクラウドへ upsert（`cloudPushTastings`）
   - `entitlements.plan` を取得しローカルプランへ反映
4. 別端末でも同じメールでログインすれば、同じ記録・同じプレミアム状態になる。

## 5. 今後の強化
- アクセストークンの自動リフレッシュ（`refresh_token` で `/auth/v1/token?grant_type=refresh_token`）。
- 削除の同期（tombstone or DELETE 反映）。
- 競合解決の高度化（フィールド単位マージ）。
- メール＋パスワード方式やソーシャルログインの追加。
