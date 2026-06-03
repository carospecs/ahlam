# CaroSpecs

**Photo → AI part ID → listing, for small auto salvage yards and parts shops.**

Small shops (1–5 employees) waste hours manually photographing, identifying, and re-listing
parts across Car-Part.com, OfferUp, Facebook Marketplace, and spreadsheets. The real
bottleneck isn't listing speed — it's the *expertise* to identify a part correctly. CaroSpecs
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

# 4. Database
#    Create a Supabase project, then run supabase/migrations/*.sql in the SQL editor.
```

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
