-- Ahlam migration 0010: add plan and trial tracking to shops
-- Also tighten RLS for marketplace-visible tables

-- ---------------------------------------------------------------------------
-- Shop plan & trial
-- ---------------------------------------------------------------------------
alter table shops add column if not exists plan text not null default 'Pro';
alter table shops add column if not exists trial_ends_at timestamptz;

-- Set a default 30-day trial for existing shops (from their created_at)
update shops set trial_ends_at = created_at + interval '30 days'
  where trial_ends_at is null;

-- ---------------------------------------------------------------------------
-- RLS: marketplace needs public read access for active listings/vehicles
-- The API uses the service role, but RLS provides defense-in-depth for the
-- anon key.
-- ---------------------------------------------------------------------------

-- Public marketplace: anyone can see active listings and vehicles from other
-- shops. These are intentionally permissive since the marketplace is public.
create policy if not exists "public read active listings" on listings
  for select using (status = 'active');

create policy if not exists "public read active vehicles" on vehicles
  for select using (status = 'active');

-- Shops: anyone can read name/location for marketplace display
create policy if not exists "public read shop info" on shops
  for select using (true);

-- Disable anon key from directly reading profiles (must go through API)
create policy if not exists "users read own profile" on profiles
  for select using (auth.uid() = id);
