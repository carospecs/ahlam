-- Ahlam migration 0033: per-shop usage metering (for plan limits, e.g. Solo).
-- One row per metered action (AI scan, car post, export). Counted per window in
-- lib/usage.ts. Service-role only; the anon/auth client never reads or writes it.

create table if not exists usage_events (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shops(id) on delete cascade,
  kind       text not null,            -- 'scan' | 'car_post' | 'export_car' | 'export_part'
  quantity   int  not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_shop_kind_time
  on usage_events (shop_id, kind, created_at);

alter table usage_events enable row level security;
-- No policies on purpose: only the service role (server) reads/writes usage.
