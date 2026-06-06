-- Per-shop OAuth connections to external marketplaces (eBay, …).
create table if not exists shop_integrations (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references shops(id) on delete cascade,
  provider      text not null,                 -- 'ebay'
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,                   -- access-token expiry
  account_label text,                          -- e.g. eBay username, for display
  env           text default 'production',     -- 'sandbox' | 'production'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (shop_id, provider)
);

-- Where a published listing lives on the external platform (for the "View" link).
alter table listings add column if not exists ebay_listing_id text;
alter table listings add column if not exists ebay_url text;
