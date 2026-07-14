-- AI interchange cache + self-building Hollander-style catalog.
--
-- Every interchange lookup is answered by AI once, then cached here. Repeat
-- lookups are served from this table (instant + free, no AI call), and each new
-- result is also fanned out into the structured `interchange` table (one row per
-- compatible vehicle) so the shop slowly builds its own proprietary catalog.

create table if not exists interchange_cache (
  id          uuid primary key default gen_random_uuid(),
  query_key   text not null unique,   -- normalized "part|make|model|year|variant"
  part        text not null,
  make        text,
  model       text,
  year        text,
  variant     text,
  result      jsonb not null,         -- full AI result (sans live marketplace matches)
  hit_count   int  not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists interchange_cache_key_idx on interchange_cache(query_key);

-- Service-role only (the API route reads/writes with the service key, which
-- bypasses RLS). No anon access.
alter table interchange_cache enable row level security;

-- Confidence-ranked source so we can tell AI-seeded rows from yard-confirmed ones.
alter table interchange add column if not exists confidence text;
