-- Hero image for a vehicle listing (parts already have listings.photo_url).
alter table vehicles
  add column if not exists photo_url text;
