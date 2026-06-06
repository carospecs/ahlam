-- Ahlam migration 0003: vehicles, messages, activity_log tables for dashboard

-- ---------------------------------------------------------------------------
-- Vehicles (whole-car listings / inventory items)
-- ---------------------------------------------------------------------------
drop table if exists vehicles cascade;
create table if not exists vehicles (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references shops(id) on delete cascade,
  created_by    uuid references auth.users(id),
  year          text not null,
  make          text not null,
  model         text not null,
  trim          text,
  body          text,
  color         text,
  vin           text,
  mileage       text,
  asking_price  numeric(10,2),
  sell_mode     text not null default 'parts' check (sell_mode in ('parts','whole','both')),
  photos        int not null default 0,
  status        listing_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists vehicles_shop_idx on vehicles(shop_id);

-- Add vehicle_id FK from listings if not present
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'listings' and column_name = 'vehicle_id'
  ) then
    alter table listings add column vehicle_id uuid references vehicles(id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Messages (conversation threads / inbox)
-- ---------------------------------------------------------------------------
create table if not exists conversations (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references shops(id) on delete cascade,
  contact_name  text not null,
  contact_avatar text,
  market        text not null default 'Facebook',
  part_name     text,
  listing_id    uuid references listings(id),
  unread        int not null default 0,
  last_time     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender          text not null check (sender in ('me','them')),
  body            text not null,
  time            text,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conv_idx on messages(conversation_id);

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------
create table if not exists activity_log (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references shops(id) on delete cascade,
  icon          text not null default 'CircleCheck',
  text          text not null,
  time          text,
  tone          text not null default 'muted',
  created_at    timestamptz not null default now()
);

create index if not exists activity_shop_idx on activity_log(shop_id);

-- Enable RLS
alter table vehicles       enable row level security;
alter table conversations  enable row level security;
alter table messages       enable row level security;
alter table activity_log   enable row level security;

-- Policies for vehicles
create policy "members read vehicles" on vehicles
  for select using (is_shop_member(shop_id));
create policy "members insert vehicles" on vehicles
  for insert with check (is_shop_member(shop_id));
create policy "members update vehicles" on vehicles
  for update using (is_shop_member(shop_id));

-- Policies for conversations
create policy "members read conversations" on conversations
  for select using (is_shop_member(shop_id));
create policy "members insert conversations" on conversations
  for insert with check (is_shop_member(shop_id));
create policy "members update conversations" on conversations
  for update using (is_shop_member(shop_id));

-- Policies for messages
create policy "members read messages" on messages
  for select using (exists (
    select 1 from conversations c where c.id = messages.conversation_id and is_shop_member(c.shop_id)
  ));
create policy "members insert messages" on messages
  for insert with check (exists (
    select 1 from conversations c where c.id = messages.conversation_id and is_shop_member(c.shop_id)
  ));

-- Policies for activity_log
create policy "members read activity" on activity_log
  for select using (is_shop_member(shop_id));
create policy "members insert activity" on activity_log
  for insert with check (is_shop_member(shop_id));
