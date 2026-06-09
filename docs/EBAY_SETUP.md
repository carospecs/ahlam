# Connecting eBay — step by step (and what it costs)

> **🔑 Production env keys (ahlam.io)** — set these in `.env.local` (local) and
> Vercel → Settings → Environment Variables (production). **Never commit the real
> values** — this repo is public. Use the actual secrets from your eBay developer
> account; placeholders shown here:
> ```
> EBAY_ENV=production
> EBAY_CLIENT_ID=<your-app-id>
> EBAY_CLIENT_SECRET=<your-cert-id>     # keep secret — rotate if ever exposed
> EBAY_REDIRECT_URI=<your-runame>
> NEXT_PUBLIC_SITE_URL=https://ahlam.io
> ```

This is the one-time setup that turns on the **Export → "List on eBay"** button.
Until these keys are in place, the app stays healthy and just shows
*"Not set up on the server yet."* Nothing else breaks.

There are two halves:

- **A. App credentials** — *you* (the app owner) do this once. Result: 3 secret
  keys that go in the server env. This is what "get an eBay API key" means.
- **B. Per-seller connect** — each shop owner clicks **Connect eBay** in the app
  and signs in with their own eBay account. No keys for them; it's just OAuth.

---

## TL;DR cost

| Thing | Cost |
| --- | --- |
| eBay developer account | **Free** |
| API keys (sandbox + production) | **Free** |
| Making API calls | **Free** (5,000 calls/day to start; request more free) |
| **Actually selling a part** | eBay's normal seller fees — see below |

You pay eBay **nothing** to build or run the integration. The only money that
ever changes hands is eBay's standard selling fees, and only when a part sells:

- **Insertion fee:** most sellers get **250 free listings/month**, then ~$0.35 each.
- **Final value fee (Parts & Accessories):** roughly **13.6% of the total sale
  (item + shipping) up to ~$7,500, then ~2.35% above that, + ~$0.40 per order.**
- These are charged to the **seller's** eBay account, not to you or the app.

(eBay tweaks fee percentages periodically — treat the numbers above as "about
right," and the live schedule is at
<https://www.ebay.com/sellercenter/selling/seller-fees>.)

---

## A. Get your app credentials (one time, ~15 min)

1. **Join the eBay Developers Program** — go to
   <https://developer.ebay.com>, click **Sign in / Join** and use a normal eBay
   account (a seller account is ideal). It's free.

2. **Create an application keyset.** In the developer portal open
   **Application Keys** (under your account/Hi, *name* menu). You'll see two
   environments:
   - **Sandbox** — fake money, fake listings. Use this first.
   - **Production** — real listings. Switch to this when you're ready.

   Click **Create a keyset** for the environment you want. Each keyset gives you:
   - **App ID (Client ID)** → `EBAY_CLIENT_ID`
   - **Cert ID (Client Secret)** → `EBAY_CLIENT_SECRET`
   - Dev ID (not needed by this app)

3. **Create the OAuth redirect (the "RuName").** Still in the keyset, find
   **User Tokens** → **Get a Token from eBay via Your Application** →
   **Add eBay Redirect URL**. Fill in:
   - **Your auth accepted URL:** `https://YOUR-DOMAIN/api/ebay/callback`
     (for local testing: `http://localhost:3217/api/ebay/callback`)
   - **Your auth declined URL:** `https://YOUR-DOMAIN/api/ebay/callback?ebay=error`
   - Privacy policy URL: any reachable URL is fine to start.

   eBay then shows a **RuName** (looks like `Your_Name-AppName-PRD-abc123-de45f6`).
   That RuName — **not the URL** — is what goes in `EBAY_REDIRECT_URI`.

4. **Put the three values in your server env** (Vercel → Project → Settings →
   Environment Variables, or `.env` locally):

   ```
   EBAY_ENV=sandbox            # flip to "production" with prod keys later
   EBAY_CLIENT_ID=<App ID>
   EBAY_CLIENT_SECRET=<Cert ID>
   EBAY_REDIRECT_URI=<RuName>
   NEXT_PUBLIC_SITE_URL=https://YOUR-DOMAIN   # used to build the connect link
   ```

   Redeploy. The Export page now shows **"Connect eBay."**

> **Sandbox vs production:** keys are environment-specific. Sandbox keys only
> work against `*.sandbox.ebay.com`; production keys against real eBay. The app
> switches hosts automatically from `EBAY_ENV`. Production keysets are granted
> instantly for most accounts; some require a quick application/business review
> (still free).

---

## B. What each shop owner does

Once A is live, every shop owner just:

1. Opens **Export** in the dashboard.
2. Clicks **Connect eBay**, signs into *their own* eBay seller account, approves.
3. Done — they can now hit **List on eBay** on any listing.

Their tokens are stored per-shop in the `shop_integrations` table and refreshed
automatically. They never see an API key.

---

## C. Required before a listing will actually publish

eBay's modern (Inventory) API won't publish a fixed-price listing unless the
seller account has **business policies** and a **location** set up. You set these
**once**, then paste the IDs into env:

```
EBAY_LOCATION_KEY=          # a merchant location key
EBAY_FULFILLMENT_POLICY_ID= # shipping policy
EBAY_PAYMENT_POLICY_ID=     # payment policy
EBAY_RETURN_POLICY_ID=      # returns policy
EBAY_CATEGORY_ID=6028       # default: "Other Car & Truck Parts" (fine to leave)
```

How to get them:

1. **Turn on Business Policies** for the seller account:
   <https://www.bizpolicy.ebay.com/businesspolicy/manage> → opt in. Then create
   one each of a payment, shipping (fulfillment), and return policy.
2. **Get the policy IDs** either from Seller Hub or via the Account API:
   - `GET /sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US`
   - `GET /sell/account/v1/payment_policy?marketplace_id=EBAY_US`
   - `GET /sell/account/v1/return_policy?marketplace_id=EBAY_US`
3. **Create a merchant location** (warehouse/shop address) and pick a key:
   - `POST /sell/inventory/v1/location/{merchantLocationKey}` — the
     `{merchantLocationKey}` you choose is your `EBAY_LOCATION_KEY`.

(You can run those calls from the eBay API Explorer in the developer portal — no
code needed.)

> Without these, **Connect** still works and the button appears, but publishing a
> listing returns an eBay error naming the missing policy/location. That's
> expected — add the IDs and it goes through.

---

## D. Database migration

The integration stores tokens and the resulting eBay listing URL. Apply once in
Supabase (SQL editor):

- `supabase/migrations/0016_integrations.sql` — `shop_integrations` table +
  `listings.ebay_listing_id` / `listings.ebay_url`.

(And `0015_vehicle_title.sql` if not already applied — unrelated to eBay, adds the
editable car title.)

---

## Quick test path

1. Set `EBAY_ENV=sandbox` + sandbox keys + RuName → redeploy.
2. Apply migration 0016.
3. Create a **sandbox** seller test user in the developer portal, give it
   business policies + a location, fill in the policy/location env IDs.
4. In the app: **Connect eBay** → sign in as the sandbox user → **List on eBay**
   on a draft. You should land on a `sandbox.ebay.com/itm/...` listing.
5. When happy, create a **production** keyset, swap the 3 keys, set
   `EBAY_ENV=production`, redeploy.

---

## Troubleshooting

- **"Not set up on the server yet"** → one of `EBAY_CLIENT_ID` /
  `EBAY_CLIENT_SECRET` / `EBAY_REDIRECT_URI` is missing; redeploy after adding.
- **Connect bounces back with an error** → the RuName's accepted URL doesn't
  exactly match `https://YOUR-DOMAIN/api/ebay/callback`, or you used the URL
  instead of the RuName in `EBAY_REDIRECT_URI`.
- **List fails with a policy/location message** → finish section C.
- **Works in sandbox, not production** → you're still on sandbox keys; production
  needs its own keyset and `EBAY_ENV=production`.
