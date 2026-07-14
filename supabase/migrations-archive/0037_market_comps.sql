-- Market comp cache for comps-first pricing (web/src/lib/market-cache.ts).
-- Evidence-backed judged prices (confidence high/medium, comp_count > 0) are
-- cached per vehicle|spec|part|grade with a short TTL (48h, enforced at read
-- time), so a near-term rescan of the same vehicle reuses its numbers without
-- serving stale asking prices as live.
create table if not exists public.market_comps (
  comp_key   text primary key,          -- lib/market-cache compKey(): vehicle|spec|part|grade, normalized
  vehicle    text not null,
  part_name  text not null,
  grade      text not null,
  price_usd  integer not null,
  low_usd    integer,
  high_usd   integer,
  confidence text not null check (confidence in ('high', 'medium')),
  comp_count integer not null default 0,
  sources    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- TTL reads filter on created_at.
create index if not exists market_comps_created_at_idx on public.market_comps (created_at);

-- Server-only: RLS on with NO policies = deny-all for anon/authenticated.
-- API routes use the service role, which bypasses RLS.
alter table public.market_comps enable row level security;
