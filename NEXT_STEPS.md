# Ahlam — Next Steps

State as of 2026-06-03. Everything below is built, typechecked, and pushed.

## ✅ Working & verified
- **Web**: Next.js landing + waitlist + `/api/identify` backend. Builds clean, QA'd in browser.
- **App**: Expo (iOS/Android + **web** via react-native-web). Auth (email + Google), shop onboarding, photo capture, AI review card, listing save, marketplace export. Typechecks clean. Web dashboard renders and the auth gate works.
- **Supabase**: tables + RLS + `create_shop` RPC + `part-photos` bucket. Backend contract verified end-to-end (signup → RPC → storage → RLS insert/read).
- **Waitlist API**: live insert verified.

## ⛔ Blockers (action required by you)
1. **OpenAI has no credits** — key is valid but returns `insufficient_quota` (HTTP 429). Add billing at https://platform.openai.com/account/billing. Until then, AI part ID shows the calm "high demand, try again" message. This is the ONLY thing stopping the full photo→listing flow.
2. **Google sign-in** — enable provider in Supabase → Auth → Providers → Google. Email auth works now without it.

## 🚀 Deploy (Vercel, from GitHub)
```bash
npm i -g vercel && vercel login
cd ~/ahlam
vercel link            # "In which directory is your code located?" → web
bash scripts/vercel-env-push.sh
vercel git connect
vercel --prod
```
Vercel "teams" ≠ GitHub orgs — deploy under your personal account is fine. After deploy, set `app/.env` → `EXPO_PUBLIC_API_BASE_URL=https://<your-deploy>.vercel.app`.

## 🔜 Remaining build work
- **CORS on `/api/identify`** — needed for the Expo **web** dashboard to call it cross-origin (native apps don't need it). Add `Access-Control-Allow-Origin` + an `OPTIONS` handler.
- Background processing of the offline capture queue (`app/src/lib/queue.ts`).
- VIN-plate capture → NHTSA decode → prefilled fitment.
- Team member invites (`editor`/`viewer` roles already in schema).
- eBay API publish (FB + OfferUp stay copy-paste).

## Run locally
```bash
# web (landing + API)
cd web && pnpm install && pnpm dev          # :3000

# app (mobile or web dashboard)
cd app && pnpm install && npx expo start    # press w for web, i/a for device
```
