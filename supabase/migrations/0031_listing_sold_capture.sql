-- Capture the sale price + time when a listing is marked sold, so the pricing
-- pipeline can learn from the shop's OWN real sales — its strongest, proprietary
-- comp signal. sold_price defaults to the listing's price_usd at time of sale
-- (the PATCH handler stamps both). sold_at also lets us weight by recency later.
alter table listings add column if not exists sold_price numeric(10,2);
alter table listings add column if not exists sold_at    timestamptz;

-- Fast lookup of a shop's sold comps.
create index if not exists listings_sold_idx on listings(shop_id, status) where status = 'sold';
