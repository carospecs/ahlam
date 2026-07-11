-- Ahlam migration 0039: shops.plan text → plan_tier enum, so the Supabase
-- table editor offers a dropdown instead of free text. Canonical lowercase ids
-- only; the app maps ids to display labels (lib/plan-limits.ts planLabel) and
-- the Stripe webhook writes lowercase ids (checkout plan ids, 'free' on cancel).
-- Run AFTER deploying the webhook change that writes 'free' instead of 'Free'.
--
-- NOTE for the Supabase SQL editor: run the create type alone first (its
-- statement splitter can't handle do-blocks); if it reports the type already
-- exists, continue with the rest.

-- Query 1: the enum type (definition order = dropdown order).
create type public.plan_tier as enum
  ('free', 'starter', 'founder', 'solo', 'growth', 'max', 'ultimate', 'pro');

-- Query 2: normalize existing values (legacy rows hold 'Pro' / 'Free');
-- anything unrecognized becomes 'pro', the legacy unlimited default.
update public.shops
set plan = case
  when lower(plan) in ('free','starter','founder','solo','growth','max','ultimate','pro')
    then lower(plan)
  else 'pro'
end;

-- Convert the column (default must be dropped before the type change).
alter table public.shops alter column plan drop default;

alter table public.shops
  alter column plan type public.plan_tier using plan::public.plan_tier;

alter table public.shops alter column plan set default 'pro';

-- Adding a plan later: alter type public.plan_tier add value 'newplan';
-- (then add its limits in web/src/lib/plan-limits.ts)
