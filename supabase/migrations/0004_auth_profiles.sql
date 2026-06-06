-- CaroSpecs migration 0004: auth profiles, listing type/seller, contact_messages

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  phone         text,
  bio           text,
  shop_id       uuid references shops(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles read own" on profiles
  for select using (id = auth.uid());
create policy "profiles insert own" on profiles
  for insert with check (id = auth.uid());
create policy "profiles update own" on profiles
  for update using (id = auth.uid());

-- Public profile info for marketplace contact
create policy "profiles read public" on profiles
  for select using (true);

-- ---------------------------------------------------------------------------
-- Add listing_type to listings ('part' | 'whole_vehicle')
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'listings' and column_name = 'listing_type'
  ) then
    alter table listings add column listing_type text not null default 'part'
      check (listing_type in ('part', 'whole_vehicle'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Add seller_id to listings (references profiles, for buyer→seller contact)
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'listings' and column_name = 'seller_id'
  ) then
    alter table listings add column seller_id uuid references profiles(id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Contact messages (buyer → seller direct messages on marketplace listings)
-- ---------------------------------------------------------------------------
create table if not exists contact_messages (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references listings(id) on delete cascade,
  buyer_id      uuid not null references profiles(id),
  seller_id     uuid not null references profiles(id),
  message       text not null,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists contact_messages_seller_idx on contact_messages(seller_id);
create index if not exists contact_messages_listing_idx on contact_messages(listing_id);

alter table contact_messages enable row level security;

create policy "buyer can insert contact" on contact_messages
  for insert with check (buyer_id = auth.uid());
create policy "buyer can read own" on contact_messages
  for select using (buyer_id = auth.uid());
create policy "seller can read own" on contact_messages
  for select using (seller_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Add buyer_id to conversations for buyer-side message view
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'conversations' and column_name = 'buyer_id'
  ) then
    alter table conversations add column buyer_id uuid references profiles(id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Allow public read of listings for marketplace browsing
-- ---------------------------------------------------------------------------
create policy "public read listings" on listings
  for select using (true);

-- ---------------------------------------------------------------------------
-- RLS on shops for signed-in user context
-- ---------------------------------------------------------------------------
drop policy if exists "members read own shop" on shops;
create policy "anyone can read shops" on shops
  for select using (true);

-- ---------------------------------------------------------------------------
-- Trigger: auto-create profile on auth.users insert
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
