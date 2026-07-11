-- Conversation lifecycle status for the seller's inbox.
--   open   = still chatting / working on it (default)
--   dealt  = a deal was made
--   closed = ended with no deal
alter table conversations
  add column if not exists status text not null default 'open';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'conversations_status_check'
  ) then
    alter table conversations
      add constraint conversations_status_check
      check (status in ('open', 'dealt', 'closed'));
  end if;
end$$;

create index if not exists idx_conversations_status on conversations (shop_id, status);
