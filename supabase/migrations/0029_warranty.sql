-- Ahlam migration 0029: warranty / returns framework (WAR-1, WAR-2, WAR-3).
--
-- Used parts standardly carry a 30/60/90-day warranty. Before this, Ahlam had
-- no warranty or returns terms anywhere — sellers couldn't advertise one and
-- buyers had nothing to reference in a dispute. We model it in two places:
--
--   * Per-listing terms live in the listings.corrected JSON (warrantyDays, asIs)
--     so they ride along with the reviewed listing and need no schema change.
--   * Shop-level defaults + a returns policy live on shops, and auto-apply to any
--     listing that hasn't set its own terms.
--   * Orders snapshot the warranty at purchase so the escrow/return window
--     (release flow) can reference a window that outlives the listing.

-- ---------------------------------------------------------------------------
-- Shop-level defaults. default_warranty_days: 0 = none/as-is, else 30/60/90.
-- returns_policy is free text shown on the storefront and every listing.
-- ---------------------------------------------------------------------------
do $do$ begin
  alter table shops add column if not exists default_warranty_days int not null default 30;
  alter table shops add column if not exists returns_policy text;
end $do$;

-- ---------------------------------------------------------------------------
-- Order-level warranty snapshot. Captured at checkout from the listing's
-- effective terms; warranty_expires_at is set when the buyer confirms receipt
-- (escrow release), so a defective/wrong/fails-in-a-week dispute has a window
-- to reference instead of escrow ending the moment receipt is confirmed.
-- ---------------------------------------------------------------------------
-- Guarded: the orders table only exists once the payments migration (0026) has
-- been applied. Skip cleanly when it isn't, so warranty still installs on shops.
do $do$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'orders') then
    alter table orders add column if not exists warranty_days int not null default 0;
    alter table orders add column if not exists warranty_expires_at timestamptz;
  end if;
end $do$;
