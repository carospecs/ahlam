# CaroSpecs app

Expo / React Native app for yard workers. Photo → GPT-4o Vision → review card →
listing.

## Run

```bash
cp ../.env.example .env   # fill EXPO_PUBLIC_* + EXPO_PUBLIC_API_BASE_URL
pnpm install
pnpm start                # press i (iOS), a (Android), or w (web)
```

`EXPO_PUBLIC_API_BASE_URL` must point at the deployed `web/` app (or your
machine's LAN IP + `:3000` in dev) — that's where `/api/identify` runs and where
the OpenAI key lives. The app never holds the OpenAI key.

## Flow (v1)

1. `app/index.tsx` — take a photo or upload one.
2. `app/review.tsx` — calls `/api/identify`, shows loading / error / review.
   - Error state (API down / no credits) shows the calm "high demand, try again"
     message and a "Save & finish later" option that queues the photo offline.
3. `src/components/ReviewCard.tsx` — editable, tappable fields; low-confidence
   results highlighted amber; condition grade picker with the rubric.
4. On confirm → listing summary (next: persist to Supabase + marketplace export).

## Not yet wired (next steps)

- Supabase auth screens (email verification + Google) — client is in
  `src/lib/supabase.ts`.
- Persisting the prediction+correction pair to the `listings` table.
- Background processing of the offline queue (`src/lib/queue.ts`).
- Marketplace copy/export (Facebook + OfferUp copy-paste; eBay later).
