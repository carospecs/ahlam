# Ahlam Security Audit

Author: Knox (Application Security)
Date: 2026-06-30
Scope: `web/` (Next.js API routes + middleware), `supabase/` (schema + RLS), `extension/` (Chrome MV3), Stripe payments/escrow, secrets hygiene, dependencies.
Method: Static read of the real code. No exploits were run against any live or third-party system. Findings about live database state (actual RLS toggles in the running Supabase project, production env vars) are flagged as unverifiable from source and listed at the end.

---

## 1. Executive summary

The codebase is in good shape for a pre-launch app and noticeably better than typical at this stage. Authorization is taken seriously: nearly every data route resolves the caller's shop from their authenticated session and scopes every query with `.eq("shop_id", shopId)` or an explicit membership check, and the Postgres layer has real, member-scoped Row Level Security on essentially every user-data table (the service-role key is used server-side as defense in depth, not as a substitute for policies). The Stripe integration is the strongest part: prices are snapshotted server-side, the webhook signature is verified with a timing-safe HMAC and a replay window, and the escrow release checks buyer/seller ownership before moving money. No secrets are hardcoded or committed, and no server-only key carries a `NEXT_PUBLIC_` prefix.

The single most important thing to fix before launch: **Row Level Security is not enabled on the `shop_integrations` table, which stores every shop's eBay OAuth `access_token` and `refresh_token` in plaintext.** Every other sensitive table is locked; this one was missed. If the database follows Supabase defaults (anon/authenticated roles hold table-level grants and rely on RLS to constrain rows), any logged-in user could read every shop's eBay tokens directly through the public PostgREST endpoint with the anon key. That is a cross-tenant credential theft. It is a one-line migration to fix.

Beyond that, the real list is short: a self-serve email-confirmation route that defeats email verification, a weak hardcoded admin-email default, and no rate limiting on sign-in. Everything else is hardening-before-scale.

---

## 2. Ranked findings

| # | Sev | Title | Location | Exploit scenario | Fix |
|---|-----|-------|----------|------------------|-----|
| 1 | **Critical** | eBay OAuth tokens table has no RLS | `supabase/migrations/0016_integrations.sql` (table `shop_integrations`, no `enable row level security` anywhere) | If the running DB uses Supabase defaults, the anon/authenticated roles can `select * from shop_integrations` through PostgREST with the public anon key, returning every shop's eBay `access_token` + `refresh_token` in plaintext. An attacker with any account (or just the anon key, which ships to the browser) takes over sellers' eBay accounts. | Add `alter table shop_integrations enable row level security;` plus member-scoped policies (`using (is_shop_member(shop_id))`), matching the pattern already used on `interchange_cache`/`price_cache`/`usage_events`. Server routes use the service role, so they keep working. Draft below. |
| 2 | **High** | Self-serve email confirmation bypasses verification | `web/src/app/api/confirm-user/route.ts:40` | Any authenticated user can POST their own email and the route calls `admin.updateUserById(... email_confirm: true)`, flipping their account to "verified" without ever proving they own the inbox. This defeats the entire purpose of email confirmation: a user who signed up with `someone-elses@email.com` (or a typo'd/squatted address) becomes "confirmed" anyway, and any downstream trust placed on `email_confirmed_at` is meaningless. | Remove this route, or gate confirmation behind the Supabase email OTP/magic-link flow so confirmation requires a token delivered to the address. Do not let the client self-assert confirmation. **FIXED 2026-06-30:** route now requires an `ADMIN_EMAILS`-allowlisted session (same `requireAdmin` gate as `/api/waitlist`); self-confirmation is rejected with 403. No in-repo caller existed, so no legitimate flow broke. |
| 3 | **Medium** | Weak default admin allowlist for waitlist export | `web/src/app/api/waitlist/route.ts:11` | The allowlist falls back to `admin@gmail.com,mohammadabbas@ahlam.io,andygarcia@ahlam.io` when `ADMIN_EMAILS` is unset. `admin@gmail.com` is an externally registerable Gmail address; if a real `admin@gmail.com` exists and that person ever gets an Ahlam session, they can GET the full waitlist (emails, shop names, locations) and CSV-export it. Also, any `@ahlam.io` listed here is fine, but the gmail default is a footgun. | Remove `admin@gmail.com` from the default. Require `ADMIN_EMAILS` to be set explicitly in production and fail closed (empty allowlist) if it is missing, rather than shipping a guessable default. |
| 4 | **Medium** | No rate limiting on password sign-in | `web/src/app/api/auth/signin/route.ts` | The route calls `signInWithPassword` with no throttle. Sign-up has an in-memory limiter (`signup/route.ts:38`) but sign-in has none, so the endpoint is open to credential-stuffing / password brute force at HTTP speed. Supabase Auth has some upstream protection, but the app should not rely on that alone. | Add the same per-IP/per-email in-memory (or Upstash/Vercel KV for multi-instance) limiter used in signup, and/or enable Supabase Auth rate limits + a CAPTCHA. See finding 4 note about middleware/edge rate limiting at scale. **FIXED 2026-06-30:** added the same in-memory per-email/per-IP 5s cooldown used by signup (returns 429). In-memory caveat still applies at multi-instance scale (see note in section 3). |
| 5 | **Low** | Permissive CORS on `/api/identify` (`Allow-Origin: *`) | `web/src/app/api/identify/route.ts:307-312` | The identify route returns `Access-Control-Allow-Origin: *` to support the mobile app and extension. It does not allow credentials, and the route still independently requires a Supabase session cookie or a Bearer token, so a malicious site cannot ride a victim's cookie (cookies are not sent cross-origin without credentials mode). Impact is limited to letting any web origin call the endpoint with a token it already holds. | Acceptable for the cookie-less Bearer flow. If you want to tighten, reflect an allowlisted origin instead of `*`. Leave for post-launch. |
| 6 | **Low** | eBay OAuth callback ignores the CSRF `state` | `web/src/app/api/ebay/callback/route.ts` (state generated in `connect/route.ts:17` but never checked) | `connect` builds a `state` but `callback` derives the shop from the authenticated session and never validates `state`. Because the shop binding is server-derived (not taken from `state`), an attacker cannot graft their eBay account onto a victim's shop. The residual risk is standard OAuth login-CSRF (forcing a victim to complete a connect they did not initiate), which is low here. | Validate `state` in the callback (decode, check the embedded `user.id` matches the session and the timestamp is fresh). Cheap hardening; not urgent. |
| 7 | **Low** | Cross-tenant aggregate leak in demand-alerts | `web/src/app/api/demand-alerts/route.ts` | Returns part-name search counts aggregated across ALL shops' `activity_log` to any caller (no auth, service role). It exposes no PII or per-shop attribution, only popularity of part names, which is arguably a marketplace feature. | Add auth if you do not want this public. Otherwise document it as intentional. |
| 8 | **Low** | Vulnerable transitive deps (mostly mobile toolchain) | `pnpm-lock.yaml` (pnpm audit: 14 high / 7 moderate / 2 low) | All 14 high and most moderate findings are under `app/` (Expo / React Native CLI build tooling: `js-yaml`, `undici` via `@expo/cli`), not reachable by the production web server. Two reach `web/`: `nodemailer` (<9.0.1, moderate) and `next > postcss` (build-time, <8.5.10). | Bump `nodemailer` to >=9.0.1 (web runtime sends mail, so this one matters most). Update Next/postcss on the next routine bump. The Expo-side highs are dev-only; patch when convenient. |

### Things explicitly checked and found OK (so you know they were looked at)

- **RLS coverage**: enabled with real, non-stub policies on `shops`, `shop_members`, `listings`, `vehicles`, `conversations`, `messages`, `activity_log`, `profiles`, `contact_messages`, `orders`, `reviews`, `verification_requests`, `shop_invites`, `interchange_cache`, `price_cache`, `usage_events`, `waitlist`. The `is_shop_member()` helper is a correct `security definer` membership check (`0001_init.sql:93`). Only `shop_integrations` was missed (finding 1).
- **Stripe webhook** (`web/src/app/api/payments/webhook/route.ts`, `lib/stripe.ts:87`): raw-body HMAC-SHA256 verification, `crypto.timingSafeEqual`, length check, and a 5-minute replay window. Refuses if the secret or signature is missing. Correct.
- **Escrow / price integrity** (`payments/checkout` + `payments/release`): amount is computed server-side from the DB listing/vehicle, never from the client. Release verifies the caller is the buyer (for `confirm`) or a shop owner/editor (for `ship`), and enforces order-status transitions. The "paid" flip is idempotent (`.eq("status","pending")`). A buyer cannot mark their own order paid; only the verified Stripe webhook can.
- **Ownership scoping** on listings, data, team, messages, shop, reviews: each mutation re-checks shop membership/role server-side via the service-role client; no client-supplied `shop_id` is trusted.
- **Secrets**: no hardcoded keys; `.env.example` contains placeholders only; `.gitignore` covers `.env`/`.env.*`; no `.env` is tracked or in history; `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, Gemini/Anthropic keys are server-only (no `NEXT_PUBLIC_`).
- **Prompt-injection / SSRF in the AI pipeline** (`api/identify`, `lib/gemini.ts`): the image is sent to Gemini as inline base64 `inline_data`; the server never fetches a user-supplied URL, so no SSRF. The model's JSON output is parsed and every field is re-validated/clamped server-side (sides, grades, diameters, prices); the model cannot set the final price directly. Route requires auth and enforces a per-shop scan quota, blocking anonymous credit-burning.
- **File upload** (`shop/logo`, `listings`): logo upload enforces 4 MB max and a PNG/JPEG/WebP allowlist; part photos are decoded from base64 and stored under a `${shopId}/...` path (no traversal from user input). Storage uses the service role behind a server route, not direct client writes.
- **Chrome extension** (`extension/manifest.json`, `content-ahlam.js`): MV3, no `<all_urls>`; host permissions are scoped to ahlam.io, Supabase, and the three target marketplaces. The page-to-extension bridge runs only on ahlam.io/localhost, checks `event.source === window`, and only stages user-reviewed listing content into the side panel. No path lets an arbitrary page reach privileged extension APIs, and nothing auto-posts.
- **PostgREST filter interpolation** in `profile/[id]/route.ts:17` (`.or("seller_id.eq.${id},created_by.eq.${id}")`): `id` is a route param. The result is constrained to public, active listings and an existing public profile; a crafted `id` can at most broaden the `.or()` within already-public data. Low concern, but validating `id` as a UUID before the query is good hygiene (see hardening list).

---

## 3. Fix before launch vs. harden before scale

### Before launch (do these now)
1. **Finding 1 - enable RLS on `shop_integrations`.** This is the one that can actually breach the company. One migration.
2. **Finding 2 - remove/repair `confirm-user`** so email confirmation can't be self-asserted. ✅ Done 2026-06-30 (now admin-allowlist gated).
3. **Finding 3 - drop the `admin@gmail.com` default** and require `ADMIN_EMAILS` in production (fail closed).
4. **Finding 4 - add rate limiting to sign-in.** ✅ Done 2026-06-30 (mirrors signup cooldown).
5. **Bump `nodemailer` to >=9.0.1** (the only high-traffic web-runtime dep with an advisory).

### Harden before scale
- Validate `state` on the eBay OAuth callback (finding 6) and UUID-validate route params like `profile/[id]`.
- Move rate limiting off in-memory maps onto a shared store (Upstash / Vercel KV) once you run more than one serverless instance; in-memory counters reset per cold start and don't coordinate across instances. Consider a WAF rate-limit rule (Vercel Firewall) in front of `/api/identify` and `/api/auth/*` to cap AI spend and brute force.
- Add security response headers (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`). None are set today. Start CSP in report-only.
- Tighten the wildcard CORS on `/api/identify` to an allowlist (finding 5).
- Consider encrypting OAuth refresh tokens at rest (column encryption or a KMS) even with RLS on, so a future SQL-injection or backup leak doesn't hand over live eBay sessions.
- Routine dependency bump for the Expo/React Native toolchain advisories (dev-only, low urgency).

---

## 4. What I could NOT verify from source (founders should confirm directly)

1. **Whether RLS is actually ON in the live Supabase project.** Migrations declare it, but a migration can fail to apply, be skipped, or be toggled off in the dashboard. In the Supabase dashboard, open Database -> Tables and confirm every user-data table shows "RLS enabled", and specifically that `shop_integrations` is enabled after the fix. Also confirm the `anon` and `authenticated` roles do not hold table grants that bypass intent on any table you expect to be private.
2. **Production environment variables.** I cannot see prod env. Confirm: `ADMIN_EMAILS` is set (after finding 3), `STRIPE_WEBHOOK_SECRET` is the live endpoint's secret, no server key is duplicated under a `NEXT_PUBLIC_`/`EXPO_PUBLIC_` name in the Vercel/Expo dashboards, and the Supabase service-role key is set only on the server.
3. **Whether the anon key has been treated as secret.** It is published to the browser by design, but confirm it is the anon key and not the service-role key anywhere in client config (it is correct in source).
4. **Stripe Connect transfer safety in production.** The escrow logic is correct in code; verify in the Stripe dashboard that funds genuinely hold on the platform balance and that the connected-account transfer on release behaves as expected with a real test order.
5. **The contact RPCs (`contact_seller`, `contact_shop`) are `security definer`.** Confirm their bodies (not fully shown in this pass) constrain inserts to the calling `auth.uid()` and the correct shop, since `security definer` functions run with elevated rights.

---

## Appendix: proposed migration for finding 1 (draft, not applied)

Create `supabase/migrations/0034_shop_integrations_rls.sql`:

```sql
-- Lock the eBay OAuth token table to its own shop's members. Server routes use
-- the service role and are unaffected; this only constrains the anon/authenticated
-- (PostgREST) path that ships with the public anon key.
alter table shop_integrations enable row level security;

create policy "members read own integrations" on shop_integrations
  for select using (is_shop_member(shop_id));

create policy "members write own integrations" on shop_integrations
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));
```

Note: I have NOT applied this or any other change to source. All findings above are from reading the code only.
