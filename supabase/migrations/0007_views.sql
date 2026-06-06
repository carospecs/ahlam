-- CaroSpecs migration 0007: vehicle view counter + view-increment RPCs.
-- Lets the marketplace show "how many people viewed it" for both parts and
-- whole-car vehicles, incremented when a buyer opens a post's detail.

-- ---------------------------------------------------------------------------
-- Vehicle views counter (parts already have listings.views from 0005)
-- ---------------------------------------------------------------------------
do $do$ begin
  alter table vehicles add column if not exists views int not null default 0;
end $do$;

-- ---------------------------------------------------------------------------
-- RPCs: bump a view counter on a row the caller does not own. SECURITY DEFINER
-- so the public-read marketplace can record views without owning the row (RLS
-- would otherwise block the update). Safe: they only ever +1 a counter.
-- ---------------------------------------------------------------------------
create or replace function increment_listing_views(p_listing_id uuid)
returns void as $fn$
  update listings set views = views + 1 where id = p_listing_id;
$fn$ language sql security definer;

create or replace function increment_vehicle_views(p_vehicle_id uuid)
returns void as $fn$
  update vehicles set views = views + 1 where id = p_vehicle_id;
$fn$ language sql security definer;

grant execute on function increment_listing_views(uuid) to anon, authenticated;
grant execute on function increment_vehicle_views(uuid) to anon, authenticated;
