-- Message thread dedup.
-- Before: contact_seller / contact_shop ALWAYS inserted a brand-new conversations
-- row, so every "Message seller" tap spawned a duplicate thread in the seller's
-- inbox and a buyer could never continue one thread. Now they find-or-create:
-- reuse the existing open thread for the same (shop, buyer, listing/subject) and
-- just append the message + bump unread. Behavior is otherwise identical.

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

  -- Reuse this buyer's existing thread for this listing instead of duplicating it.
  select id into conv from conversations
    where shop_id = l.shop_id and buyer_id = auth.uid() and listing_id = p_listing_id
    order by created_at desc limit 1;

  if conv is null then
    insert into conversations (shop_id, contact_name, contact_avatar, market, part_name, listing_id, buyer_id, unread, last_time)
      values (l.shop_id, buyer, upper(left(buyer, 2)), 'Ahlam', partname, p_listing_id, auth.uid(), 1, t)
      returning id into conv;
  else
    update conversations set unread = coalesce(unread, 0) + 1, last_time = t where id = conv;
  end if;

  insert into messages (conversation_id, sender, body, time)
    values (conv, 'them', p_message, t);

  insert into activity_log (shop_id, icon, text, tone)
    values (l.shop_id, 'MessageSquare', buyer || ' messaged about ' || partname, 'muted');
end;
$fn$ language plpgsql security definer;

grant execute on function contact_seller(uuid, text) to authenticated;

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

  -- Reuse this buyer's existing whole-car thread with this shop for the same subject.
  select id into conv from conversations
    where shop_id = p_shop_id and buyer_id = auth.uid() and listing_id is null
      and coalesce(part_name, '') = coalesce(p_subject, '')
    order by created_at desc limit 1;

  if conv is null then
    insert into conversations (shop_id, contact_name, contact_avatar, market, part_name, buyer_id, unread, last_time)
      values (p_shop_id, buyer, upper(left(buyer, 2)), 'Ahlam', p_subject, auth.uid(), 1, t)
      returning id into conv;
  else
    update conversations set unread = coalesce(unread, 0) + 1, last_time = t where id = conv;
  end if;

  insert into messages (conversation_id, sender, body, time)
    values (conv, 'them', p_message, t);

  insert into activity_log (shop_id, icon, text, tone)
    values (p_shop_id, 'MessageSquare', buyer || ' asked about ' || coalesce(p_subject, 'a vehicle'), 'muted');
end;
$fn$ language plpgsql security definer;

grant execute on function contact_shop(uuid, text, text) to authenticated;
