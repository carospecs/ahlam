-- eBay links for whole-vehicle (Motors) and wholesale parts-lot listings.
alter table vehicles add column if not exists ebay_listing_id text;   -- whole car (Motors)
alter table vehicles add column if not exists ebay_url text;          -- whole car URL
alter table vehicles add column if not exists ebay_lot_id text;       -- all-parts wholesale lot
alter table vehicles add column if not exists ebay_lot_url text;      -- wholesale lot URL
