# Ahlam

**Photo → AI part ID → listing, for small auto salvage yards and parts shops.**

Small shops (1–5 employees) waste hours manually photographing, identifying, and re-listing
parts across Car-Part.com, OfferUp, Facebook Marketplace, and spreadsheets. The real
bottleneck isn't listing speed — it's the *expertise* to identify a part correctly. Ahlam
removes that bottleneck: an employee photographs a part, GPT-4o Vision identifies it
(type, make/model/year, condition grade) and pre-fills a listing, the employee reviews it in a
fast card UI, then exports it to whatever marketplace they sell on.

> ⚠️ AI can make mistakes. Every listing is reviewed by a human before it goes live, and
> low-confidence results are flagged for careful review.

## Monorepo layout

| Path | What it is | Stack |
|------|-----------|-------|
| [`web/`](web/) | Marketing site + waitlist signup | Next.js 15 (App Router), Tailwind |
| [`app/`](app/) | Mobile app for yard workers | Expo / React Native, Expo Router |
| [`packages/shared/`](packages/shared/) | Shared types, condition rubric, GPT-4o Vision prompt | TypeScript |
| [`supabase/`](supabase/) | Database schema + migrations | Postgres (Supabase) |
| [`docs/`](docs/) | Product spec, architecture notes | — |

## Quick start

```bash
# 1. Copy env templates and fill in your keys (see .env.example)
cp .env.example web/.env.local
cp .env.example app/.env

# 2. Web (landing + waitlist)
cd web && pnpm install && pnpm dev      # http://localhost:3000

# 3. App (mobile)
cd app && pnpm install && pnpm start    # Expo dev server

# 4. Database (local — no production access needed)
#    Requires Docker (OrbStack/Docker Desktop) + the Supabase CLI.
supabase start                          # local stack on ports 54341-54350
supabase db reset                       # applies supabase/migrations/*.sql + supabase/seed.sql
```

### Local database notes

- `supabase start` prints the local **API URL** and **anon key** — use those in
  `web/.env.local` as `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  Local Studio: http://localhost:54343
- `supabase/seed.sql` is **deliberately not in git** (it's a snapshot of real data,
  with credentials stripped). Ask Mohammad for the current file and drop it into
  `supabase/` before `supabase db reset`. Without it you still get the full
  schema, just empty tables.
- The production database and Vercel are owner-only. All development happens
  against the local stack; ship changes as a PR — merging to `main` requires
  Mohammad's approval (enforced by branch protection).

## API keys / services required

See [`.env.example`](.env.example) for the full list. Summary:

- **OpenAI API key** — GPT-4o Vision (part ID + condition grading)
- **Supabase** — Postgres DB, Auth (email + Google), photo storage
- **Resend** (or Postmark) — waitlist confirmation + internal error alerts
- **NHTSA vPIC** — free VIN decode (no key needed)
- OfferUp / Facebook — **copy-paste / file export only** (no public listing API)

## Status

v1 scope: photo → GPT-4o Vision → review card → copy/export listing. Single account per shop
(email + Google sign-in). Marketplaces are copy-paste; no automated posting in v1.

See [`docs/SPEC.md`](docs/SPEC.md) for the full product spec.
