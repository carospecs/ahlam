-- Ahlam migration 0005: marketplace fields, shop profile, team invites,
-- notification prefs, and listing views.

-- ---------------------------------------------------------------------------
-- Shop public profile fields (shown on marketplace listings)
-- ---------------------------------------------------------------------------
do $do$ begin
  alter table shops add column if not exists description text;
  alter table shops add column if not exists email        text;
  alter table shops add column if not exists website      text;
  alter table shops add column if not exists logo_url     text;
  alter table shops add column if not exists cover_url    text;
  alter table shops add column if not exists hours        text;
end $do$;

-- ---------------------------------------------------------------------------
-- Listing views counter (marketplace presentation)
-- ---------------------------------------------------------------------------
do $do$ begin
  alter table listings add column if not exists views int not null default 0;
end $do$;

-- Make sure marketplace can read whole-car vehicles publicly.
drop policy if exists "public read vehicles" on vehicles;
create policy "public read vehicles" on vehicles
  for select using (true);

-- ---------------------------------------------------------------------------
-- Profile notification preferences
-- ---------------------------------------------------------------------------
do $do$ begin
  alter table profiles add column if not exists notification_prefs jsonb
    not null default '{"buyer_messages":true,"weekly_summary":true,"ai_alerts":true,"marketing":false}'::jsonb;
end $do$;

-- ---------------------------------------------------------------------------
-- Team invites
-- ---------------------------------------------------------------------------
create table if not exists shop_invites (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shops(id) on delete cascade,
  email       text not null,
  role        member_role not null default 'viewer',
  invited_by  uuid references auth.users(id),
  status      text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at  timestamptz not null default now(),
  unique (shop_id, email)
);

create index if not exists shop_invites_shop_idx on shop_invites(shop_id);
create index if not exists shop_invites_email_idx on shop_invites(email);

alter table shop_invites enable row level security;

drop policy if exists "members read invites" on shop_invites;
create policy "members read invites" on shop_invites
  for select using (is_shop_member(shop_id));

drop policy if exists "members manage invites" on shop_invites;
create policy "members manage invites" on shop_invites
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

-- ---------------------------------------------------------------------------
-- Helper: is the current user the OWNER of a shop? (used for team mgmt)
-- ---------------------------------------------------------------------------
create or replace function is_shop_owner(target_shop uuid) returns boolean as $fn$
  select exists (
    select 1 from shop_members
    where shop_id = target_shop and user_id = auth.uid() and role = 'owner'
  );
$fn$ language sql security definer stable;

-- ---------------------------------------------------------------------------
-- RPC: accept any pending invites for the signed-in user's email.
-- ---------------------------------------------------------------------------
create or replace function accept_my_invites() returns int as $fn$
declare
  claimed int := 0;
  inv record;
begin
  if auth.uid() is null then
    return 0;
  end if;
  for inv in
    select i.* from shop_invites i
    join auth.users u on lower(u.email) = lower(i.email)
    where u.id = auth.uid() and i.status = 'pending'
  loop
    insert into shop_members (shop_id, user_id, role)
      values (inv.shop_id, auth.uid(), inv.role)
      on conflict (shop_id, user_id) do nothing;
    update shop_invites set status = 'accepted' where id = inv.id;
    update profiles set shop_id = inv.shop_id
      where id = auth.uid() and shop_id is null;
    claimed := claimed + 1;
  end loop;
  return claimed;
end;
$fn$ language plpgsql security definer;

grant execute on function accept_my_invites() to authenticated;
grant execute on function is_shop_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: a buyer contacts the seller of a part listing.
-- ---------------------------------------------------------------------------
create or replace function contact_seller(p_listing_id uuid, p_message text)
returns void as $fn$
declare
  l        listings%rowtype;
  seller   uuid;
  buyer    text;
  partname text;
  conv     uuid;
  t        text;
begin
  if auth.uid() is null then raise exception 'must be authenticated'; end if;
  if coalesce(trim(p_message), '') = '' then raise exception 'message required'; end if;

  select * into l from listings where id = p_listing_id;
  if not found then raise exception 'listing not found'; end if;

  seller := coalesce(l.seller_id, l.created_by);
  if seller = auth.uid() then raise exception 'cannot contact your own listing'; end if;

  select coalesce(display_name, 'A buyer') into buyer from profiles where id = auth.uid();
  if buyer is null then buyer := 'A buyer'; end if;

  partname := coalesce(
    l.corrected ->> 'partName', l.corrected ->> 'part_name',
    l.ai_output ->> 'partName', l.ai_output ->> 'part_name', 'a listing');
  t := to_char(now(), 'FMHH12:MI AM');

  insert into contact_messages (listing_id, buyer_id, seller_id, message)
    values (p_listing_id, auth.uid(), seller, p_message);

  insert into conversations (shop_id, contact_name, contact_avatar, market, part_name, listing_id, buyer_id, unread, last_time)
    values (l.shop_id, buyer, upper(left(buyer, 2)), 'Ahlam', partname, p_listing_id, auth.uid(), 1, t)
    returning id into conv;

  insert into messages (conversation_id, sender, body, time)
    values (conv, 'them', p_message, t);

  insert into activity_log (shop_id, icon, text, tone)
    values (l.shop_id, 'MessageSquare', buyer || ' messaged about ' || partname, 'muted');
end;
$fn$ language plpgsql security definer;

grant execute on function contact_seller(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: contact a shop directly (whole-car vehicle inquiries).
-- ---------------------------------------------------------------------------
create or replace function contact_shop(p_shop_id uuid, p_subject text, p_message text)
returns void as $fn$
declare
  buyer text;
  conv  uuid;
  t     text;
begin
  if auth.uid() is null then raise exception 'must be authenticated'; end if;
  if coalesce(trim(p_message), '') = '' then raise exception 'message required'; end if;
  if exists (select 1 from shop_members where shop_id = p_shop_id and user_id = auth.uid()) then
    raise exception 'cannot contact your own shop';
  end if;

  select coalesce(display_name, 'A buyer') into buyer from profiles where id = auth.uid();
  if buyer is null then buyer := 'A buyer'; end if;
  t := to_char(now(), 'FMHH12:MI AM');

  insert into conversations (shop_id, contact_name, contact_avatar, market, part_name, buyer_id, unread, last_time)
    values (p_shop_id, buyer, upper(left(buyer, 2)), 'Ahlam', p_subject, auth.uid(), 1, t)
    returning id into conv;

  insert into messages (conversation_id, sender, body, time)
    values (conv, 'them', p_message, t);

  insert into activity_log (shop_id, icon, text, tone)
    values (p_shop_id, 'MessageSquare', buyer || ' asked about ' || coalesce(p_subject, 'a vehicle'), 'muted');
end;
$fn$ language plpgsql security definer;

grant execute on function contact_shop(uuid, text, text) to authenticated;
