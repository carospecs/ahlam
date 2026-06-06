# Deployment

Ahlam is hosted on **Vercel** and deployed straight from this repo (`carospecs/ahlam`).

## How it deploys

- **Production:** every push to `main` auto-builds and deploys to the live site.
- **Previews:** every pull request gets its own isolated **preview deployment**, and Vercel posts the preview URL as a comment on the PR.

## Project settings (Vercel → project `web`)

| Setting | Value |
| --- | --- |
| Connected repo | `carospecs/ahlam` |
| Production branch | `main` |
| Root directory | `web` (the Next.js app) |
| Framework | Next.js |

## Required environment variables (Production)

| Key | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client (auth + data) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase (API routes) |
| `GEMINI_API_KEY` | Photo → part identification (Gemini Vision) |
| `GROQ_API_KEY` | AI assistant chat |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` | Billing (optional — enables live checkout) |

## Custom domain

The production site serves at `ahlam.io`. The domain is managed in the Vercel
team and points at the `web` project's production deployment.
