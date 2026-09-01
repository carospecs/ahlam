-- Shop-owner-editable Yelp page link, shown next to Facebook on the
-- Ultimate personal sites ({slug}.ahlam.io -> /site/[slug]).

alter table public.shops add column if not exists yelp_url text;
