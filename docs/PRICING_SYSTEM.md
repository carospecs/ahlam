# Ahlam AI Pricing System

## Overview

The AI scan uses a fully deterministic formula to price parts. No live lookups, no eBay comps — the same photo always prices the same way.

The Gemini 2.5 Pro vision model estimates each part's **brand-new OEM/retail price**, then the server discounts it based on the vehicle's age and the part's condition grade.

---

## Formula

```
usedPrice = newPartPrice × ageFactor(age) × conditionMultiplier(grade, age)
```

- `age` = current year − vehicle model year (minimum 1)
- `newPartPrice` = what the part costs brand new (estimated by the AI from the photo)

---

## ageFactor

Linear depreciation from 1.0 (age 1) → 0.0 (age 15), clamped to [0, 1]:

```
ageFactor = clamp(1 − (age − 1) / 14, 0, 1)
```

| Age | ageFactor |
|-----|-----------|
| 1   | 1.00      |
| 3   | 0.86      |
| 5   | 0.71      |
| 7   | 0.57      |
| 10  | 0.36      |
| 15+ | 0.00      |

> **Open issue:** The curve currently zeros out at age 15 (year 2011 in 2026). This is too conservative — many people still drive cars from 2000. The denominator (14) and `RESIDUAL_FLOOR` are the two levers to fix this. Decision pending.

---

## conditionMultiplier

Each part is graded **A / B / C** (ARA-style) by the AI from visible condition in the photo.

| Grade | Label | conditionMultiplier | Notes |
|-------|-------|---------------------|-------|
| **A** | Like New | `0.80 + 0.10 × ageFactor` → 0.90 (new) to 0.80 (old) | Only assigned when AI confidence is "high"; otherwise auto-downgraded to B |
| **B** | Reliable, More Wear | `0.60 + 0.19 × ageFactor` → 0.79 (new) to 0.60 (old) | Default grade when uncertain |
| **C** | Functional, High Wear | `0.33` (flat, age-independent) | Always assigned for collision/structural damage |

### Grading Criteria

**Body parts:**
- **A** — 0–1 repair unit needed (e.g. a small dent)
- **B** — 1–2 repair units; visible damage but structurally sound
- **C** — 2+ repair units; significant cosmetic or structural damage

**Mechanical parts:**
- **A** — Under 60k miles total, OR under 15k miles/year relative to vehicle age
- **B** — 60k–200k miles total AND over 15k miles/year relative to age
- **C** — Over 200k miles total, regardless of age

**Hard overrides:**
- Collision damage (crumpled, bent, cracked, shattered) → always **C**
- AI confidence not "high" on a grade A → auto-downgraded to **B**

---

## Example — Front Bumper Cover (new OEM price: $400)

| Model Year | Age | ageFactor | Grade A | Grade B | Grade C |
|------------|-----|-----------|---------|---------|---------|
| 2025       | 1   | 1.00      | $360    | $316    | $132    |
| 2023       | 3   | 0.86      | $303    | $261    | $113    |
| 2021       | 5   | 0.71      | $249    | $210    | $94     |
| 2019       | 7   | 0.57      | $196    | $162    | $75     |
| 2016       | 10  | 0.36      | $119    | $95     | $47     |
| 2011       | 15  | 0.00      | $0      | $0      | $0      |

---

## Residual Floor

Defined in `lib/age-pricing.ts` as `RESIDUAL_FLOOR = 0`.

Raising this constant (e.g. to `0.05`) gives old parts a price floor of `newPartPrice × RESIDUAL_FLOOR`, regardless of age.

---

## Whole-Car Price

The whole-vehicle estimate skips condition grading (no single A/B/C applies to a whole car):

```
suggestedWholeCarPriceUsd = newWholeCarMSRP × ageFactor(age)
```

---

## Manual Listing (separate flow)

`/api/assistant/listing` uses **Gemini 2.5 Flash** and prices the part directly as a used resale price (no formula). Special handling:
- **Variant flag** — if price swings 2x on trim (e.g. halogen vs. LED headlight), asks a follow-up question instead of guessing
- **Volatile flag** — catalytic converters and scrap commodities get a conservative range + a note to verify with a core buyer

---

## Source Files

| File | Purpose |
|------|---------|
| `lib/age-pricing.ts` | Formula constants and functions |
| `lib/pricing.ts` | Live comp fallback (manual PricingToggle UI only) |
| `lib/plans.ts` | Stripe product IDs per subscription plan |
| `app/api/identify/route.ts` | AI scan endpoint — calls Gemini, applies formula |
| `app/api/assistant/listing/route.ts` | Manual listing AI assist |
| `components/PricingPlans.tsx` | Subscription plan definitions (UI + data) |
