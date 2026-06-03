-- CaroSpecs initial schema
-- Run in the Supabase SQL editor (or via the Supabase CLI).
-- Model: single account per shop; members can be added under a shop with roles.

-- ---------------------------------------------------------------------------
-- Shops (one account per shop)
-- ---------------------------------------------------------------------------
create table if not exists shops (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  location      text,
  business_phone text,
  -- shop owner can set a default asking price per category (optional)
  default_prices jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shop members (maps Supabase auth users -> a shop, with a role)
-- ---------------------------------------------------------------------------
create type member_role as enum ('owner', 'editor', 'viewer');

create table if not exists shop_members (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shops(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       member_role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (shop_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Listings. Every row stores raw AI output + human correction = training data.
-- ---------------------------------------------------------------------------
create type listing_status as enum ('draft', 'active', 'sold', 'removed');

create table if not exists listings (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops(id) on delete cascade,
  created_by      uuid not null references auth.users(id),
  photo_url       text not null,
  ai_output       jsonb not null,          -- raw AIPartOutput JSON (training input)
  corrected       jsonb,                   -- human-reviewed CorrectedListing (training label)
  vin             text,                    -- optional, from a VIN-plate photo
  other_notes     text,                    -- optional "Other" section (VIN history etc)
  status          listing_status not null default 'draft',
  marketplace_url text,                    -- set after the shop posts (copy-paste flow)
  price_usd       numeric(10,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists listings_shop_idx on listings(shop_id);
create index if not exists listings_status_idx on listings(status);

-- ---------------------------------------------------------------------------
-- Waitlist (public landing page signups, pre-launch)
-- ---------------------------------------------------------------------------
create table if not exists waitlist (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  shop_name     text,
  location      text,
  parts_per_day int,
  source        text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists listings_updated_at on listings;
create trigger listings_updated_at
  before update on listings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table shops          enable row level security;
alter table shop_members   enable row level security;
alter table listings       enable row level security;
alter table waitlist       enable row level security;

-- Helper: is the current user a member of this shop?
create or replace function is_shop_member(target_shop uuid) returns boolean as $$
  select exists (
    select 1 from shop_members
    where shop_id = target_shop and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Shops: members can see/update their own shop.
create policy "members read own shop" on shops
  for select using (is_shop_member(id));
create policy "members update own shop" on shops
  for update using (is_shop_member(id));

-- Shop members: a user can see the membership rows of shops they belong to.
create policy "read own memberships" on shop_members
  for select using (user_id = auth.uid() or is_shop_member(shop_id));

-- Listings: scoped to the user's shop.
create policy "members read listings" on listings
  for select using (is_shop_member(shop_id));
create policy "members insert listings" on listings
  for insert with check (is_shop_member(shop_id));
create policy "members update listings" on listings
  for update using (is_shop_member(shop_id));

-- Waitlist: anyone (anon) may insert; nobody may read via the anon key.
create policy "anyone can join waitlist" on waitlist
  for insert with check (true);

-- ---------------------------------------------------------------------------
-- Storage: create a 'part-photos' bucket in the dashboard (or via CLI) and
-- restrict reads/writes to shop members. (Bucket creation is not SQL.)
-- ---------------------------------------------------------------------------
