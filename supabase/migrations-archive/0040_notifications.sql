-- In-app message notifications catch-up (run each block as its OWN query in
-- the Supabase SQL editor).
--
-- Why: buyer messages were reaching sellers by email only. The contact RPCs
-- must bump conversations.unread (the 0034 versions do; older 0005 versions
-- don't), and buyers had no unread counter at all for seller replies.

-- ---------------------------------------------------------------------------
-- QUERY 1: columns (idempotent)
-- ---------------------------------------------------------------------------
alter table public.conversations add column if not exists buyer_id uuid;
alter table public.conversations add column if not exists listing_id uuid;
alter table public.conversations add column if not exists status text not null default 'open';
-- NEW: seller replies the buyer hasn't seen yet (mirror of unread, which is
-- the seller's counter for buyer messages).
alter table public.conversations add column if not exists buyer_unread int not null default 0;

-- ---------------------------------------------------------------------------
-- QUERY 2 and QUERY 3: make sure prod runs the 0034 find-or-create versions of
-- the contact RPCs (they bump unread; the 0005 originals predate that).
-- Copy each `create or replace function ... grant execute ...` block from
-- supabase/migrations/0034_message_thread_dedup.sql and run it as its own
-- query. If they already ran once, rerunning is harmless.
-- ---------------------------------------------------------------------------
