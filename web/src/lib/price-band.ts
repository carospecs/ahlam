// PRICE CONFIDENCE BAND — the low→high range rendered under each part's price field.
//
// Preferred source: the pricing model's own uncertainty range (newPartPriceLow/HighUsd,
// grade-discounted server-side into suggestedPriceLow/HighUsd). When the model didn't
// return one (older scans, manual rows), fall back to a band derived from the part's
// confidence: tight when the scan was sure, wide when it flagged the part for review —
// so the 9 "Review" parts read as wide amber bands without any new model data.

export type BandConfidence = "high" | "medium" | "low";

export type PriceBandRange = { low: number; high: number };

// Fallback half-widths per confidence, as a fraction of the expected price.
export const FALLBACK_SPREAD: Record<BandConfidence, number> = {
  high: 0.10,
  medium: 0.20,
  low: 0.35,
};

// Derive a band around an expected price from confidence alone.
export function fallbackBand(expected: number, confidence: BandConfidence): PriceBandRange {
  const spread = FALLBACK_SPREAD[confidence] ?? FALLBACK_SPREAD.low;
  return {
    low: Math.max(0, Math.round(expected * (1 - spread))),
    high: Math.round(expected * (1 + spread)),
  };
}

// Resolve the band for a part: the model's own range when present (and sane),
// otherwise the confidence fallback around the AI's original estimate. Returns
// null when there is nothing to anchor a band to (unpriced / Grade C / manual row).
export function bandFor(p: {
  suggestedPriceLowUsd?: number | null;
  suggestedPriceHighUsd?: number | null;
  confidence?: BandConfidence;
  _aiPrice?: number | null;
}): PriceBandRange | null {
  const lo = p.suggestedPriceLowUsd, hi = p.suggestedPriceHighUsd;
  if (typeof lo === "number" && typeof hi === "number" && lo > 0 && hi > lo) return { low: lo, high: hi };
  const anchor = p._aiPrice;
  if (typeof anchor !== "number" || anchor <= 0) return null;
  const band = fallbackBand(anchor, p.confidence ?? "low");
  return band.high > band.low ? band : null;
}

// Where a price sits along the band, clamped 0–1 (for the marker position).
export function bandFraction(band: PriceBandRange, price: number): number {
  if (band.high <= band.low) return 0.5;
  return Math.min(1, Math.max(0, (price - band.low) / (band.high - band.low)));
}

// The price at a given fraction along the band (for drag → price).
export function priceAtFraction(band: PriceBandRange, frac: number): number {
  const f = Math.min(1, Math.max(0, frac));
  return Math.round(band.low + f * (band.high - band.low));
}

// Round to the nearest yard-friendly figure: $25 steps under $500, $50 above.
// (Yards price in round numbers; the AI outputs odd figures like $723.)
export function roundYardPrice(price: number): number {
  const step = price >= 500 ? 50 : 25;
  return Math.max(step, Math.round(price / step) * step);
}
