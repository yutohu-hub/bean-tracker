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

## 5. リンクが開けないとき — 6桁のコードで入る

「メールのリンクを押すとエラーになる」は、原因が4つあって画面からは区別できない。

| 起きていること | なぜ |
| --- | --- |
| `http://localhost:3000` に飛ぶ | **Redirect URLs 未登録**。許可が無いと Site URL（初期値）へ送られる |
| `Email link is invalid or has expired` がすぐ出る | メールの安全確認（Outlook/Gmail の保護機能）が**届いた瞬間にリンクを開いて**、1回きりのトークンを使い切っている |
| しばらく置いて押すと無効 | リンクの有効期限（既定1時間） |
| スマホで開いたがPCに反映されない | メールアプリ内ブラウザに着地している。**別の端末には効かない** |

上3つは設定や運用で減らせるが、4つ目は仕組み上どうにもならない。
**「ほかの端末と同期する」ためのログインなのに、リンク方式はいちばん弱い。**

そこでアプリ側は、6桁のコードで入る道を用意している（`signInWithCode`）。
入りたい端末にコードを打ち込むだけなので、上の4つはどれも起こらない。

**必要な設定は1つだけ。** Authentication → **Email Templates** → *Magic Link* の本文に
`{{ .Token }}` を足す（リンクは残したままでよい）。

```html
<h2>BEAN TRACKER にログイン</h2>
<p>下のリンクを開くか、アプリに次の6桁のコードを入力してください。</p>
<p><a href="{{ .ConfirmationURL }}">ログインする</a></p>
<p style="font-size:28px;letter-spacing:.2em;font-weight:700">{{ .Token }}</p>
<p style="color:#888;font-size:12px">このコードは一定時間で無効になります。心当たりが無ければ破棄してください。</p>
```

アプリは `POST /auth/v1/verify` に `{ type: "email", email, token }` を送ってセッションを受け取る。
**この経路は Redirect URLs の設定を一切使わない**ので、リンクが直らなくてもログインできる。

## 6. 今後の強化
- 削除の同期（tombstone or DELETE 反映）。
- 競合解決の高度化（フィールド単位マージ）。
- メール＋パスワード方式やソーシャルログインの追加。

（アクセストークンの自動更新は実装済み: 起動時 `ensureFreshSession()`、
通信時 `authFetch` が401で1度だけ更新して再試行する。）
