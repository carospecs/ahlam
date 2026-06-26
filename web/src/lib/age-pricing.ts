// Deterministic age × condition pricing — the single source of truth for the AI
// scan's part prices. Replaces the old live "comp ladder" (shop comps + eBay
// Browse + grounded Gemini search + static bands). The model now estimates each
// part's BRAND-NEW (OEM/MSRP) price, and this module discounts it to a used
// price from the vehicle's age and the part's condition grade:
//
//   usedPrice = newPartPrice × ageFactor(age) × conditionMultiplier(grade, age)
//
// The curves below are Andy's established model (matches his table exactly):
//
//   age      = currentYear − modelYear
//   Factor f = clamp(1 − (age−1)/14, 0, 1)     // 1.00 @age1 → 0.00 @age15, clamped
//   A(age)   = 0.80 + 0.10·f                    // 0.90 → 0.80
//   B(age)   = 0.60 + 0.19·f                    // 0.79 → 0.60
//   C        = 0.33                             // flat

export type ConditionGrade = "A" | "B" | "C";

// Residual value an aged part keeps as a fraction of its new price, applied as a
// hard floor. INTENTIONALLY 0: because Factor clamps to 0 at age 15, every
// vehicle 15+ years old prices to $0 by design (Andy's model). Raise this single
// constant (e.g. 0.05) to give old parts a residual floor — no call site changes.
export const RESIDUAL_FLOOR = 0;

// Years since the model year. `now` defaults to the current calendar year.
// Clamped to a minimum of 1 (a brand-new current-year part is "age 1", Factor 1.0).
export function vehicleAge(modelYear: number, now: number = new Date().getFullYear()): number {
  return Math.max(1, now - modelYear);
}

// Age depreciation factor: 1.00 at age 1, linear to 0.00 at age 15, clamped to
// [0, 1] beyond. Drives both the overall depreciation and the A/B/C drift below.
export function ageFactor(age: number): number {
  return Math.min(1, Math.max(0, 1 - (age - 1) / 14));
}

// Age-adjusted condition multiplier (the A/B/C columns of the model). Each grade
// interpolates between its young-car value and its old-car floor via ageFactor:
//   A: 0.90 → 0.80,  B: 0.79 → 0.60,  C: flat 0.33.
export function conditionMultiplier(grade: ConditionGrade, age: number): number {
  const f = ageFactor(age);
  switch (grade) {
    case "A": return 0.8 + 0.1 * f;
    case "B": return 0.6 + 0.19 * f;
    case "C": return 0.33;
  }
}

// Final used price for a part: round(newPrice × ageFactor × conditionMultiplier),
// floored at newPrice × RESIDUAL_FLOOR. Returns null when the new price is
// unknown/non-positive, so callers can surface "no estimate" rather than $0.
export function usedPriceFromNew(
  newPrice: number | null | undefined,
  grade: ConditionGrade,
  age: number,
): number | null {
  if (newPrice == null || !Number.isFinite(newPrice) || newPrice <= 0) return null;
  const raw = newPrice * ageFactor(age) * conditionMultiplier(grade, age);
  return Math.round(Math.max(raw, newPrice * RESIDUAL_FLOOR));
}
