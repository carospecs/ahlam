-- Multi-photo support for part listings. Parts previously carried a single
-- listings.photo_url; vehicles already had a photo_urls gallery (migration 0025).
-- This adds the same gallery column to listings so a part can hold several photos
-- (hero stays in photo_url for backward compatibility / the card thumbnail).
alter table listings add column if not exists photo_urls jsonb;
