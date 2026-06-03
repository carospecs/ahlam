-- CaroSpecs migration 0002: shop creation RPC + storage policies.

-- ---------------------------------------------------------------------------
-- create_shop: a SECURITY DEFINER function so a newly signed-up user can
-- create their shop AND add themselves as owner in one call, without us having
-- to loosen RLS with a broad INSERT policy on shops/shop_members.
-- ---------------------------------------------------------------------------
create or replace function create_shop(
  shop_name text,
  shop_location text default null,
  shop_phone text default null
) returns uuid as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;
  insert into shops (name, location, business_phone)
    values (shop_name, shop_location, shop_phone)
    returning id into new_id;
  insert into shop_members (shop_id, user_id, role)
    values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$ language plpgsql security definer;

grant execute on function create_shop(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage policies for the 'part-photos' bucket.
-- Bucket is public (readable by URL); uploads/updates restricted to logged-in
-- users. RLS on storage.objects governs the API.
-- ---------------------------------------------------------------------------
drop policy if exists "public read part-photos" on storage.objects;
create policy "public read part-photos" on storage.objects
  for select using (bucket_id = 'part-photos');

drop policy if exists "authenticated upload part-photos" on storage.objects;
create policy "authenticated upload part-photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'part-photos');

drop policy if exists "authenticated update part-photos" on storage.objects;
create policy "authenticated update part-photos" on storage.objects
  for update to authenticated using (bucket_id = 'part-photos');
