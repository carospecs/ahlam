-- Distinguish shops/businesses from individual sellers.
-- Both get identical functionality; this is only used for labeling/UX.
alter table public.shops
  add column if not exists account_type text not null default 'shop'
  check (account_type in ('shop', 'individual'));
