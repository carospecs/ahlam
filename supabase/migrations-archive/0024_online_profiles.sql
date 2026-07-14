-- Online presence for profiles + public profile pages.
alter table profiles add column if not exists is_online  boolean not null default false;
alter table profiles add column if not exists last_seen  timestamptz;

-- Allow anyone to see a user's active listings (used by public profile pages).
alter table profiles enable row level security;
drop policy if exists "profiles read public" on profiles;
create policy "profiles read public"
  on profiles for select using (true);
