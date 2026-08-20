-- Owner-configurable negotiation floor for the AI deal agent (web/src/lib/deal-agent.ts).
-- Percent off the listed price the assistant may accept on its own before it
-- has to say "I'll pass your offer along to the shop." Defaults to 5% so new
-- shops start conservative; owners raise it in Settings if they want more room.

alter table public.shops add column if not exists deal_floor_pct numeric not null default 5;

alter table public.shops drop constraint if exists shops_deal_floor_pct_range;
alter table public.shops add constraint shops_deal_floor_pct_range
  check (deal_floor_pct >= 0 and deal_floor_pct <= 50);
