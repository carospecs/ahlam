// Part pricing formula — the single source of truth for the AI scan's part prices.
// The vision model estimates each part's BRAND-NEW (OEM/retail) price; this module
// applies a flat condition-based discount:
//
//   Grade A (like new)       → newPartPrice × 0.85  (15% off)
//   Grade B (normal wear)    → newPartPrice × 0.70  (30% off)
//   Grade C (heavily damaged)→ null — unpriced, seller sets manually

export type ConditionGrade = "A" | "B" | "C";

// Discount multipliers per grade. C is null — Grade C parts are left unpriced.
export const GRADE_DISCOUNT: Record<ConditionGrade, number | null> = {
  A: 0.85,
  B: 0.70,
  C: null,
};

// Kept for whole-car price calculation (MSRP × ageFactor).
export function vehicleAge(modelYear: number, now: number = new Date().getFullYear()): number {
  return Math.max(1, now - modelYear);
}

export function ageFactor(age: number): number {
  return Math.min(1, Math.max(0, 1 - (age - 1) / 14));
}

// Final used price for a part. Returns null for Grade C or unknown new price.
export function usedPriceFromNew(
  newPrice: number | null | undefined,
  grade: ConditionGrade,
): number | null {
  if (newPrice == null || !Number.isFinite(newPrice) || newPrice <= 0) return null;
  const discount = GRADE_DISCOUNT[grade];
  if (discount === null) return null;
  return Math.round(newPrice * discount);
}
