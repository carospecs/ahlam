-- Per-seller eBay business policies + inventory location.
-- Each connected shop posts to its own eBay account, which has its own policies;
-- we store the discovered/created IDs here so publishing is fully per-tenant.
alter table shop_integrations add column if not exists fulfillment_policy_id text;
alter table shop_integrations add column if not exists payment_policy_id     text;
alter table shop_integrations add column if not exists return_policy_id       text;
alter table shop_integrations add column if not exists location_key           text;
