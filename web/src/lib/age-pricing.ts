// LEGACY part pricing formula — superseded by lib/used-pricing.ts, which anchors to
// the part's USED-market selling price instead of discounting the new/retail price
// (the new-price anchor put painted panels near best-case retail; see the 2018
// Model X case in used-pricing.ts). usedPriceFromNew/GRADE_DISCOUNT are kept only
// for old persisted rows; vehicleAge/ageFactor are still live (whole-car estimate).
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
