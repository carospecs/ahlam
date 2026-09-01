-- Shop-owner-editable promo banner shown across the Ultimate personal site
-- ({slug}.ahlam.io -> /site/[slug]/...), e.g. a seasonal sale announcement.
-- Free text so the shop controls dates/terms; null/empty hides the banner.

alter table public.shops add column if not exists promo_text text;
