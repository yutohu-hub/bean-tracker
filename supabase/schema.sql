-- BEAN TRACKER — プレミアム権限のテーブル
-- Supabase の SQL Editor に貼って実行する。
--
-- 設計の要点:
--   * この行を書き換えられるのは Webhook（service_role キー）だけ。
--     利用者側のキー(anon)には insert/update/delete を一切与えない。
--     フロントから権限を書ける口があると、無料でプレミアムにできてしまう。
--   * 利用者は自分の行だけ読める（RLS）。他人の課金状態は見えない。

create table if not exists public.entitlements (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  plan                text not null default 'free',      -- free | premium_monthly | premium_yearly
  status              text not null default 'none',      -- active | trialing | past_due | canceled | none
  current_period_end  timestamptz,                       -- 支払い済み期間の終わり
  stripe_customer_id  text,
  stripe_subscription_id text,
  updated_at          timestamptz not null default now()
);

create index if not exists entitlements_customer_idx
  on public.entitlements (stripe_customer_id);

alter table public.entitlements enable row level security;

-- 読むのは自分の行だけ
drop policy if exists "read own entitlement" on public.entitlements;
create policy "read own entitlement" on public.entitlements
  for select using (auth.uid() = user_id);

-- 書き込みポリシーは作らない。RLS が有効で許可が無い＝ anon からは書けない。
-- Webhook は service_role キーを使うので RLS を迂回して更新できる。


-- 重複した Webhook を二重に処理しないための記録（Stripe は同じイベントを再送する）
create table if not exists public.stripe_events (
  id          text primary key,          -- Stripe の event.id
  type        text,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- こちらは利用者に見せる必要がないので、ポリシーを一切作らない（誰も読めない）


-- 自分にプレミアムを付ける（動作確認用）。UUID は Authentication → Users で確認する。
-- insert into public.entitlements (user_id, plan, status, current_period_end)
-- values ('00000000-0000-0000-0000-000000000000', 'premium_yearly', 'active', now() + interval '1 year')
-- on conflict (user_id) do update
--   set plan = excluded.plan, status = excluded.status,
--       current_period_end = excluded.current_period_end, updated_at = now();


-- ---- プッシュ通知の宛先 ----------------------------------------------
-- ブラウザが発行する購読（endpoint + 鍵）を預かる場所。
-- ログイン前でも再入荷を受け取れるよう、user_id は空でもよい。
create table if not exists public.push_subscriptions (
  endpoint      text primary key,           -- ブラウザごとに一意。これが宛先そのもの
  subscription  jsonb not null,             -- endpoint と keys を含む購読全体
  user_id       uuid references auth.users(id) on delete cascade,
  ua            text,
  created_at    timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- 登録は誰でもできる（未ログインの端末も受け取れるようにするため）。
-- ただし読み出しは誰にも許さない＝他人の宛先を集められない。
drop policy if exists "anyone can register a device" on public.push_subscriptions;
create policy "anyone can register a device" on public.push_subscriptions
  for insert with check (true);

-- 自分の端末は自分で解除できる。未ログインの端末は endpoint を知っている本人だけが消せる
drop policy if exists "own device can be removed" on public.push_subscriptions;
create policy "own device can be removed" on public.push_subscriptions
  for delete using (user_id is null or auth.uid() = user_id);

-- 送信は service_role（Edge Function）だけが行う。select ポリシーを作らないので、
-- anon からは1行も読めない。
