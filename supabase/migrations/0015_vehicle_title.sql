-- Optional custom listing title for a vehicle (overrides the auto year/make/model).
alter table vehicles
  add column if not exists title text;
