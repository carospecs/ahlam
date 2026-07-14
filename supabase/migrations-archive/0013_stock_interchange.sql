-- Add stock_number to listings and vehicles for yard inventory tracking
alter table listings add column if not exists stock_number text;
alter table vehicles add column if not exists stock_number text;

-- Interchange cross-reference table for parts compatibility
create table if not exists interchange (
  id            uuid primary key default gen_random_uuid(),
  part_name     text not null,
  part_category text,
  oem_number    text,
  make          text,
  model         text,
  year_start    int,
  year_end      int,
  notes         text,
  source        text not null default 'manual',
  created_at    timestamptz not null default now()
);

create index if not exists interchange_part_idx on interchange(part_name);
create index if not exists interchange_oem_idx on interchange(oem_number);
alter table interchange enable row level security;
create policy "public read interchange" on interchange for select using (true);
create policy "members insert interchange" on interchange for insert with check (true);
