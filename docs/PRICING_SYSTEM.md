# Ahlam AI Pricing System

> Last verified against code: 2026-06-27 (commit `Final draft (#38)`).
> This describes the **shipped** behavior in `lib/age-pricing.ts` and
> `app/api/identify/route.ts`. It supersedes the earlier age × condition
> description and is consistent with `SESSION_PRICING_CHANGES.md`.

## Overview

The AI scan prices parts with a **fully deterministic, condition-only formula** —
no live lookups, no eBay comps, and **no age factor on individual parts**. The same
photo always prices the same way.

The **Gemini 2.5 Pro** vision model estimates each part's **brand-new OEM/retail
price**; the server then applies a flat discount based only on the part's condition
grade. (Vehicle age affects the *whole-car* estimate only — see below.)

---

## Formula (per part)

```
suggestedPriceUsd = round( newPartPriceUsd × gradeDiscount(grade) )
```

- `newPartPriceUsd` = what the part costs **brand new** (estimated by the AI from the photo)
- `grade` = the part's condition grade (A / B / C)
- Grade **C** returns `null` — the part is left **unpriced** and the seller sets the price manually.

### Grade discounts

Defined in `lib/age-pricing.ts` as `GRADE_DISCOUNT`:

| Grade | Label | Discount | Multiplier | Result |
|-------|-------|----------|------------|--------|
| **A** | Like New | 15% off new | `× 0.85` | `round(new × 0.85)` |
| **B** | Reliable, More Wear | 30% off new | `× 0.70` | `round(new × 0.70)` |
| **C** | Functional, High Wear / Damaged | — | `null` | **Unpriced** (seller sets manually) |

There is no age term, no residual floor, and no comp lookup in the part price.

---

## Inputs

### 1. `newPartPriceUsd` (from the AI)

The approximate price of the part **brand new** — a new OEM (or quality aftermarket)
replacement for this make/model/year/trim at retail today. The model is explicitly
told **not** to discount for wear, damage, or age (the server's grade discount carries
that). It judges the new price from full OEM fitment (luxury/low-supply = higher;
common economy = lower), gives paired left/right parts the same new price, and returns
`null` rather than guessing when it has no basis.

### 2. Condition grade A / B / C (from the AI)

Graded from visible condition in the photo on an ARA-style rubric (`CONDITION_RUBRIC`):

| Grade | Body parts | Mechanical parts |
|-------|-----------|------------------|
| **A** — Like New | 0–1 repair units needed (e.g. a small dent) | Under 60k mi total, OR under 15k mi/yr relative to vehicle age |
| **B** — Reliable, More Wear | 1–2 repair units; visible damage but structurally sound | 60k–200k mi total AND over 15k mi/yr (hard ceiling: under 200k) |
| **C** — Functional, High Wear | 2+ repair units; significant cosmetic or structural damage | Over 200k mi total, regardless of age |

**Hard overrides (in order):**
- **Collision / structural damage** (crumpled, bent, cracked, torn, broken mounts, shattered/spidered glass) → **always C**. A wrecked part is a repairable core, the cheapest version of that part.
- When genuinely between two grades → choose the **lower** (more conservative) one.
- A **Grade A is auto-downgraded to B unless the model's confidence is "high"** (`identify/route.ts`), so a part it isn't sure about never posts as flawless.
- An invalid or missing grade defaults to **B**.

The downgraded grade is what flows into the price.

---

## Example — per-part prices

Age does **not** change these — only the new price and the grade do.

| Part | New price | Grade A (×0.85) | Grade B (×0.70) | Grade C |
|------|-----------|-----------------|-----------------|---------|
| Front Bumper Cover | $400 | $340 | $280 | unpriced |
| Headlight Assembly | $600 | $510 | $420 | unpriced |
| Alternator | $250 | $213 | $175 | unpriced |
| Engine | $4,000 | $3,400 | $2,800 | unpriced |

---

## Whole-Car Price (the only place age applies)

A whole vehicle skips condition grading (no single A/B/C applies to a whole car) and
instead depreciates the original MSRP by the vehicle's age:

```
suggestedWholeCarPriceUsd = round( newWholeCarPriceUsd × ageFactor(age) )

ageFactor(age) = clamp( 1 − (age − 1) / 14, 0, 1 )
age            = max( 1, currentYear − modelYear )   // defaults to 8 if year unknown
```

- `newWholeCarPriceUsd` = the vehicle's original MSRP, estimated by the AI (`null` if it can't).
- Linear depreciation from 1.00 (age 1) down to 0.00 at age 15+.

| Age | Model year (in 2026) | ageFactor |
|-----|----------------------|-----------|
| 1   | 2025 | 1.00 |
| 3   | 2023 | 0.86 |
| 5   | 2021 | 0.71 |
| 7   | 2019 | 0.57 |
| 10  | 2016 | 0.36 |
| 15+ | 2011 | 0.00 |

Example: a $30,000-MSRP vehicle from 2021 (age 5) → `30000 × 0.71 ≈ $21,429`.

> **Known limitation:** the whole-car curve zeros out at age 15 (model year 2011 in
> 2026), which is conservative for the many older cars still on the road. The `14`
> denominator in `ageFactor` is the lever to soften this. Note this affects the
> whole-car estimate **only** — individual part prices have no age term, so old-car
> parts are not zeroed.

---

## Manual Listing (separate flow)

`/api/assistant/listing` is a different path that does **not** use the formula above.
It uses **Gemini 2.5 Flash** and prices a single part **directly as a used resale
price** (`suggestedPriceUsd` + a `priceRange` {min, max}). Special handling:

- **Variant flag (`needsVariant`)** — for parts whose price swings 2x+ on trim/variant
  (headlights halogen/HID/LED, wheels, seats, mirrors, engines/transmissions,
  infotainment/clusters), it sets `needsVariant: true`, asks a one-line follow-up via
  `variantPrompt`, and widens `priceRange` instead of guessing one number.
- **Volatile flag (`volatile`)** — catalytic converters and scrap/core commodities
  (precious-metal cores, batteries, aluminum/copper) get a conservative range
  (a standard cat core is ~$50–$250, not $500+) and a note to verify with a current
  core buyer.

---

## Not part of this system

To prevent the contradictions this doc previously contained:

- **No comp ladder.** The old shop-history → eBay-listings → grounded-search ladder
  was removed from the scan. The grounded "live comp" search (`lib/pricing.ts`,
  `livePartPrice` / `groundedMedianPrice`) now backs **only** the manual PricingToggle
  UI, and eBay category resolution (`suggestLeafCategory`) backs **only** eBay listing.
- **No age factor on parts.** Age affects the whole-car estimate only.
- **No `RESIDUAL_FLOOR` constant.** It does not exist in the code.
- **No age-dependent condition multipliers.** Grade discounts are flat (0.85 / 0.70 / null).

---

## Source Files

| File | Purpose |
|------|---------|
| `lib/age-pricing.ts` | `GRADE_DISCOUNT`, `usedPriceFromNew`, `vehicleAge`, `ageFactor` — the part formula and whole-car age curve |
| `app/api/identify/route.ts` | AI scan endpoint — Gemini 2.5 Pro; applies the grade discount per part and age depreciation for the whole car |
| `app/api/assistant/listing/route.ts` | Manual single-part listing assist — Gemini 2.5 Flash; direct used price + variant/volatile flags |
| `lib/pricing.ts` | eBay leaf-category resolver + grounded "live comp" lookup — **manual PricingToggle UI / eBay listing only**, not the scan |

> **Subscription (SaaS) pricing is a different system.** Shop subscription plans live
> in `components/PricingPlans.tsx` (UI/data) and `lib/plans.ts` (Stripe product IDs),
> and are unrelated to the part-pricing model above.
