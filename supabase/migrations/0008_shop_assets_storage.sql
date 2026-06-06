-- CaroSpecs migration 0008: public storage bucket for shop logos / cover images.
-- Uploads are performed server-side with the service role (bypasses RLS); the
-- bucket is public so logos render on listings and the public storefront.

insert into storage.buckets (id, name, public)
values ('shop-assets', 'shop-assets', true)
on conflict (id) do nothing;

-- Allow anyone to read objects in this public bucket.
do $do$ begin
  drop policy if exists "public read shop-assets" on storage.objects;
  create policy "public read shop-assets" on storage.objects
    for select using (bucket_id = 'shop-assets');
exception when others then null;
end $do$;
