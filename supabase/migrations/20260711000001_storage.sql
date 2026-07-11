-- Storage buckets + RLS policies. The supabase schema dump (baseline) excludes
-- the storage schema, so buckets and their policies live here.
-- Carried over from archived migrations 0002 + 0008; bucket config matches prod.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('part-photos', 'part-photos', true, 10485760, '{image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('shop-assets', 'shop-assets', true)
on conflict (id) do nothing;

-- part-photos: public read, authenticated upload/update
drop policy if exists "public read part-photos" on storage.objects;
create policy "public read part-photos" on storage.objects
  for select using (bucket_id = 'part-photos');

drop policy if exists "authenticated upload part-photos" on storage.objects;
create policy "authenticated upload part-photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'part-photos');

drop policy if exists "authenticated update part-photos" on storage.objects;
create policy "authenticated update part-photos" on storage.objects
  for update to authenticated using (bucket_id = 'part-photos');

-- shop-assets: public read (uploads happen server-side with the service role)
drop policy if exists "public read shop-assets" on storage.objects;
create policy "public read shop-assets" on storage.objects
  for select using (bucket_id = 'shop-assets');
