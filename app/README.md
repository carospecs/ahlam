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

1. `app/sign-in.tsx` — email sign-up (with verification) + Google OAuth.
2. `app/onboarding.tsx` — first login creates a shop via the `create_shop` RPC
   (adds the user as `owner`). Route gating lives in `app/_layout.tsx`.
3. `app/index.tsx` — take a photo or upload one; shows shop name, My Listings,
   sign out.
4. `app/review.tsx` — calls `/api/identify`, shows loading / error / review.
   - Error state (API down / no credits) shows the calm "high demand, try again"
     message and a "Save & finish later" option that queues the photo offline.
5. `src/components/ReviewCard.tsx` — editable, tappable fields; low-confidence
   results highlighted amber; condition grade picker with the rubric.
6. On confirm → uploads the photo to the `part-photos` bucket and inserts a
   `listings` row storing the raw AI output **and** the human-corrected values
   (the training pair). Routes to the listing detail.
7. `app/listing/[id].tsx` — marketplace export: copy the formatted listing text
   (Facebook), share sheet (OfferUp / other apps), mark as sold.
8. `app/listings.tsx` — My Listings.

Auth, shop onboarding, listing save, and export are all wired and the backend
contract is verified (RPC + RLS + storage) against live Supabase.

## Not yet wired (next steps)

- Background processing of the offline queue (`src/lib/queue.ts`) when
  connectivity returns.
- VIN-plate capture → NHTSA decode → prefilled fitment.
- Team member invites (the `editor`/`viewer` roles exist in the schema).
- eBay API publish (Facebook + OfferUp stay copy/paste).

## Configuring Google sign-in

Google OAuth needs the provider enabled in **Supabase → Auth → Providers →
Google** (client ID + secret). The app uses PKCE via the system browser; no
Google keys live in the app.
