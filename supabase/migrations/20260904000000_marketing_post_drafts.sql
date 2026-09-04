-- A founder-reviewed marketing queue for client storefront inventory.
-- The scheduled SDK worker creates drafts; a human remains responsible for
-- the final Facebook review/publish action.

alter table public.shops
  add column if not exists marketing_enabled boolean not null default false;

create table if not exists public.marketing_post_drafts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  source_vehicle_id uuid references public.vehicles(id) on delete set null,
  source_listing_id uuid references public.listings(id) on delete set null,
  platform text not null default 'facebook',
  slot_key text not null,
  scheduled_for timestamptz not null,
  headline text not null,
  body text not null,
  image_url text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'ready',
  generator text not null default 'deterministic',
  agent_run_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_post_drafts_platform_check
    check (platform in ('facebook', 'linkedin')),
  constraint marketing_post_drafts_status_check
    check (status in ('ready', 'opened', 'published', 'skipped', 'failed')),
  constraint marketing_post_drafts_one_per_slot
    unique (shop_id, platform, slot_key)
);

create index if not exists marketing_post_drafts_status_schedule_idx
  on public.marketing_post_drafts(status, scheduled_for desc);
create index if not exists marketing_post_drafts_shop_created_idx
  on public.marketing_post_drafts(shop_id, created_at desc);

alter table public.marketing_post_drafts enable row level security;

drop policy if exists "shop members read marketing drafts" on public.marketing_post_drafts;
create policy "shop members read marketing drafts"
  on public.marketing_post_drafts for select
  using (public.is_shop_member(shop_id));

drop policy if exists "shop owners update marketing drafts" on public.marketing_post_drafts;
create policy "shop owners update marketing drafts"
  on public.marketing_post_drafts for update
  using (
    exists (
      select 1 from public.shop_members sm
      where sm.shop_id = marketing_post_drafts.shop_id
        and sm.user_id = auth.uid()
        and sm.role in ('owner', 'editor')
    )
  )
  with check (
    exists (
      select 1 from public.shop_members sm
      where sm.shop_id = marketing_post_drafts.shop_id
        and sm.user_id = auth.uid()
        and sm.role in ('owner', 'editor')
    )
  );

grant select, update on public.marketing_post_drafts to authenticated;
grant all on public.marketing_post_drafts to service_role;

-- These are the client websites currently pinned in shop-subdomains.ts.
-- Future shops can be opted in from the founder console without a code deploy.
update public.shops
set marketing_enabled = true
where id in (
  '159c4cdc-3cbc-4061-9942-5c901486df49', -- Downtown Auto Dismantlers
  '9e40bef8-f3d4-4f5a-bc99-b01af1053499', -- Aacon Auto Parts
  'de61192c-a92a-4c6c-a8be-d26eb0891dfa', -- Avalanche Auto Wrecking
  '82e638d7-7c4c-467a-97b1-baa5c7a71332', -- Speedy Auto Wrecking
  '555bb92c-64a2-4092-a1fd-0024cedaed6b', -- A&B Auto Salvage
  '749da208-9fa9-466a-a6d0-eca31cde97aa'  -- El Apache Auto Wrecking
);
