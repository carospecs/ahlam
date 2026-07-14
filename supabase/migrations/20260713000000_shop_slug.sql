-- Ultimate-plan personal websites: qualifying shops get {slug}.ahlam.io.
-- The slug is a DNS label (3-63 chars, lowercase alphanumerics + inner hyphens),
-- unique case-insensitively. Reserved-word enforcement lives app-side in
-- web/src/lib/slug.ts (the source of truth); the backfill below only skips the
-- handful of labels that would shadow core infrastructure.

alter table public.shops add column if not exists slug text;

alter table public.shops drop constraint if exists shops_slug_format;
alter table public.shops add constraint shops_slug_format
  check (slug is null or slug ~ '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$');

create unique index if not exists shops_slug_key on public.shops (lower(slug));

-- Backfill slugs for shops already on a qualifying plan. The slugify expression
-- must stay byte-identical to slugify() in web/src/lib/slug.ts. Shops whose
-- names produce a too-short or reserved label are skipped; their owners claim a
-- slug by hand in Settings.
with base as (
  select id, created_at,
    regexp_replace(
      left(
        regexp_replace(regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '-', 'g'), '(^-+)|(-+$)', '', 'g'),
        63
      ),
      '-+$', ''
    ) as slug_base
  from public.shops
  where plan in ('ultimate', 'founder') and slug is null
),
eligible as (
  select id, slug_base,
    row_number() over (partition by slug_base order by created_at) as rn
  from base
  where length(slug_base) >= 3
    and slug_base !~ '^(www|app|api|admin|adminhost|mail|dashboard|shop|blog|guides|feed|staging|ahlam)$'
)
update public.shops s
set slug = case
  when e.rn = 1 then e.slug_base
  else left(e.slug_base, 63 - length('-' || e.rn::text)) || '-' || e.rn::text
end
from eligible e
where s.id = e.id;
