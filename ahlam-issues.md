# Ahlam.io — Issue & Findings Tracker

**Tested:** 2026-06-11 · logged in as `admin@gmail.com` (Downtown Auto Dismantlers Inc.)
**Scope tested:** Overview, Browse market, Orders, Vehicles, Parts, Add (manual only — no car scans), Interchange (part search + VIN), Yard, Analytics, AI assistant, Gallery, Export & posting, Messages, Shop profile, account menu.
**Out of scope (per request):** launch readiness, customer acquisition, payment processing setup.

Severity key: **P0** = blocker for a pro yard · **P1** = high (hurts trust/revenue) · **P2** = medium · **P3** = low/polish.

**Linear:** all 26 issues live in the AHLAM team (carspecs workspace), Backlog, assigned to Mohammad — IDs AHLAM-12 … AHLAM-37. Mapping below.

| Issue | Linear | Issue | Linear | Issue | Linear |
|-------|--------|-------|--------|-------|--------|
| WAR-1 | AHLAM-12 | WAR-4 | AHLAM-21 | OPS-3 | AHLAM-28 |
| WAR-2 | AHLAM-13 | INT-2 | AHLAM-22 | OPS-4 | AHLAM-29 |
| CMP-1 | AHLAM-14 | PRC-3 | AHLAM-23 | OPS-6 | AHLAM-30 |
| WAR-3 | AHLAM-15 | PRC-4 | AHLAM-24 | PERF-1 | AHLAM-31 |
| INT-1 | AHLAM-16 | PHO-2 | AHLAM-25 | INT-3 | AHLAM-32 |
| PRC-1 | AHLAM-17 | OPS-1 | AHLAM-26 | CHN-2 | AHLAM-33 |
| PRC-2 | AHLAM-18 | OPS-2 | AHLAM-27 | OPS-5 | AHLAM-34 |
| PHO-1 | AHLAM-19 | | | PERF-2 | AHLAM-35 |
| CHN-1 | AHLAM-20 | | | PERF-3 | AHLAM-36 |
| | | | | TRU-2 | AHLAM-37 |

---

## 0. Why a pro salvage-yard owner would pick a competitor over Ahlam (full)

This is the honest "lose" column — written as the yard owner deciding where to spend money and trust. Each reason maps to the issue IDs below so engineering can close the gap.

### 0.1 Car-Part.com (+ its ecosystem: Checkmate, Pinnacle/eManage, Bidmate, Trading Partners)
**Why I'd pick them:** Car-Part.com **is** the professional used-parts market. When a body shop or mechanic in another state needs a door shell or an engine, their estimating software (and the wrecker network) searches Car-Part.com — not eBay, not Facebook. Being listed there is how a yard reaches the buyers who pay real money and buy daily. Their Checkmate / Pinnacle yard-management systems also run the *entire* business: intake, teardown, bin/location, work orders, core tracking, invoicing, warranty/returns, accounting, multi-location, and the legally-required **NMVTIS** reporting. Ahlam reaches none of the pro buyer network and covers only part of the operation.
**Maps to:** CHN-1 (no Car-Part.com/URG reach), CMP-1 (no NMVTIS), OPS-1..6 (teardown/cores/shipping/qty/accounting/migration), WAR-1..4 (warranty/returns).

### 0.2 Hollander Interchange (the real one)
**Why I'd pick them:** Hollander is the authoritative, decades-old interchange standard. When I quote a customer a part fits, a Hollander number is something I can stand behind and a buyer's shop can verify. Ahlam's AI interchange is genuinely impressive on mainstream/hybrid drivetrains (and that's a real edge), but it's AI-generated with a "always confirm" disclaimer, it **failed outright on a BMW electronic module**, and it gives me no verifiable cross-reference number to fall back on. For high-value electronics and oddball parts I can't bet my reputation on it yet.
**Maps to:** INT-1 (fails on complex/electronic parts), INT-2 (no authoritative source/number), INT-3 (latency).

### 0.3 eBay Motors (used directly, not via Ahlam)
**Why I'd pick them:** eBay gives buyers structured fitment ("My Garage" / compatibility), a mature returns + buyer-protection + warranty framework, and listing-quality rules that reward **real photos of the actual part**. Ahlam posts to eBay via API (good), but it feeds eBay generic *whole-car* photos and no warranty terms, which means lower listing quality, worse placement, and more "item not as described" cases. If listing quality on eBay matters to me, doing it natively with proper photos beats Ahlam's pipe.
**Maps to:** PHO-1/PHO-2 (no per-part photos), WAR-1..3 (no warranty/returns), PRC-1 (fitment/trim precision).

### 0.4 Facebook Marketplace / OfferUp (for local retail)
**Why I'd pick them:** For local cash buyers, Facebook is free, has the audience already, and lets me post a real photo in 60 seconds. Ahlam's copy-paste-and-open-form helper is honest and useful, but in testing the Craigslist hand-off gave **no confirmation** it worked, and again the photos are whole-car, not the part. For a quick local flip, native Facebook is less friction.
**Maps to:** CHN-2 (no confirmation/popup handling on "Post elsewhere"), PHO-1 (photos).

### 0.5 RAS (Rebuilders Automotive Supply) and core buyers
**Why I'd pick them:** For cores and bulk (cats, engines, alternators as cores), specialized buyers pay reliably and handle logistics. Ahlam has **no core-charge tracking** and its AI **over-valued a catalytic converter core** ($500–$1,000+ vs realistic ~$100–$250), which would lead me to bad decisions if I trusted it.
**Maps to:** OPS-2 (core tracking), PRC-2 (inflated commodity pricing).

### 0.6 Incumbent Yard Management Systems generally (switching-cost argument)
**Why I'd pick them:** I already have thousands of parts, locations, and history in an existing system, plus staff trained on it and NMVTIS handled. Ahlam shows **no migration/import path** from an existing YMS, so adopting it means re-keying or re-shooting my whole yard while still running the old system for compliance and back-office. The safer move is to keep the incumbent and treat Ahlam as an add-on.
**Maps to:** OPS-6 (no migration), CMP-1 (NMVTIS), plus the whole OPS group.

### 0.7 Where Ahlam still wins (so this is balanced)
Photo→priced inventory speed, expert-level AI interchange on common/hybrid drivetrains, accurate VIN decode, a correctly-scoped AI assistant, honest microcopy, built-in local marketplace + deal-stage messaging, and Yard location/barcode + Team & roles. **Close the issues below — especially warranty, interchange reliability, per-part photos, Car-Part.com reach, and NMVTIS — and most of section 0 collapses.**

---

## A. Warranty, Guarantee & Buyer Protection

| ID | Sev | Issue | Impact | Suggested fix |
|----|-----|-------|--------|---------------|
| WAR-1 | P0 | **No warranty/guarantee field anywhere** — not on listing, part editor, or shop profile. | Below trade norm (used parts standardly carry 30/60/90-day warranties). Sellers can't advertise a warranty; buyers have no recourse. | Per-listing warranty field: None / 30 / 60 / 90-day / as-is. — ✅ DONE 2026-06-11 |
| WAR-2 | P0 | **No returns/refund policy** at listing or shop level. | Disputes have nothing to reference; they land in Messages with no framework. | Shop-level default returns policy that auto-applies to every listing. — ✅ DONE 2026-06-11 |
| WAR-3 | P1 | **Escrow is the only protection and ends at "buyer confirms receipt."** Covers non-delivery / not-as-described-on-arrival only. | No coverage for defective / wrong / fails-in-a-week — the most common used-part dispute. | Add a warranty/return window that can hold or claw back escrow if the part fails within the stated period. — ✅ DONE 2026-06-11 |
| WAR-4 | P2 | **No explicit "as-is, no returns" toggle** for glass/body/cosmetic parts. | Sellers exposed on parts that legitimately shouldn't carry a warranty. | Add as-is flag; surface it clearly to buyers. — ✅ DONE 2026-06-11 (shipped alongside WAR-1/2/3) |

## B. Interchange / Fitment Accuracy & Reliability

| ID | Sev | Issue | Impact | Suggested fix |
|----|-----|-------|--------|---------------|
| INT-1 | P1 | **Interchange fails on complex/electronic parts.** 2015 BMW 335i DME stalled 30–40s and errored ("Interchange lookup failed. Try again.") on 2 attempts. | High-value modules are where pros need help most; hard fail with no fallback erodes trust. | Timeout handling, partial results, retry/backoff, and a "low-confidence — verify manually" state instead of a hard error. — ✅ DONE 2026-06-11 |
| INT-2 | P2 | **No authoritative source / no real Hollander number.** Output is AI-generated; disclaimer says "always confirm." | Pros won't quote money off it for oddball parts without a verifiable cross-ref. | Show confidence level + cite basis; optionally map to a real Hollander/OEM source where available. |
| INT-3 | P3 | Latency is high even on successful queries (Toyota took ~15–25s). | Slows the counter workflow. | Cache common lookups (already "saved to catalog" — surface/reuse it); stream partial results. |
| INT-NOTE | ✅ | **Positive:** Camry 2.5L gas (2AR-FE, OEM 27060-0V070, RAV4/Scion tC) and Camry **Hybrid** (no alternator → inverter/DC-DC, 2AR-FXE, Avalon Hybrid/Lexus ES 300h) both **correct and expert-level**. Gas/hybrid disambiguation + amperage warning are excellent. | — | Keep; this is a core differentiator. |
| VIN-NOTE | ✅ | **Positive:** VIN decode accurate — `1HGCM82633A004352` → 2003 Honda Accord EX-V6 **J30A4** with one-tap part chips. | — | Keep. |

## C. AI Pricing & Grading

| ID | Sev | Issue | Impact | Suggested fix |
|----|-----|-------|--------|---------------|
| PRC-1 | P1 | **Pricing ignores sub-variants.** "Write with AI" priced a 2018 Tacoma headlight at flat $250 with no halogen-vs-LED prompt (real range ~$150–$600+). | Systematic mispricing on trim-sensitive parts; lost margin or unsellable listings. | Prompt for trim/variant on price-sensitive parts; widen/ narrow range accordingly. — ✅ DONE 2026-06-11 |
| PRC-2 | P1 | **AI assistant quoted inflated scrap value** — 2017 Civic catalytic converter core at $500–$700, up to $1,000+ (realistic ~$100–$250). Confident numbers, no source. | Bad decisions on high-theft, high-variance commodity; credibility risk. | Ground figures in comps; show a basis + confidence range; flag volatile commodities. — ✅ DONE 2026-06-11 |
| PRC-3 | P2 | **Grade C ("damaged / non-functional") parts auto-priced and posted live** (e.g., $300 Grade-C front bumper). | Return magnet for mechanical parts; buyer disputes. | Guardrail/confirmation before posting Grade-C mechanical parts; default such items to "as-is." — ✅ DONE 2026-06-11 |
| PRC-4 | P2 | **Grade is inferred from photos** and can't see internal/electrical condition; description ("bench-tested, works great") is unverified free text. | Overstated condition → returns. | Optional "tested/untested" structured flag; encourage functional-test notes. |

## D. Photos & Listing Quality

| ID | Sev | Issue | Impact | Suggested fix |
|----|-----|-------|--------|---------------|
| PHO-1 | P1 | **Parts have no individual photos** — Gallery shows only "Whole car" shots; many parts appear to share the same 7 wide images. | Buyers and eBay listing-quality scoring penalize parts with no photo of the actual item; lowers conversion. | Photo-to-part assignment; prompt for a close-up on high-value parts; flag listings with no part-specific photo. — ✅ DONE 2026-06-11 |
| PHO-2 | P2 | No visible per-listing image requirement/warning before posting. | Generic-photo listings go live silently. | Warn when posting a part with only whole-car images. — ✅ DONE 2026-06-11 (shipped with PHO-1) |

## E. Marketplace Reach / Channels

| ID | Sev | Issue | Impact | Suggested fix |
|----|-----|-------|--------|---------------|
| CHN-1 | P1 | **No pro-buyer network integration** (Car-Part.com / URG / Hotlines). Export is all retail/consumer (eBay, FB, OfferUp, Craigslist). | Misses the highest-margin wholesale repair-shop buyers — the core salvage channel. | Add Car-Part.com / URG export (CSV/feed at minimum). — ✅ DONE 2026-06-11 |
| CHN-2 | P3 | "Post elsewhere → Craigslist" gave no clear confirmation of what was copied / didn't visibly open a form (possible popup block). | User unsure the copy/open-form step worked. | Toast/confirmation showing "text copied + N photos saved"; handle popup blocking gracefully. |
| CHN-NOTE | ✅ | **Positive:** eBay auto-post via API (connected); FB/OfferUp/Craigslist copy-text + save-photos + open-form; bulk CSV; "list all parts as one lot." Honest, ban-safe approach. | — | Keep. |

## F. Compliance & Back-Office (YMS depth)

| ID | Sev | Issue | Impact | Suggested fix |
|----|-----|-------|--------|---------------|
| CMP-1 | P0* | **No NMVTIS reporting.** US dismantlers are legally required to report. | A licensed yard can't fully replace its existing system; compliance blocker. (*P0 for licensed US yards.) | Add NMVTIS reporting/export. — ✅ DONE 2026-06-11 |
| OPS-1 | P2 | No teardown/work-order workflow. | Can't manage the dismantling process, only the listing. | Optional teardown checklist/work orders. |
| OPS-2 | P2 | No core-charge tracking. | Core charges are standard revenue/accounting in the trade. | Add core-charge field + tracking. |
| OPS-3 | P2 | No shipping weight/dimensions or carrier/label integration. | Can't ship efficiently; only local pickup is well-supported. | Add dimensions/weight + shipping label/carrier integration. |
| OPS-4 | P2 | No quantity-on-hand (each part is a single unit). | Can't represent multiples (sets, common consumables). | Add quantity field. |
| OPS-5 | P3 | No accounting/QuickBooks sync. | Manual bookkeeping. | Accounting export/integration. |
| OPS-6 | P2 | No data migration/import from an existing YMS. | High switching cost for established yards. | Import path (beyond the parts CSV). |
| YARD-NOTE | ✅ | **Positive:** Yard page tracks Part / Location / Barcode / Status (list + grid). Team & roles and Billing exist (not single-user). | — | Keep; populate location/barcode in onboarding. |

## G. App Performance & Stability

| ID | Sev | Issue | Impact | Suggested fix |
|----|-----|-------|--------|---------------|
| PERF-1 | P2 | **Renderer sluggish/unresponsive** — screenshots and clipboard reads repeatedly timed out (30–45s) on the app; page got "stuck" after the export action and needed a reload. | Janky feel; risk of perceived hangs for users. | Profile main-thread work; investigate heavy/blocking operations on these pages. |
| PERF-2 | P3 | Extension/connection dropped once mid-action (may be environmental). | Transient. | Monitor; ensure graceful reconnection. |
| PERF-3 | P3 | Several actions only register on a second click (interchange "Find," "Write with AI"). | Minor friction/confusion. | Ensure first click triggers; show pending state. |

## H. Trust & Storefront (positives + small gaps)

| ID | Sev | Issue | Impact | Suggested fix |
|----|-----|-------|--------|---------------|
| TRU-1 | ✅ | Seller verification badge (business email/phone/license link) + ratings/reviews ("Write a review", "New" seller status). | Good trust signals. | Keep; tie verification to listing prominence. |
| TRU-2 | P3 | Shop profile has no policies section (returns/warranty/shipping) — ties back to WAR-1/2. | Buyers can't see seller terms at a glance. | Add a "Store policies" block to the public storefront. |
| TRU-3 | ✅ | AI microcopy sets honest expectations ("nothing posts until you save", "always confirm fitment"). | Good. | Keep. |

---

## Priority shortlist (fix in this order)
1. **WAR-1 / WAR-2 / WAR-3** — warranty + returns framework (biggest trust gap for mechanical parts).
2. **INT-1** — interchange reliability on electronic/complex parts.
3. **PHO-1** — per-part photos.
4. **CHN-1** — Car-Part.com / URG reach.
5. **CMP-1** — NMVTIS (blocker for licensed US yards).
6. **PRC-1 / PRC-2 / PRC-3** — pricing accuracy + Grade-C guardrails.

## Confirmed strengths (don't break these)
- Expert-level AI interchange on mainstream + hybrid drivetrains; accurate VIN decode.
- Correctly scoped, injection-resistant AI assistant.
- Honest, channel-aware export (eBay API + ban-safe copy/paste).
- Real operational features: Yard location+barcode, deal-stage Messages CRM, per-car profit analytics, bulk tools, Team & roles.
- Trustworthy product microcopy.

---

## Claude Code working prompt (paste this into Claude Code at the repo root)

> Copy everything inside the code block into Claude Code. It will work the issues one at a time, in priority order, and report back after each one.

```
You are working on the Ahlam.io codebase (a photo→parts-listing tool for auto salvage yards).
Your job is to work through the issue tracker in `ahlam-issues.md` ONE ISSUE AT A TIME, in priority
order, and report feedback after each one. Do not batch multiple issues into one change.

WORKFLOW (repeat until the priority shortlist is done):
1. Read `ahlam-issues.md`. Build a worklist from the "Priority shortlist", then any remaining P0,
   then P1, then P2, then P3. Skip anything already marked ✅ DONE.
2. Announce the single issue you are about to work on: its ID, severity, and one-line goal.
3. Investigate FIRST. Find the relevant files/components in the repo. Quote the file:line where the
   gap lives. If the issue can't be located or is bigger than expected, STOP and report what you
   found and what you need from me before writing code.
4. Write a short plan (3–6 bullets) and the acceptance criteria you'll verify against. For each
   issue, acceptance criteria are:
     - WAR-1/2/3/4: a warranty/returns value exists on the part-listing data model, is editable in
       the part editor, has a shop-level default in Shop profile, renders on the buyer-facing
       listing, and (WAR-3) the escrow/return window logic references it.
     - INT-1: complex/electronic interchange queries no longer hard-fail — add timeout handling,
       retry/backoff, and a graceful "low-confidence / verify manually" state with partial results.
     - INT-2: interchange results show a confidence level and the basis; surface any known OEM/
       Hollander number when available.
     - PHO-1/2: parts can hold their own photo(s) distinct from whole-car shots; posting a part with
       only whole-car images shows a warning.
     - CHN-1: add a Car-Part.com / URG-compatible export (CSV/feed) for parts.
     - CHN-2: "Post elsewhere" shows a clear confirmation (text copied + N photos saved) and handles
       popup blocking.
     - PRC-1: AI pricing prompts for trim/variant on price-sensitive parts and returns a range.
     - PRC-2: AI/commodity pricing shows a basis + confidence range; volatile commodities flagged.
     - PRC-3: posting a Grade-C mechanical part requires confirmation / defaults to "as-is".
     - CMP-1: add NMVTIS reporting/export scaffolding.
     - OPS-1..6 / PERF-* / TRU-2: implement per the issue's "Suggested fix" column.
5. Implement the change. Match existing code style, naming, and patterns. Keep the diff focused on
   this one issue. Add/adjust tests where the repo has a test setup.
6. Verify: run the build, lint, type-check, and tests. If there's a dev server, run the relevant
   flow and confirm the acceptance criteria actually hold (don't just assume).
7. Report feedback in this exact format, then move to the next issue:
     ## <ISSUE-ID> — <title>
     - Status: DONE / PARTIAL / BLOCKED
     - What changed: <files touched + 1–2 sentence summary>
     - How I verified: <build/test/manual result, paste key output>
     - Acceptance criteria: <met / not met, per criterion>
     - Risks / follow-ups: <anything>
     - Questions for you: <only if BLOCKED or a product decision is needed>
8. Mark the issue ✅ DONE in `ahlam-issues.md` (append " — ✅ DONE <date>" to that row) and commit
   with message: `fix(<area>): <ISSUE-ID> <short desc>`. Then continue to the next issue.

RULES:
- One issue per commit. Never start the next issue before reporting on the current one.
- If an issue needs a product/UX decision (e.g., default warranty length, which channels), pick a
  sensible default, state it in your report, and flag it as a question — don't stall.
- Don't touch the confirmed strengths listed in the tracker unless an issue requires it.
- If tests/build fail and you can't fix it in a couple of tries, report BLOCKED with the error.
- Stop and check in with me after finishing the entire Priority shortlist (items 1–6) so I can
  review before you continue into P2/P3.

Start now with the first item on the Priority shortlist.
```

