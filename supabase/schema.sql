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
