-- ---------------------------------------------------------------------------
-- Fix: enable Row Level Security on shop_integrations.
--
-- shop_integrations (added in 0016_integrations.sql) stores each shop's eBay
-- OAuth access_token and refresh_token in plaintext, but unlike every other
-- user-data table it never had RLS enabled. On Supabase defaults that means any
-- authenticated user (or the public anon key) could read every shop's tokens
-- via PostgREST and take over their eBay accounts.
--
-- This migration enables RLS and scopes all access to members of the owning
-- shop, mirroring the existing is_shop_member(shop_id) pattern used by listings,
-- conversations, etc. (see 0001_init.sql / 0003_dashboard_tables.sql). The
-- server-side OAuth callback and token-refresh paths in web/src/lib/ebay.ts use
-- the service_role key (supabaseAdmin()), which bypasses RLS, so token writes
-- and reads from the server are unaffected.
-- ---------------------------------------------------------------------------

alter table shop_integrations enable row level security;

-- Members of the owning shop may read their shop's integration rows.
-- The anon role is not a shop member, so this denies anonymous reads of tokens.
drop policy if exists "members read integrations" on shop_integrations;
create policy "members read integrations" on shop_integrations
  for select using (is_shop_member(shop_id));

-- Members may connect (insert) an integration for their own shop.
drop policy if exists "members insert integrations" on shop_integrations;
create policy "members insert integrations" on shop_integrations
  for insert with check (is_shop_member(shop_id));

-- Members may update their shop's integration row (e.g. refreshed tokens).
drop policy if exists "members update integrations" on shop_integrations;
create policy "members update integrations" on shop_integrations
  for update using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

-- Members may disconnect (delete) their shop's integration row.
drop policy if exists "members delete integrations" on shop_integrations;
create policy "members delete integrations" on shop_integrations
  for delete using (is_shop_member(shop_id));
