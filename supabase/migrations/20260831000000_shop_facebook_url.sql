-- Shop-owner-editable Facebook page link, shown next to Website on the
-- Ultimate personal sites ({slug}.ahlam.io -> /site/[slug]).

alter table public.shops add column if not exists facebook_url text;
