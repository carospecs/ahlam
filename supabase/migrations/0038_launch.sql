-- Launch day (Jul 2026): per-car scan metering + waitlist email tracking.
-- Run in the Supabase SQL editor (or CLI) like the other migrations.

-- 1. Scan batches: /api/identify is called once per photo, but one car (one
--    analyze run) should count as ONE scan. The client tags each photo request
--    with a shared batch_id; the unique index makes recording idempotent so a
--    15-photo car inserts a single usage row.
alter table usage_events add column if not exists batch_id text;

create unique index if not exists usage_events_shop_kind_batch
  on usage_events (shop_id, kind, batch_id)
  where batch_id is not null;

-- 2. Waitlist launch email: mark who has been emailed so the announce endpoint
--    is idempotent and can resume after a partial send.
alter table waitlist add column if not exists notified_at timestamptz;
