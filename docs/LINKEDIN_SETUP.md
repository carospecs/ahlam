# Ahlam LinkedIn Publisher Setup

This setup connects only the Ahlam, Inc. LinkedIn company Page. Client social passwords do not belong in Ahlam.

## 1. LinkedIn developer app

1. Open the `Ahlam Social Publisher` app in LinkedIn Developer Portal.
2. Keep it associated with `Ahlam, Inc.` (organization ID `132924071`).
3. Request the Community Management API product and complete LinkedIn's business verification and review.
4. In **Auth**, add `https://ahlam.io/api/linkedin/callback` as an authorized redirect URL.
5. Confirm the approved scopes include the organization post-write and administration permissions required by LinkedIn's current Posts API.

LinkedIn controls approval and can change required scopes or API versions. Do not put the client secret in a screenshot, ticket, chat, or Git commit.

## 2. Database migration

Apply `supabase/migrations/20260910000000_linkedin_publisher.sql` to the production Ahlam Supabase project before deployment. The migration creates the server-only encrypted integration store and adds publishing receipts to the marketing queue.

## 3. Vercel secrets

Add the variables documented in `.env.example` to Production. The client secret and encryption key are server-only. Keep `LINKEDIN_AUTO_PUBLISH_ENABLED=false` during setup.

## 4. Deploy and connect

1. Deploy the tested build.
2. Sign in to Ahlam with a founder account.
3. Open `/adminhost/marketing` and select **Connect Ahlam LinkedIn**.
4. Review LinkedIn's OAuth consent screen and authorize the Ahlam company Page.
5. Confirm the dashboard shows `Connected. Auto-publishing is paused.`

## 5. Safe launch

1. Trigger one daily worker run with a valid Vercel cron authorization and confirm it creates exactly one ready LinkedIn draft.
2. Review the selected shop, item, photo, price, public storefront link, and generated copy.
3. Publish that one draft manually and verify the saved LinkedIn URL.
4. Only after a founder approves unattended public posting, set `LINKEDIN_AUTO_PUBLISH_ENABLED=true` in Production and redeploy.

The two UTC cron entries cover Pacific daylight-saving changes. The application checks Pacific local time and one unique daily slot, so exactly one of the two calls can create the day's post.

## 6. Ongoing maintenance

- Watch `/adminhost/marketing` for `Needs attention` or `Reconnect required`.
- Reauthorize when LinkedIn expires or revokes the connection.
- Review `LINKEDIN_API_VERSION` before LinkedIn sunsets the configured monthly version.
- Keep the client opt-in list and public-photo permissions current.
- Never retry a draft marked `Publishing locked`; check the company Page first to avoid a duplicate.
