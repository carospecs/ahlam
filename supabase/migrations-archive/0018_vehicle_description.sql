-- Editable marketing description for a vehicle listing (title is 0015).
alter table vehicles
  add column if not exists description text;
