-- One encrypted, founder-managed social connection for Ahlam's own channels.
-- Tokens are encrypted by the server before they reach Postgres. No client or
-- authenticated-user policy can read this table.
create table if not exists public.marketing_integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  organization_id text not null,
  account_label text,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scopes text[] not null default '{}'::text[],
  status text not null default 'active',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_integrations_provider_check
    check (provider in ('linkedin')),
  constraint marketing_integrations_status_check
    check (status in ('active', 'reconnect_required', 'error'))
);

alter table public.marketing_integrations enable row level security;
revoke all on public.marketing_integrations from anon, authenticated;
grant all on public.marketing_integrations to service_role;

alter table public.marketing_post_drafts
  add column if not exists published_post_id text,
  add column if not exists published_url text,
  add column if not exists published_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz;

alter table public.marketing_post_drafts
  drop constraint if exists marketing_post_drafts_status_check;
alter table public.marketing_post_drafts
  add constraint marketing_post_drafts_status_check
    check (status in ('ready', 'opened', 'publishing', 'published', 'skipped', 'failed'));

create index if not exists marketing_post_drafts_platform_schedule_idx
  on public.marketing_post_drafts(platform, status, scheduled_for);
