


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."listing_status" AS ENUM (
    'draft',
    'active',
    'sold',
    'removed'
);


ALTER TYPE "public"."listing_status" OWNER TO "postgres";


CREATE TYPE "public"."member_role" AS ENUM (
    'owner',
    'editor',
    'viewer'
);


ALTER TYPE "public"."member_role" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'pending',
    'paid',
    'shipped',
    'completed',
    'refunded',
    'cancelled'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."plan_tier" AS ENUM (
    'free',
    'starter',
    'founder',
    'solo',
    'growth',
    'max',
    'ultimate',
    'pro'
);


ALTER TYPE "public"."plan_tier" OWNER TO "postgres";


CREATE TYPE "public"."verification_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."verification_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_my_invites"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
  $$;


ALTER FUNCTION "public"."accept_my_invites"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_verification"("p_request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  req verification_requests%rowtype;
begin
  select * into req from verification_requests where id = p_request_id;
  if not found then raise exception 'request not found'; end if;
  update verification_requests set status = 'approved', reviewed_at = now() where id = p_request_id;
  update shops set verified = true, verified_at = now(), verification_method = req.method where id = req.shop_id;
end;
$$;


ALTER FUNCTION "public"."approve_verification"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."contact_seller"("p_listing_id" "uuid", "p_message" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."contact_seller"("p_listing_id" "uuid", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."contact_shop"("p_shop_id" "uuid", "p_subject" "text", "p_message" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."contact_shop"("p_shop_id" "uuid", "p_subject" "text", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_shop"("shop_name" "text", "shop_location" "text" DEFAULT NULL::"text", "shop_phone" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;
  insert into shops (name, location, business_phone)
    values (shop_name, shop_location, shop_phone)
    returning id into new_id;
  insert into shop_members (shop_id, user_id, role)
    values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;


ALTER FUNCTION "public"."create_shop"("shop_name" "text", "shop_location" "text", "shop_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_shop_member"("target_shop" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from shop_members
    where shop_id = target_shop and user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_shop_member"("target_shop" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_shop_owner"("target_shop" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    select exists (
      select 1 from shop_members
      where shop_id = target_shop and user_id = auth.uid() and role = 'owner'
    );
  $$;


ALTER FUNCTION "public"."is_shop_owner"("target_shop" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalc_shop_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  target uuid := coalesce(new.shop_id, old.shop_id);
begin
  update shops s set
    rating_count = (select count(*) from reviews r where r.shop_id = target),
    rating_avg   = coalesce((select round(avg(rating)::numeric, 2) from reviews r where r.shop_id = target), 0)
  where s.id = target;
  return null;
end;
$$;


ALTER FUNCTION "public"."recalc_shop_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "icon" "text" DEFAULT 'CircleCheck'::"text" NOT NULL,
    "text" "text" NOT NULL,
    "time" "text",
    "tone" "text" DEFAULT 'muted'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "contact_name" "text" NOT NULL,
    "contact_avatar" "text",
    "market" "text" DEFAULT 'Facebook'::"text" NOT NULL,
    "part_name" "text",
    "listing_id" "uuid",
    "unread" integer DEFAULT 0 NOT NULL,
    "last_time" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "buyer_id" "uuid",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "buyer_unread" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interchange" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "part_name" "text" NOT NULL,
    "part_category" "text",
    "oem_number" "text",
    "make" "text",
    "model" "text",
    "year_start" integer,
    "year_end" integer,
    "notes" "text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "confidence" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."interchange" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interchange_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "query_key" "text" NOT NULL,
    "part" "text",
    "make" "text",
    "model" "text",
    "year" "text",
    "variant" "text",
    "result" "jsonb" NOT NULL,
    "hit_count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."interchange_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "photo_url" "text" NOT NULL,
    "ai_output" "jsonb" NOT NULL,
    "corrected" "jsonb",
    "vin" "text",
    "other_notes" "text",
    "status" "public"."listing_status" DEFAULT 'draft'::"public"."listing_status" NOT NULL,
    "marketplace_url" "text",
    "price_usd" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "vehicle_id" "uuid",
    "listing_type" "text" DEFAULT 'part'::"text" NOT NULL,
    "seller_id" "uuid",
    "views" integer DEFAULT 0 NOT NULL,
    "ebay_listing_id" "text",
    "ebay_url" "text",
    "stock_location" "text",
    "barcode" "text",
    "stock_number" "text",
    "sold_price" numeric(10,2),
    "sold_at" timestamp with time zone,
    "photo_urls" "jsonb",
    CONSTRAINT "listings_listing_type_check" CHECK (("listing_type" = ANY (ARRAY['part'::"text", 'whole_vehicle'::"text"])))
);


ALTER TABLE "public"."listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_comps" (
    "comp_key" "text" NOT NULL,
    "vehicle" "text" NOT NULL,
    "part_name" "text" NOT NULL,
    "grade" "text" NOT NULL,
    "price_usd" integer NOT NULL,
    "low_usd" integer,
    "high_usd" integer,
    "confidence" "text" NOT NULL,
    "comp_count" integer DEFAULT 0 NOT NULL,
    "sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "market_comps_confidence_check" CHECK (("confidence" = ANY (ARRAY['high'::"text", 'medium'::"text"])))
);


ALTER TABLE "public"."market_comps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender" "text" NOT NULL,
    "body" "text" NOT NULL,
    "time" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messages_sender_check" CHECK (("sender" = ANY (ARRAY['me'::"text", 'them'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid",
    "vehicle_id" "uuid",
    "buyer_id" "uuid" NOT NULL,
    "seller_shop_id" "uuid",
    "title" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "fee_cents" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "status" "public"."order_status" DEFAULT 'pending'::"public"."order_status" NOT NULL,
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "stripe_transfer_id" "text",
    "buyer_email" "text",
    "shipping_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "warranty_days" integer DEFAULT 0 NOT NULL,
    "warranty_expires_at" timestamp with time zone
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_cache" (
    "query" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "source" "text" DEFAULT 'grounded'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."price_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "phone" "text",
    "bio" "text",
    "shop_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notification_prefs" "jsonb" DEFAULT '{"ai_alerts": true, "marketing": false, "buyer_messages": true, "weekly_summary": true}'::"jsonb" NOT NULL,
    "is_online" boolean DEFAULT false NOT NULL,
    "last_seen" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "order_id" "uuid",
    "author_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "body" "text",
    "verified_purchase" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "account_label" "text",
    "env" "text" DEFAULT 'production'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fulfillment_policy_id" "text",
    "payment_policy_id" "text",
    "return_policy_id" "text",
    "location_key" "text"
);


ALTER TABLE "public"."shop_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."member_role" DEFAULT 'viewer'::"public"."member_role" NOT NULL,
    "invited_by" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "shop_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."shop_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."member_role" DEFAULT 'owner'::"public"."member_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shop_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "location" "text",
    "business_phone" "text",
    "default_prices" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "email" "text",
    "website" "text",
    "logo_url" "text",
    "cover_url" "text",
    "hours" "text",
    "lat" numeric(10,7),
    "lng" numeric(10,7),
    "zip_code" "text",
    "address_line" "text",
    "nmvtis_id" "text",
    "nmvtis_entity_name" "text",
    "default_warranty_days" integer DEFAULT 30 NOT NULL,
    "returns_policy" "text",
    "stripe_account_id" "text",
    "charges_enabled" boolean DEFAULT false NOT NULL,
    "payouts_enabled" boolean DEFAULT false NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "verified_at" timestamp with time zone,
    "verification_method" "text",
    "rating_avg" numeric(3,2) DEFAULT 0 NOT NULL,
    "rating_count" integer DEFAULT 0 NOT NULL,
    "account_type" "text" DEFAULT 'shop'::"text" NOT NULL,
    "stripe_customer_id" "text",
    "subscription_status" "text",
    "plan" "public"."plan_tier" DEFAULT 'pro'::"public"."plan_tier" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    CONSTRAINT "shops_account_type_check" CHECK (("account_type" = ANY (ARRAY['shop'::"text", 'individual'::"text"])))
);


ALTER TABLE "public"."shops" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."shop_members_emails" AS
 SELECT "sm"."id",
    "sm"."shop_id",
    "s"."name" AS "shop_name",
    "sm"."user_id",
    "u"."email",
    "p"."display_name",
    "sm"."role",
    "sm"."created_at"
   FROM ((("public"."shop_members" "sm"
     JOIN "auth"."users" "u" ON (("u"."id" = "sm"."user_id")))
     LEFT JOIN "public"."shops" "s" ON (("s"."id" = "sm"."shop_id")))
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "sm"."user_id")))
  ORDER BY "sm"."created_at";


ALTER VIEW "public"."shop_members_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "batch_id" "text"
);


ALTER TABLE "public"."usage_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "year" "text" NOT NULL,
    "make" "text" NOT NULL,
    "model" "text" NOT NULL,
    "trim" "text",
    "body" "text",
    "color" "text",
    "vin" "text",
    "mileage" "text",
    "asking_price" numeric(10,2),
    "sell_mode" "text" DEFAULT 'parts'::"text" NOT NULL,
    "photos" integer DEFAULT 0 NOT NULL,
    "status" "public"."listing_status" DEFAULT 'draft'::"public"."listing_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text",
    "photo_url" "text",
    "description" "text",
    "ebay_listing_id" "text",
    "ebay_url" "text",
    "ebay_lot_id" "text",
    "ebay_lot_url" "text",
    "stock_number" "text",
    "photo_urls" "jsonb",
    "acquisition_cost_cents" integer,
    "date_obtained" "date",
    "obtained_from_name" "text",
    "obtained_from_address" "text",
    "nmvtis_disposition" "text",
    "nmvtis_reported_at" timestamp with time zone,
    "nmvtis_period" "text",
    CONSTRAINT "vehicles_sell_mode_check" CHECK (("sell_mode" = ANY (ARRAY['parts'::"text", 'whole'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."vehicles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verification_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "method" "text" NOT NULL,
    "detail" "text",
    "status" "public"."verification_status" DEFAULT 'pending'::"public"."verification_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone
);


ALTER TABLE "public"."verification_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "shop_name" "text",
    "location" "text",
    "parts_per_day" integer,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notified_at" timestamp with time zone
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interchange_cache"
    ADD CONSTRAINT "interchange_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interchange_cache"
    ADD CONSTRAINT "interchange_cache_query_key_key" UNIQUE ("query_key");



ALTER TABLE ONLY "public"."interchange"
    ADD CONSTRAINT "interchange_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."market_comps"
    ADD CONSTRAINT "market_comps_pkey" PRIMARY KEY ("comp_key");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_cache"
    ADD CONSTRAINT "price_cache_pkey" PRIMARY KEY ("query");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_shop_id_author_id_key" UNIQUE ("shop_id", "author_id");



ALTER TABLE ONLY "public"."shop_integrations"
    ADD CONSTRAINT "shop_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_integrations"
    ADD CONSTRAINT "shop_integrations_shop_id_provider_key" UNIQUE ("shop_id", "provider");



ALTER TABLE ONLY "public"."shop_invites"
    ADD CONSTRAINT "shop_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_invites"
    ADD CONSTRAINT "shop_invites_shop_id_email_key" UNIQUE ("shop_id", "email");



ALTER TABLE ONLY "public"."shop_members"
    ADD CONSTRAINT "shop_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_members"
    ADD CONSTRAINT "shop_members_shop_id_user_id_key" UNIQUE ("shop_id", "user_id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verification_requests"
    ADD CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



CREATE INDEX "activity_shop_idx" ON "public"."activity_log" USING "btree" ("shop_id");



CREATE INDEX "contact_messages_listing_idx" ON "public"."contact_messages" USING "btree" ("listing_id");



CREATE INDEX "contact_messages_seller_idx" ON "public"."contact_messages" USING "btree" ("seller_id");



CREATE INDEX "idx_conversations_status" ON "public"."conversations" USING "btree" ("shop_id", "status");



CREATE INDEX "idx_listings_barcode" ON "public"."listings" USING "btree" ("barcode");



CREATE INDEX "idx_listings_stock_location" ON "public"."listings" USING "btree" ("stock_location");



CREATE INDEX "interchange_cache_key_idx" ON "public"."interchange_cache" USING "btree" ("query_key");



CREATE INDEX "interchange_oem_idx" ON "public"."interchange" USING "btree" ("oem_number");



CREATE INDEX "interchange_part_idx" ON "public"."interchange" USING "btree" ("part_name");



CREATE INDEX "listings_shop_idx" ON "public"."listings" USING "btree" ("shop_id");



CREATE INDEX "listings_sold_idx" ON "public"."listings" USING "btree" ("shop_id", "status") WHERE ("status" = 'sold'::"public"."listing_status");



CREATE INDEX "listings_status_idx" ON "public"."listings" USING "btree" ("status");



CREATE INDEX "listings_vehicle_id_idx" ON "public"."listings" USING "btree" ("vehicle_id");



CREATE INDEX "market_comps_created_at_idx" ON "public"."market_comps" USING "btree" ("created_at");



CREATE INDEX "messages_conv_idx" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "orders_buyer_idx" ON "public"."orders" USING "btree" ("buyer_id");



CREATE INDEX "orders_seller_shop_idx" ON "public"."orders" USING "btree" ("seller_shop_id");



CREATE UNIQUE INDEX "orders_session_idx" ON "public"."orders" USING "btree" ("stripe_checkout_session_id") WHERE ("stripe_checkout_session_id" IS NOT NULL);



CREATE INDEX "orders_status_idx" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "reviews_shop_idx" ON "public"."reviews" USING "btree" ("shop_id");



CREATE INDEX "shop_invites_email_idx" ON "public"."shop_invites" USING "btree" ("email");



CREATE INDEX "shop_invites_shop_idx" ON "public"."shop_invites" USING "btree" ("shop_id");



CREATE INDEX "shops_zip_idx" ON "public"."shops" USING "btree" ("zip_code");



CREATE UNIQUE INDEX "usage_events_shop_kind_batch" ON "public"."usage_events" USING "btree" ("shop_id", "kind", "batch_id");



CREATE INDEX "usage_events_shop_kind_time" ON "public"."usage_events" USING "btree" ("shop_id", "kind", "created_at");



CREATE INDEX "vehicles_shop_idx" ON "public"."vehicles" USING "btree" ("shop_id");



CREATE INDEX "verification_requests_shop_idx" ON "public"."verification_requests" USING "btree" ("shop_id", "status");



CREATE OR REPLACE TRIGGER "listings_updated_at" BEFORE UPDATE ON "public"."listings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "reviews_recalc" AFTER INSERT OR DELETE OR UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."recalc_shop_rating"();



CREATE OR REPLACE TRIGGER "reviews_updated_at" BEFORE UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_seller_shop_id_fkey" FOREIGN KEY ("seller_shop_id") REFERENCES "public"."shops"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_integrations"
    ADD CONSTRAINT "shop_integrations_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_invites"
    ADD CONSTRAINT "shop_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."shop_invites"
    ADD CONSTRAINT "shop_invites_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_members"
    ADD CONSTRAINT "shop_members_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_members"
    ADD CONSTRAINT "shop_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."verification_requests"
    ADD CONSTRAINT "verification_requests_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anyone can join waitlist" ON "public"."waitlist" FOR INSERT WITH CHECK (true);



CREATE POLICY "anyone can read shops" ON "public"."shops" FOR SELECT USING (true);



CREATE POLICY "anyone reads reviews" ON "public"."reviews" FOR SELECT USING (true);



CREATE POLICY "author deletes review" ON "public"."reviews" FOR DELETE USING (("author_id" = "auth"."uid"()));



CREATE POLICY "author updates review" ON "public"."reviews" FOR UPDATE USING (("author_id" = "auth"."uid"()));



CREATE POLICY "author writes review" ON "public"."reviews" FOR INSERT WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "buyer can insert contact" ON "public"."contact_messages" FOR INSERT WITH CHECK (("buyer_id" = "auth"."uid"()));



CREATE POLICY "buyer can read own" ON "public"."contact_messages" FOR SELECT USING (("buyer_id" = "auth"."uid"()));



CREATE POLICY "buyer reads own orders" ON "public"."orders" FOR SELECT USING (("buyer_id" = "auth"."uid"()));



ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interchange" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interchange_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."market_comps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "members create verification" ON "public"."verification_requests" FOR INSERT WITH CHECK ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members insert activity" ON "public"."activity_log" FOR INSERT WITH CHECK ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members insert conversations" ON "public"."conversations" FOR INSERT WITH CHECK ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members insert listings" ON "public"."listings" FOR INSERT WITH CHECK ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members insert messages" ON "public"."messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND "public"."is_shop_member"("c"."shop_id")))));



CREATE POLICY "members insert vehicles" ON "public"."vehicles" FOR INSERT WITH CHECK ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members manage invites" ON "public"."shop_invites" USING ("public"."is_shop_member"("shop_id")) WITH CHECK ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members read activity" ON "public"."activity_log" FOR SELECT USING ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members read conversations" ON "public"."conversations" FOR SELECT USING ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members read invites" ON "public"."shop_invites" FOR SELECT USING ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members read listings" ON "public"."listings" FOR SELECT USING ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members read messages" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND "public"."is_shop_member"("c"."shop_id")))));



CREATE POLICY "members read vehicles" ON "public"."vehicles" FOR SELECT USING ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members read verification" ON "public"."verification_requests" FOR SELECT USING ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members update conversations" ON "public"."conversations" FOR UPDATE USING ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members update listings" ON "public"."listings" FOR UPDATE USING ("public"."is_shop_member"("shop_id"));



CREATE POLICY "members update own shop" ON "public"."shops" FOR UPDATE USING ("public"."is_shop_member"("id"));



CREATE POLICY "members update vehicles" ON "public"."vehicles" FOR UPDATE USING ("public"."is_shop_member"("shop_id"));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles insert own" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles read own" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles read public" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "profiles update own" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "public read listings" ON "public"."listings" FOR SELECT USING (true);



CREATE POLICY "public read vehicles" ON "public"."vehicles" FOR SELECT USING (true);



CREATE POLICY "read own memberships" ON "public"."shop_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_shop_member"("shop_id")));



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seller can read own" ON "public"."contact_messages" FOR SELECT USING (("seller_id" = "auth"."uid"()));



CREATE POLICY "seller reads shop orders" ON "public"."orders" FOR SELECT USING ((("seller_shop_id" IS NOT NULL) AND "public"."is_shop_member"("seller_shop_id")));



ALTER TABLE "public"."shop_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usage_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verification_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."accept_my_invites"() TO "anon";
GRANT ALL ON FUNCTION "public"."accept_my_invites"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_my_invites"() TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_verification"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_verification"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_verification"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."contact_seller"("p_listing_id" "uuid", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."contact_seller"("p_listing_id" "uuid", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contact_seller"("p_listing_id" "uuid", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."contact_shop"("p_shop_id" "uuid", "p_subject" "text", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."contact_shop"("p_shop_id" "uuid", "p_subject" "text", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contact_shop"("p_shop_id" "uuid", "p_subject" "text", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_shop"("shop_name" "text", "shop_location" "text", "shop_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_shop"("shop_name" "text", "shop_location" "text", "shop_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_shop"("shop_name" "text", "shop_location" "text", "shop_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_shop_member"("target_shop" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_shop_member"("target_shop" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_shop_member"("target_shop" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_shop_owner"("target_shop" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_shop_owner"("target_shop" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_shop_owner"("target_shop" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalc_shop_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_shop_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_shop_rating"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."contact_messages" TO "anon";
GRANT ALL ON TABLE "public"."contact_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_messages" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."interchange" TO "anon";
GRANT ALL ON TABLE "public"."interchange" TO "authenticated";
GRANT ALL ON TABLE "public"."interchange" TO "service_role";



GRANT ALL ON TABLE "public"."interchange_cache" TO "anon";
GRANT ALL ON TABLE "public"."interchange_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."interchange_cache" TO "service_role";



GRANT ALL ON TABLE "public"."listings" TO "anon";
GRANT ALL ON TABLE "public"."listings" TO "authenticated";
GRANT ALL ON TABLE "public"."listings" TO "service_role";



GRANT ALL ON TABLE "public"."market_comps" TO "anon";
GRANT ALL ON TABLE "public"."market_comps" TO "authenticated";
GRANT ALL ON TABLE "public"."market_comps" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."price_cache" TO "anon";
GRANT ALL ON TABLE "public"."price_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."price_cache" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."shop_integrations" TO "anon";
GRANT ALL ON TABLE "public"."shop_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."shop_invites" TO "anon";
GRANT ALL ON TABLE "public"."shop_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_invites" TO "service_role";



GRANT ALL ON TABLE "public"."shop_members" TO "anon";
GRANT ALL ON TABLE "public"."shop_members" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_members" TO "service_role";



GRANT ALL ON TABLE "public"."shops" TO "anon";
GRANT ALL ON TABLE "public"."shops" TO "authenticated";
GRANT ALL ON TABLE "public"."shops" TO "service_role";



GRANT ALL ON TABLE "public"."shop_members_emails" TO "service_role";



GRANT ALL ON TABLE "public"."usage_events" TO "anon";
GRANT ALL ON TABLE "public"."usage_events" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_events" TO "service_role";



GRANT ALL ON TABLE "public"."vehicles" TO "anon";
GRANT ALL ON TABLE "public"."vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."verification_requests" TO "anon";
GRANT ALL ON TABLE "public"."verification_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."verification_requests" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































