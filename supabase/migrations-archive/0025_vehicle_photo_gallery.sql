-- Store every uploaded photo URL (not just the hero) so a vehicle can show a real
-- gallery and each part can keep its own scanned photo. JSON array of public URLs.
alter table vehicles add column if not exists photo_urls jsonb;
