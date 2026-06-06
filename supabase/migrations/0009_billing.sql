-- CaroSpecs migration 0009: Stripe billing linkage.
-- Set by the checkout webhook after a shop's first successful subscription;
-- used to open the Stripe customer billing portal.

do $do$ begin
  alter table shops add column if not exists stripe_customer_id text;
  alter table shops add column if not exists subscription_status text;
end $do$;
