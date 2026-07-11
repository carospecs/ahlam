-- Add location columns to shops for distance-based sorting
-- lat/lng are private (geocoded from address on signup)
-- zip_code is public (shown to buyers instead of full address)

alter table shops add column if not exists lat numeric(10,7);
alter table shops add column if not exists lng numeric(10,7);
alter table shops add column if not exists zip_code text;
alter table shops add column if not exists address_line text;

-- Allow public read of zip_code (but not lat/lng or address_line)
alter table shops enable row level security;

create policy "public read shop zip" on shops
  for select using (true);

-- Update the existing create_shop RPC to accept the new fields
create or replace function create_shop(
  shop_name text,
  shop_location text default null,
  shop_phone text default null,
  shop_lat numeric(10,7) default null,
  shop_lng numeric(10,7) default null,
  shop_zip text default null,
  shop_address text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  new_id uuid;
begin
  insert into shops (name, location, business_phone, lat, lng, zip_code, address_line)
    values (shop_name, shop_location, shop_phone, shop_lat, shop_lng, shop_zip, shop_address)
    returning id into new_id;
  return new_id;
end;
$$;

-- Index on zip_code for marketplace filtering
create index if not exists shops_zip_idx on shops(zip_code);
