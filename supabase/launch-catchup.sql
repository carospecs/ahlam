-- =============================================================================
-- LAUNCH DAY CATCH-UP (run once in the Supabase SQL editor, before sending the
-- waitlist launch email). Production is missing the shop plan/billing columns
-- from migrations 0006/0009/0010 (0010's "create policy if not exists" is not
-- valid Postgres, so the whole migration aborted before its ALTERs) and needs
-- 0033 + 0038. Every statement here is idempotent; safe to rerun.
-- =============================================================================

-- 0006: shop vs individual seller
alter table public.shops
  add column if not exists account_type text not null default 'shop'
  check (account_type in ('shop', 'individual'));

-- 0009: Stripe billing linkage
alter table public.shops add column if not exists stripe_customer_id text;
alter table public.shops add column if not exists subscription_status text;

-- 0010 (core): plan + trial tracking
alter table public.shops add column if not exists plan text not null default 'Pro';
alter table public.shops add column if not exists trial_ends_at timestamptz;

-- 0010: whole-car listing text
alter table public.vehicles add column if not exists description text;

-- 0033: usage metering (plan limits)
create table if not exists public.usage_events (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  kind       text not null,            -- 'scan' | 'car_post' | 'export_car' | 'export_part'
  quantity   int  not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_shop_kind_time
  on public.usage_events (shop_id, kind, created_at);
alter table public.usage_events enable row level security;

-- 0038: per-car scan batches + waitlist launch-email tracking
alter table public.usage_events add column if not exists batch_id text;
create unique index if not exists usage_events_shop_kind_batch
  on public.usage_events (shop_id, kind, batch_id);
alter table public.waitlist add column if not exists notified_at timestamptz;

-- -----------------------------------------------------------------------------
-- Backfill: any shop created on/after launch day (while the plan columns were
-- missing) got the default 'Pro'. Give waitlist owners their founding month and
-- everyone else the starter month. Pre-launch pilot shops keep 'Pro' untouched.
-- -----------------------------------------------------------------------------
update public.shops s
set plan = case when w.email is not null then 'founder' else 'starter' end,
    trial_ends_at = s.created_at + interval '30 days'
from public.shop_members m
join auth.users u on u.id = m.user_id and m.role = 'owner'
left join public.waitlist w on w.email = lower(u.email)
where m.shop_id = s.id
  and s.plan = 'Pro' and s.trial_ends_at is null
  and s.created_at >= '2026-07-05';

-- -----------------------------------------------------------------------------
-- Cleanup: launch-verification test accounts (created by Claude on 2026-07-05).
-- -----------------------------------------------------------------------------
delete from public.shop_members where shop_id in
  (select id from public.shops where name in ('Launch Check Yard', 'Starter Check Yard'));
delete from public.shops where name in ('Launch Check Yard', 'Starter Check Yard');
delete from auth.users where email in ('launchcheck.founder@example.com', 'launchcheck.starter@example.com');
delete from public.waitlist where source = 'launch-verify';
