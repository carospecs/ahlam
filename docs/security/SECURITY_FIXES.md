# Security hardening — 2026-07-02

Branch: `fix/security-hardening`. All code changes are committed but **not pushed**
and **not deployed**. One change (the RLS migration) requires a production
database step that a human must run — see "Production step" below.

## Summary of what changed

| # | Issue | Severity | Fix | Needs prod action |
|---|-------|----------|-----|-------------------|
| 1 | `shop_integrations` had **no RLS** — every shop's eBay access/refresh tokens were readable over the public REST API with the anon key | Critical | `supabase/migrations/0036_integrations_rls.sql` enables RLS deny-by-default (service-role only) | **Yes — apply migration** |
| 2 | eBay OAuth callback never validated the `state` param → CSRF: an attacker could bind their eBay account to a victim's shop | High | `connect` sets a random state in an HttpOnly cookie; `callback` rejects any mismatch | No |
| 3 | `admin@gmail.com` was a hardcoded admin fallback (externally registerable), active because `ADMIN_EMAILS` was unset | High | `web/src/lib/admin.ts` — fail-closed allowlist, no fallback; empty env ⇒ nobody is admin | **Set `ADMIN_EMAILS` env** |
| 4 | Committed admin password (`Admin@gmail.com` / `Admin123!`) in `scripts/seed-db.mjs` | High | Reads `SEED_PASSWORD` from env; demo accounts moved to reserved `example.com` | No (rotate if seeded) |
| 5 | `/api/confirm-user` let any signed-in user confirm their own email (verification bypass) | Medium | Admin-gated via shared `requireAdmin()`; also fixed unpaginated user lookup | No |
| 6 | Sign-in had no rate limit (sign-up did, but in-memory only) | Medium | Shared `web/src/lib/rate-limit.ts` (Upstash-optional) applied to sign-in and sign-up | Optional: set Upstash env |
| 7 | Destructive `scripts/cleanup-db.mjs` kept a stale hardcoded `admin@gmail.com` keep-list | Low | Reads keep-list from `ADMIN_EMAILS`; refuses to run if empty (fail-safe) | No |

Bonus (not security, requested): HEIC→JPEG conversion wired into the three photo
upload paths that were storing raw iPhone HEIC mislabeled as JPEG (part editor,
export sheet, shop logo). The existing `web/src/lib/image.ts` converter is now
used everywhere photos enter.

## Note vs. the original audit email

- The email said two fixes were "already staged in the working tree" — they were
  not; nothing was staged and no `docs/security/SECURITY_AUDIT.md` existed here.
  These fixes were written fresh.
- The migration is **`0036`**, not `0034` — `0034_message_thread_dedup.sql`
  already exists in this repo, so `0034` would have collided.
- The migration uses **deny-by-default (RLS on, zero policies)** rather than the
  four member-scoped policies the email proposed. Reason: no browser/mobile client
  ever reads this table (verified — all access is server-side via the service-role
  client, which bypasses RLS), so granting member-scoped read would needlessly
  expose plaintext tokens to any shop member via the anon key. Deny-by-default
  matches the house pattern for server-only tables (`usage_events`,
  `interchange_cache`). Verification therefore expects **0 policies**, not 4.

## Production step — DONE (2026-07-02)

The RLS fix has been **applied to production and verified**. It was applied
surgically via the Supabase Management API (a single idempotent statement) rather
than `supabase db push`, to avoid touching any other migration state:

```sql
alter table shop_integrations enable row level security;
```

Before → after (measured against the live project `wlwhvimdbthoaravnsmq`):

| Check | Before | After |
|-------|--------|-------|
| `pg_class.relrowsecurity` | `false` | `true` |
| policy count | 0 | 0 (deny-by-default) |
| anon key can read rows | **YES — 2 rows** | **0 rows** |
| service-role can read rows | 2 rows | 2 rows (server unaffected) |

Note on migration history: because it was applied via the Management API, the
`supabase_migrations` history table has no `0036` row yet. The migration file is
committed to the repo; a later `supabase db push` will re-run it, which is a
harmless no-op (`enable row level security` on an already-enabled table does not
error). Nothing else to do here.

Re-verify any time:

```sql
select relname, relrowsecurity from pg_class where relname = 'shop_integrations';  -- expect t
select policyname, cmd from pg_policies where tablename = 'shop_integrations';      -- expect 0 rows
```

Rollback if ever needed: `alter table shop_integrations disable row level security;`

## Live risk found: seeded admin accounts with a public password

`admin@gmail.com` and `admin1@gmail.com` **exist and are confirmed in the live
project**, and the seed password (`Admin123!`) is committed in the **public**
`carospecs/ahlam` git history. Because the currently-deployed app still uses the
old hardcoded admin fallback (which trusts `admin@gmail.com`) until this branch
ships with `ADMIN_EMAILS` set, this is an externally-exploitable admin login.

Action needed (your call — see the two options below):
- **Rotate** both accounts' passwords (reversible; closes the login immediately), or
- **Delete** both seeded accounts (removes the demo data they own).

Either way, also: deploy this branch and set `ADMIN_EMAILS` in Vercel so the
allowlist no longer trusts `admin@gmail.com` at all; and consider that the
password is in public git history (a history rewrite/secret purge is optional
since it's a test credential being neutralized).

## Environment to set (all environments, incl. Vercel prod/preview)

- `ADMIN_EMAILS` — comma-separated admin emails. **Required** now that the
  fallback is gone; if unset, the waitlist admin view and confirm-user return 403
  for everyone. Already added to local `web/.env.local` and `.env`. Set the same
  in Vercel: `mohammadabbas@ahlam.io,andygarcia@ahlam.io`.
- `SEED_PASSWORD` — only if you run `scripts/seed-db.mjs`.
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — optional. Without them,
  rate limiting is in-memory (per serverless instance, resets on cold start). With
  them, it's durable and shared across instances (addresses the "won't hold at
  scale" hardening item). A Vercel Firewall rate rule on `/api/auth/*` is an
  equivalent alternative.

## If any test admin accounts were seeded to prod

The old seed used `Admin@gmail.com` / `Admin1@gmail.com` with a committed
password. If those were ever created in the live project, delete them (or rotate
the password) in the Supabase Auth dashboard — the committed password is now in
git history.
