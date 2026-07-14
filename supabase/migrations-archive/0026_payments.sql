-- Ahlam migration 0026: marketplace payments (Stripe Connect + escrow).
--
-- Model: buyers pay by card through Stripe Checkout. Funds are held on the
-- Ahlam platform balance (separate charges & transfers), then released to the
-- seller's connected account when the buyer confirms they received the part —
-- minus Ahlam's platform fee. This is what turns the lead-gen tool into a real
-- marketplace with buyer protection.

-- ---------------------------------------------------------------------------
-- Seller payout account: a Stripe Connect (Express) account per shop.
-- stripe_account_id is created the first time a shop sets up payouts;
-- charges_enabled / payouts_enabled mirror Stripe's onboarding state (set by
-- the account.updated webhook) so the UI knows when a shop can sell.
-- ---------------------------------------------------------------------------
do $do$ begin
  alter table shops add column if not exists stripe_account_id text;
  alter table shops add column if not exists charges_enabled boolean not null default false;
  alter table shops add column if not exists payouts_enabled boolean not null default false;
end $do$;

-- ---------------------------------------------------------------------------
-- Orders. One row per buyer purchase. amount/fee are stored in cents to match
-- Stripe and avoid float drift.
-- ---------------------------------------------------------------------------
do $do$ begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum ('pending', 'paid', 'shipped', 'completed', 'refunded', 'cancelled');
  end if;
end $do$;

create table if not exists orders (
  id                          uuid primary key default gen_random_uuid(),
  -- One of listing_id / vehicle_id identifies what was bought. Kept nullable on
  -- delete so an order survives the underlying listing being removed.
  listing_id                  uuid references listings(id) on delete set null,
  vehicle_id                  uuid references vehicles(id) on delete set null,
  buyer_id                    uuid not null references auth.users(id),
  seller_shop_id              uuid references shops(id) on delete set null,
  title                       text not null,            -- snapshot of the item name at purchase
  amount_cents                int  not null,            -- item price the buyer pays
  fee_cents                   int  not null default 0,  -- Ahlam's platform fee (held back on release)
  currency                    text not null default 'usd',
  status                      order_status not null default 'pending',
  stripe_checkout_session_id  text,
  stripe_payment_intent_id    text,
  stripe_transfer_id          text,                     -- set when funds are released to the seller
  buyer_email                 text,
  shipping_name               text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  paid_at                     timestamptz,
  completed_at                timestamptz
);

create index if not exists orders_buyer_idx        on orders(buyer_id);
create index if not exists orders_seller_shop_idx  on orders(seller_shop_id);
create index if not exists orders_status_idx        on orders(status);
create unique index if not exists orders_session_idx on orders(stripe_checkout_session_id) where stripe_checkout_session_id is not null;

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security. Writes happen server-side via the service role (which
-- bypasses RLS), so these policies only govern client reads: a buyer sees their
-- own orders, a shop member sees orders placed against their shop.
-- ---------------------------------------------------------------------------
alter table orders enable row level security;

drop policy if exists "buyer reads own orders" on orders;
create policy "buyer reads own orders" on orders
  for select using (buyer_id = auth.uid());

drop policy if exists "seller reads shop orders" on orders;
create policy "seller reads shop orders" on orders
  for select using (seller_shop_id is not null and is_shop_member(seller_shop_id));
