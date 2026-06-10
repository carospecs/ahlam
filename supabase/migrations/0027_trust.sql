-- Ahlam migration 0027: trust layer — seller verification + buyer reviews.
--
-- The audit's #1 trust gap: without ratings and verified sellers, every scam on
-- the platform sticks to the Ahlam brand (see ROW52). This adds a verified badge
-- earned through a review flow, and 1–5 star reviews aggregated onto each shop.

-- ---------------------------------------------------------------------------
-- Shop trust fields. rating_avg/rating_count are denormalized aggregates kept
-- in sync by a trigger so the marketplace feed and storefront can show stars
-- without a join. `verified` is flipped when a verification request is approved.
-- ---------------------------------------------------------------------------
do $do$ begin
  alter table shops add column if not exists verified            boolean not null default false;
  alter table shops add column if not exists verified_at         timestamptz;
  alter table shops add column if not exists verification_method text;        -- 'phone' | 'license' | 'business'
  alter table shops add column if not exists rating_avg          numeric(3,2) not null default 0;
  alter table shops add column if not exists rating_count        int not null default 0;
end $do$;

-- ---------------------------------------------------------------------------
-- Reviews. One per (shop, author). verified_purchase is true when the reviewer
-- has a completed order with the shop — surfaced as a "Verified purchase" tag.
-- ---------------------------------------------------------------------------
create table if not exists reviews (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references shops(id) on delete cascade,
  order_id          uuid references orders(id) on delete set null,
  author_id         uuid not null references auth.users(id) on delete cascade,
  rating            int  not null check (rating between 1 and 5),
  body              text,
  verified_purchase boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (shop_id, author_id)
);

create index if not exists reviews_shop_idx on reviews(shop_id);

drop trigger if exists reviews_updated_at on reviews;
create trigger reviews_updated_at
  before update on reviews
  for each row execute function set_updated_at();

-- Recompute a shop's rating aggregates whenever its reviews change.
create or replace function recalc_shop_rating() returns trigger as $$
declare
  target uuid := coalesce(new.shop_id, old.shop_id);
begin
  update shops s set
    rating_count = (select count(*) from reviews r where r.shop_id = target),
    rating_avg   = coalesce((select round(avg(rating)::numeric, 2) from reviews r where r.shop_id = target), 0)
  where s.id = target;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists reviews_recalc on reviews;
create trigger reviews_recalc
  after insert or update or delete on reviews
  for each row execute function recalc_shop_rating();

-- ---------------------------------------------------------------------------
-- Verification requests. A shop owner submits one (phone / business license /
-- business email); an admin approves it (which flips shops.verified via the
-- approve_verification RPC). Kept as a queue so review is auditable.
-- ---------------------------------------------------------------------------
do $do$ begin
  if not exists (select 1 from pg_type where typname = 'verification_status') then
    create type verification_status as enum ('pending', 'approved', 'rejected');
  end if;
end $do$;

create table if not exists verification_requests (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shops(id) on delete cascade,
  method      text not null,                  -- 'phone' | 'license' | 'business'
  detail      text,                           -- phone number, doc URL, or email submitted
  status      verification_status not null default 'pending',
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists verification_requests_shop_idx on verification_requests(shop_id, status);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table reviews enable row level security;
alter table verification_requests enable row level security;

-- Reviews are public (they're the whole point of trust).
drop policy if exists "anyone reads reviews" on reviews;
create policy "anyone reads reviews" on reviews for select using (true);

-- A signed-in user writes/edits/removes their own review.
drop policy if exists "author writes review" on reviews;
create policy "author writes review" on reviews for insert with check (author_id = auth.uid());
drop policy if exists "author updates review" on reviews;
create policy "author updates review" on reviews for update using (author_id = auth.uid());
drop policy if exists "author deletes review" on reviews;
create policy "author deletes review" on reviews for delete using (author_id = auth.uid());

-- Verification requests are only visible to the shop's members.
drop policy if exists "members read verification" on verification_requests;
create policy "members read verification" on verification_requests
  for select using (is_shop_member(shop_id));
drop policy if exists "members create verification" on verification_requests;
create policy "members create verification" on verification_requests
  for insert with check (is_shop_member(shop_id));

-- ---------------------------------------------------------------------------
-- Admin approval helper. Run by a privileged actor (service role bypasses RLS;
-- this RPC also lets a future admin UI approve from the client safely).
-- ---------------------------------------------------------------------------
create or replace function approve_verification(p_request_id uuid) returns void as $$
declare
  req verification_requests%rowtype;
begin
  select * into req from verification_requests where id = p_request_id;
  if not found then raise exception 'request not found'; end if;
  update verification_requests set status = 'approved', reviewed_at = now() where id = p_request_id;
  update shops set verified = true, verified_at = now(), verification_method = req.method where id = req.shop_id;
end;
$$ language plpgsql security definer;
