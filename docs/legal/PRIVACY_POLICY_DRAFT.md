# Ahlam Privacy Policy — DRAFT

> STATUS: INTERNAL DRAFT. NOT LEGAL ADVICE. NOT PUBLISHED.
> Prepared by Reg (Legal/Compliance lead, not a licensed attorney) on 2026-06-30.
> This file is a starting point grounded in Ahlam's actual code. A licensed
> privacy attorney MUST review and approve it before it replaces the live policy
> at `web/src/app/privacy/page.tsx`. Every `[ATTORNEY REVIEW: ...]` marker below
> flags a spot that needs a lawyer's sign-off.
>
> This draft is intentionally written in plain prose with no em dashes, to match
> the codebase copy rule.

---

## Why this draft exists (read before shipping)

The live policy at `web/src/app/privacy/page.tsx` is decent in tone but has two
factual problems and several gaps that a regulator or a plaintiff's lawyer could
use against us. This draft fixes them. The two factual problems:

1. **Wrong AI vendor named.** `.env.example` and the marketing copy reference
   OpenAI / GPT-4o Vision, but the code that actually runs photo identification is
   `web/src/app/api/identify/route.ts`, which calls **Google Gemini**
   (`web/src/lib/gemini.ts`, `generativelanguage.googleapis.com`). The live policy
   does not name any AI vendor at all, and the `.env.example` comment is stale. A
   privacy policy must accurately name the third parties that receive personal data.

2. **The "we never use your data for anything else" line is not currently true.**
   The live policy says: "We do not use your listing content or photos for anything
   outside of running Ahlam for you." But `supabase/migrations/0001_init.sql`
   stores `ai_output` and `corrected` on every listing and labels them, in the
   schema comment, as "training input" and "training label." If Ahlam ever uses
   that corrected data to train or improve models, the live sentence is a
   misrepresentation. We must either (a) stop saying it, (b) disclose the training
   use, or (c) confirm in writing that we do not and will not train on it.
   `[ATTORNEY REVIEW: confirm the intended use of stored ai_output/corrected and
   align this policy + the live one to the truth.]`

---

## Answer to the founders' question: do we have to disclose this on the website?

**Yes.** A publicly reachable, commercial website that collects personal data from
California residents is required to post a conspicuous privacy policy under the
**California Online Privacy Protection Act (CalOPPA)**. Unlike the broader CCPA,
CalOPPA has **no revenue or user-count threshold** — it applies the moment a
commercial site collects personally identifiable information from California users,
which Ahlam does on its very first waitlist signup (email). So this is not optional
even pre-launch. (CalOPPA overview:
https://termly.io/resources/articles/caloppa/ , accessed 2026-06-30.)

The bigger **CCPA/CPRA** regime (right to know, delete, correct, opt out of sale or
sharing, plus the "Do Not Sell or Share My Personal Information" link) only binds a
business once it crosses a threshold: roughly **$26.625M annual revenue**, or buys
/ sells / shares the personal information of **100,000+ California residents or
households**, or derives **50%+ of revenue from selling or sharing** personal data
(CA OAG: https://oag.ca.gov/privacy/ccpa , accessed 2026-06-30; threshold figure
via https://www.jacksonlewis.com/insights/navigating-california-consumer-privacy-act-30-essential-faqs-covered-businesses-including-clarifying-regulations-effective-1126
, accessed 2026-06-30). Ahlam is pre-launch and almost certainly under all three
today, so full CCPA machinery is **not yet legally required** — but the disclosure
discipline it asks for (categories collected, purposes, third parties, retention,
rights) is the right baseline to build now, because it is cheap to write into the
policy now and expensive to retrofit later, and because several other states impose
similar duties without the same thresholds.

Three more comprehensive state laws took effect **January 1, 2026** (Indiana,
Kentucky, Rhode Island), joining roughly twenty active US state privacy laws; all
grant access/delete/correct/port rights and require opt-in consent for sensitive
data (https://vaultjs.com/resources/us-privacy-laws-and-key-provisions-that-take-effect-or-become-enforceable-in-2026/
, accessed 2026-06-30). None of these have CalOPPA's zero threshold, but they
reinforce that "post an honest, complete policy" is the floor, not the ceiling.

On the two data types the founders specifically worried about:

- **VINs.** Whether a VIN is "personal information" is fact-specific under CCPA. A
  VIN tied to an identifiable person or household can be personal information; a
  bare VIN on a salvage hulk usually is not. Ahlam stores VINs on `listings.vin`
  and decodes them via the free NHTSA vPIC API. Treat VINs as potentially-personal
  and disclose them. (https://dataprivacy.foxrothschild.com/2020/06/articles/california-consumer-privacy-act/ccpa-regulations-vin-i-vidi-vici/
  , accessed 2026-06-30.)
- **Photos.** Photographs are **not** biometric information under CCPA *unless* they
  are used or stored for facial recognition. Ahlam's vision pipeline identifies
  *auto parts*, not faces, so the photos are ordinary personal information, not
  sensitive biometric data — *as long as we never run face recognition on them.*
  (https://www.recordinglaw.com/us-laws/data-privacy-laws/california-data-privacy-laws/biometric-privacy/
  , accessed 2026-06-30.) `[ATTORNEY REVIEW: confirm no current or planned facial
  recognition on uploaded photos; if that changes, this becomes sensitive data.]`

If Ahlam knowingly takes EU/UK traffic and signups, GDPR/UK GDPR add a lawful-basis
and data-subject-rights layer on top. `[ATTORNEY REVIEW: decide whether to accept
EU/UK users at launch; if yes, this policy needs a GDPR section and a lawful basis.]`

---

## Data inventory (built from the actual code)

This is what Ahlam collects today, where it lives, and who else receives it. Sources
are cited to the file that proves each item.

### Personal data collected and stored

| Data | Where it is collected | Where it is stored |
|------|----------------------|--------------------|
| Waitlist email, shop name, location, parts/day, source | `api/waitlist/route.ts` (public landing form) | Supabase `waitlist` table (`0001_init.sql`) |
| Account: name/display name, email, hashed password, avatar, phone, bio | Supabase Auth + `api/auth/*` | Supabase `auth.users` + `profiles` (`0004_auth_profiles.sql`) |
| Shop business details: name, location, business phone, business email | onboarding / `api/shop` | `shops` table (`0001_init.sql`) |
| Listing content: uploaded photos, VINs, part data, prices, descriptions, AI output, human corrections | `api/identify`, `api/listings` | `listings` table + Supabase Storage `part-photos` bucket (`0001_init.sql`) |
| Buyer/seller messages | `api/messages`, `api/marketplace/contact` | `conversations`, `messages`, `contact_messages` (`0004_auth_profiles.sql`) |
| Orders / payments: buyer email, shipping name, amounts, Stripe IDs | `api/payments/*` | `orders` table (`0026_payments.sql`) + Stripe |
| NMVTIS junk/salvage records: VIN, party obtained from (name + address), disposition | `api/compliance/nmvtis` | `vehicles` table (`0030_nmvtis.sql`) |
| Usage / device + security signals, online heartbeat | various API routes, `api/online/heartbeat` | Supabase |

Note the **NMVTIS "obtained_from_name / obtained_from_address"** fields collect the
personal name and address of a *third party* (the person the yard bought the car
from). That is personal data about someone who is not even an Ahlam user, collected
to satisfy a federal reporting duty. The policy must mention it.
`[ATTORNEY REVIEW: confirm how Ahlam transmits NMVTIS data and to which approved
NMVTIS data consolidator; that recipient must be named.]`

### Third parties that actually receive personal data (confirmed wired in)

| Recipient | What they get | Proof in code |
|-----------|---------------|---------------|
| **Supabase** (database, auth, storage) | essentially all personal data above | `.env.example`, `web/src/lib/supabase*.ts` |
| **Google Gemini** (vision: part ID + grading) | uploaded photos, and any VIN/text in them | `api/identify/route.ts`, `web/src/lib/gemini.ts` |
| **Google (Gemini grounded search)** | a VIN string, to look up trim | `vinTrimLookup()` in `api/identify/route.ts` |
| **NHTSA vPIC** (VIN decode) | VIN strings | `web/src/lib/vin.ts`, free/no-key per `.env.example` |
| **Stripe** (payments + escrow + Connect payouts) | buyer email, shipping name, amounts; seller payout/identity onboarding | `api/payments/*`, `.env.example` |
| **eBay Sell API** (optional "List on eBay") | listing content, seller location/ZIP, seller policies | `api/ebay/*` |
| **Google Workspace / Gmail SMTP** (transactional email) | recipient email addresses + message previews | `web/src/lib/mailer.ts`, `api/waitlist`, `api/messages` |
| **Anthropic Claude** | A/B part-ID test path | `.env.example` (`ANTHROPIC_API_KEY`) `[ATTORNEY REVIEW: confirm whether the Claude path is live in production; if photos are sent to Anthropic, disclose it like Gemini.]` |

`[ATTORNEY REVIEW: confirm OpenAI is NOT in the live path. The key exists in
.env.example but the identify route uses Gemini. If OpenAI is dormant, do not list
it; if it is used anywhere, disclose it.]`

---

## Ranked risk list (specific to what is in the repo)

### Do NOT do without a lawyer

1. **Reconcile the "we never use your data" claim with the training-data schema.**
   The live policy promises something the schema is built to do the opposite of
   (`ai_output`/`corrected` = "training input"/"training label"). This is the single
   most sue-able line on the site: a false statement about data use is exactly what
   the FTC and state AGs treat as a deceptive practice. Decide the real answer, then
   write it. Lawyer must approve the wording.
2. **Stripe escrow responsibility allocation.** Who is the merchant of record, who
   holds funds, who owes refunds, and how chargebacks flow are legal questions that
   belong in the Terms of Service / Seller Agreement, and the privacy policy must
   not contradict them. `orders` stores buyer email + shipping name; the escrow
   model (separate charges and transfers, platform holds funds) is described in
   `0026_payments.sql`. Get counsel on the liability allocation before launch.
3. **Restricted-parts disclaimer.** Not strictly a privacy issue, but the identify
   route already flags airbags, catalytic converters, and seat-belt restraints as
   restricted (`COMPLIANCE_RULES` in `api/identify/route.ts`). The platform terms
   must put the legal duty to comply on the seller and disclaim Ahlam's liability.
   Lawyer must draft that.

### Needs care (we can draft, lawyer reviews)

4. **Name the real subprocessors.** Add Gemini/Google, Stripe, eBay, NHTSA, Supabase,
   and Google Workspace email. The current policy names none specifically.
5. **NMVTIS third-party PII.** Disclose that the platform stores the name/address of
   the party a vehicle was obtained from, for federal reporting.
6. **Retention specifics.** The live policy says "while your account is active." CPRA
   wants per-category retention or the criteria used to set it. We can phrase this
   reasonably now.
7. **Children's data.** As of 2026, data of consumers under 16 is "sensitive" under
   CCPA. Ahlam is a B2B salvage tool not aimed at minors; add a "not directed to
   anyone under 16/18" statement. `[ATTORNEY REVIEW: pick the age line.]`
8. **International transfer note** if any non-US traffic is accepted.

### Clearly fine (already true, keep it)

9. The Chrome Auto-Poster description is accurate and defensible: it prefills the
   marketplace form, never auto-publishes, stores the staged listing only briefly in
   the browser, and does not send data to Ahlam's servers or third parties. Keep
   that language; it is a genuine privacy strength. (Matches the documented behavior;
   `[ATTORNEY REVIEW: confirm the shipped extension code matches this description —
   I reviewed the policy copy, not the extension source, in this pass.]`)
10. "We do not sell your personal information" — fine to keep **if** the training
    question (#1) is resolved so it is not contradicted, and provided we truly do not
    sell. Selling and sharing-for-cross-context-ads are CCPA terms of art; we do
    neither today.

---

## DRAFT PRIVACY POLICY (for attorney review, not for publishing as-is)

**Ahlam Privacy Policy**

Last updated: [DATE ON PUBLICATION]

**Who this covers.** This policy applies to the Ahlam web application at ahlam.io,
the Ahlam mobile app, and the Ahlam Auto-Poster browser extension. Ahlam helps used
auto parts sellers photograph, price, and list their inventory, and helps buyers
contact sellers and purchase parts.

**The short version.** We collect the information you give us and the listings you
create so the service can identify parts, price them, let buyers and sellers
message, and process payments. We use a small set of named service providers to do
this. We do not sell your personal information. `[ATTORNEY REVIEW: keep this line
only after the training-data question is resolved.]`

**1. Information we collect.**

- *Account and profile.* Your name or display name, email address, login
  credentials (passwords are hashed by our authentication provider, Supabase), and
  any phone number, avatar, or bio you add.
- *Shop and business details.* Shop name, business location, business phone, and
  business email.
- *Listings you create.* The photos you upload, vehicle identification numbers
  (VINs) you enter or that appear in your photos, part names, conditions, prices,
  descriptions, and the AI-generated draft plus any corrections you make to it.
- *Messages.* The content of messages you exchange with buyers or sellers through
  Ahlam.
- *Orders and payments.* When a purchase is made, the buyer's email and shipping
  name, the amount, and payment identifiers from our payment processor. We do not
  store full card numbers; card data goes directly to Stripe.
- *Salvage recordkeeping (dismantlers/recyclers).* If you use Ahlam to prepare
  NMVTIS junk and salvage reports, we store the VIN, the name and address of the
  party you obtained the vehicle from, and the disposition, because federal law
  requires that report.
- *Usage and device information.* Basic technical and usage signals needed to keep
  the service secure and working.

**2. How we use your information.** To identify and price parts, build and manage
your listings, let buyers and sellers contact each other, send transactional email
notifications, process payments and payouts, prepare regulatory reports you ask us
to prepare, provide support, and keep the service secure.
`[ATTORNEY REVIEW: if stored AI output/corrections are used to improve or train
models, that purpose must be stated here explicitly and honestly.]`

**3. Service providers who receive data.** We share personal data only with the
providers that run the service:

- **Supabase** — our database, authentication, and file storage.
- **Google (Gemini)** — our photo-identification and pricing model. When you scan a
  part, the photo (and any VIN or text visible in it) is sent to Google's Gemini API
  to identify and grade the parts. `[ATTORNEY REVIEW / DPA: confirm Google's terms
  for this API tier and whether inputs are used for their own model training; if so,
  that must be disclosed or that tier avoided.]`
- **NHTSA vPIC** — the U.S. government VIN-decode service; we send VIN strings to
  retrieve vehicle specifications.
- **Stripe** — our payment processor for marketplace purchases, escrow, and seller
  payouts.
- **eBay** — only if you choose to list an item on eBay, in which case your listing
  content and seller location are sent to eBay to create the listing.
- **Google Workspace (Gmail) SMTP** — to send transactional and notification email.

We do not sell or rent your personal information, and we do not share it with
advertisers or for cross-context behavioral advertising.

**4. The Ahlam Auto-Poster extension.** The extension fills marketplace post forms
with a listing you chose to post. It receives one listing from your Ahlam account
when you click to post, downloads that listing's photos, and fills the new-post form
on the marketplace you opened. It never submits a post for you; you review and click
Publish yourself. It stores the staged listing only briefly in your browser and
clears it after filling the form. It does not send your data to Ahlam's servers or
any third party other than the marketplace form you are posting to.

**5. How long we keep data.** We keep account, listing, and message data while your
account is active and as needed to provide the service. Order and payment records
and NMVTIS reporting records are kept for the longer period required by tax,
accounting, and motor-vehicle recordkeeping law. You can ask us to delete your
account and its data, subject to records we are legally required to keep.
`[ATTORNEY REVIEW: set concrete retention periods per category; confirm NMVTIS /
state dismantler recordkeeping minimums.]`

**6. Your choices and rights.** You can turn off buyer-message notification emails in
your settings. You can request access to, correction of, or deletion of your
personal information by emailing us at the address below. Depending on where you
live, you may have additional rights under your state's privacy law (for example, to
know, delete, correct, or port your data), and we will honor verified requests as
required by law. `[ATTORNEY REVIEW: when CCPA/other-state thresholds are crossed,
add the formal rights, the verifiable request process, the timelines, the
non-discrimination statement, and a "Do Not Sell or Share" link if applicable.]`

**7. Children.** Ahlam is a tool for auto parts businesses and is not directed to
children. We do not knowingly collect personal information from anyone under
[16/18]. `[ATTORNEY REVIEW: choose the age.]`

**8. Security.** We use reasonable administrative and technical measures to protect
your information. No method of transmission or storage is completely secure.

**9. Changes to this policy.** We will update this policy as our practices change and
revise the "last updated" date. Material changes will be communicated as required by
law.

**10. Contact.** Questions about this policy or your data? Email
[privacy@ahlam.io or mohammadabbas@ahlam.io]. `[ATTORNEY REVIEW: consider a
dedicated privacy@ alias and, if needed, a postal address.]`

---

## What else is still missing for launch (and who should own it)

| Item | Why it matters | Owner | Needs lawyer? |
|------|----------------|-------|---------------|
| **Terms of Service** | No ToS exists. Governs the user relationship, acceptable use, IP, and the Chrome extension. | Andy (product) drafts skeleton; Reg structures | Yes |
| **Seller Agreement + restricted-parts / disclaimer + limitation of liability** | Puts compliance duty for airbags, cats, seat belts, recalled parts on the seller; caps Ahlam's liability. Code already flags these parts. | Reg drafts, Mohammad reviews | Yes (must) |
| **Escrow / payments terms** | Allocates merchant-of-record, refund, chargeback, and payout responsibility for the Stripe Connect flow. | Mohammad (owns Stripe) | Yes (must) |
| **Cookie/consent banner** | Only if/when analytics or non-essential cookies are added. I found no analytics SDK wired in yet, so not required today. Re-check before adding any. | Andy | Only if EU traffic + non-essential cookies |
| **Data Processing Addendums (DPAs)** | Sign/keep Google, Stripe, Supabase, eBay DPAs so subprocessor chain is documented. | Mohammad | Review terms |
| **Fix the stale `.env.example` OpenAI comment + the live policy's two factual errors** | Accuracy is the legal point. | Andy (code) | After lawyer confirms facts |
| **Internal data map / retention schedule** | Backs up the retention claims in the policy and is what a regulator asks for first. | Reg maintains | Helpful, not required |

---

## Not-a-lawyer caveat and recommendation

I am Reg, Ahlam's Legal and Compliance lead. **I am not a licensed attorney and this
is not legal advice.** I have grounded every statement above in either Ahlam's actual
code or a cited, dated public source, and I have flagged the soft spots.

**My recommendation on counsel:** engage a privacy attorney **before this policy
goes live**, not after, for three reasons that are cheap to fix now and expensive
later: (1) the "we never use your data" line versus the training-data schema is a
real misrepresentation risk; (2) the Stripe escrow liability allocation needs to be
written correctly the first time; and (3) the restricted-parts seller disclaimer is
genuine product-liability exposure for a salvage marketplace. A two-to-three hour
review of this draft plus a ToS skeleton by a US privacy/commercial attorney is the
right spend. CalOPPA already requires *a* posted policy today, so the immediate move
is: fix the two factual errors in the current live policy now (truthful is better
than wrong), then put this draft and a ToS in front of counsel before launch.
