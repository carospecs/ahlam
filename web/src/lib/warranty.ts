// Warranty / returns helpers shared by the part editor, the buyer-facing
// listing pages, and the listing-text builder (WAR-1, WAR-2, WAR-3, WAR-4).
//
// A part's warranty is stored as a number of days on the listing's `corrected`
// JSON (warrantyDays) plus an `asIs` flag. The shop carries a default that
// applies when a listing hasn't set its own. The four trade-standard choices:
//   0  → none (or "as-is" when asIs is set)
//   30 / 60 / 90 → days the part is guaranteed.

export const WARRANTY_DAYS = [0, 30, 60, 90] as const;
export type WarrantyDays = (typeof WARRANTY_DAYS)[number];

/** Coerce any stored value to one of the allowed warranty lengths. */
export function normalizeWarrantyDays(v: unknown): WarrantyDays {
  const n = Number(v);
  return (WARRANTY_DAYS as readonly number[]).includes(n) ? (n as WarrantyDays) : 0;
}

/**
 * The terms that actually apply to a listing: its own if set, otherwise the
 * shop default. `asIs` always wins — an as-is part carries no warranty.
 */
export function effectiveWarranty(
  listing: { warrantyDays?: number | null; asIs?: boolean | null } | null | undefined,
  shopDefaultDays: number | null | undefined,
): { days: WarrantyDays; asIs: boolean } {
  const asIs = !!listing?.asIs;
  if (asIs) return { days: 0, asIs: true };
  const own = listing?.warrantyDays;
  const days = normalizeWarrantyDays(own == null ? shopDefaultDays : own);
  return { days, asIs: false };
}

/** Short label for chips, e.g. "30-day warranty", "Sold as-is", "No warranty". */
export function warrantyLabel(days: number, asIs: boolean): string {
  if (asIs) return "Sold as-is — no returns";
  if (!days) return "No warranty";
  return `${days}-day warranty`;
}

/** Compute the warranty expiry from a base date (used on escrow release). */
export function warrantyExpiry(fromISO: string, days: number): string | null {
  if (!days) return null;
  const base = new Date(fromISO);
  if (Number.isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + days);
  return base.toISOString();
}
