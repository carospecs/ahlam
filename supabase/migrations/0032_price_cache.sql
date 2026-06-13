-- Cache for grounded (Gemini web-search) sold-price lookups. The same
-- year+make+model+part query isn't paid for repeatedly, and repeat scans get a
-- stable number instead of the LLM's run-to-run variance. Written/read only by
-- the server (service role), so RLS is enabled with no policies (deny-by-default).
create table if not exists price_cache (
  query      text primary key,           -- normalized lower-case lookup key
  price      numeric(10,2) not null,
  source     text not null default 'grounded',
  created_at timestamptz not null default now()
);

alter table price_cache enable row level security;
