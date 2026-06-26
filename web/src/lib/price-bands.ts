// Static used-OEM price bands.
//
// The AI scan no longer prices from these — it uses the deterministic age ×
// condition model in ./age-pricing.ts. These bands now serve two narrower roles:
//   • floorPrice — a positive, band-sane floor when SAVING a listing
//     (/api/listings).
//   • isSanePrice — a sanity gate on the manual grounded-search live lookup
//     (pricing.ts).
// DEFAULT_BANDS are the original training-era anchors; the recalibration job
// (scripts/recalibrate-bands.mjs) overwrites ./price-bands.generated.ts with
// fresh numbers that take precedence.
import { GENERATED_BANDS, GENERATED_AT } from "./price-bands.generated";

export interface PriceBand {
  low: number;
  high: number;
}

// A part whose model price exceeds high * this multiple is treated as an absurd
// outlier (hallucinated five-figure fender) and capped. The multiple is generous
// so genuine luxury / low-supply parts keep their headroom above the band.
export const CEILING_MULTIPLE = 4;

// Below this fraction of the band floor, a "comp" is too cheap to be the same
// part (a bolt, a bracket, a wrong-item listing) and is rejected as unreliable.
const FLOOR_SANITY_FRACTION = 0.3;

// Training-era anchors (mirrors the bands that used to live hard-coded in the
// vision prompt). Keyed by canonical part type; matched to free-form part names
// by BAND_MATCHERS below. Bands are for a popular, modern vehicle in good shape.
export const DEFAULT_BANDS: Record<string, PriceBand> = {
  door: { low: 500, high: 1200 },
  hood: { low: 250, high: 700 },
  fender: { low: 200, high: 500 },
  bumper: { low: 200, high: 700 },
  quarter_panel: { low: 400, high: 900 },
  headlight: { low: 150, high: 500 },
  taillight: { low: 80, high: 300 },
  mirror: { low: 120, high: 350 },
  wheel: { low: 120, high: 400 },
  tire: { low: 40, high: 150 },
  glass: { low: 150, high: 500 },
  engine: { low: 1000, high: 4000 },
  transmission: { low: 700, high: 2500 },
  alternator: { low: 80, high: 250 },
  starter: { low: 80, high: 250 },
  ac_compressor: { low: 120, high: 350 },
  // Used catalytic converters span scrap-core value to full OEM units; wide band
  // keeps a sane floor without capping a high-value OEM cat. (AHLAM-56)
  catalytic_converter: { low: 75, high: 900 },
};

// Recalibrated bands win over defaults; anything the job didn't cover keeps its
// training-era anchor so a part type is never left without a band.
export const BANDS: Record<string, PriceBand> = { ...DEFAULT_BANDS, ...GENERATED_BANDS };

// True once the recalibration job has run at least once (Layer 1 is live).
export const bandsRecalibratedAt: string | null = GENERATED_AT;

// Ordered most-specific-first: the first matcher that hits wins. Negative
// look-behinds aren't used; instead the specific keys (quarter_panel, glass,
// door) precede the generic ones so e.g. "Rear Door Window" matches glass, not
// door. Human-readable label is used to render the prompt block.
interface Matcher {
  key: keyof typeof BANDS | string;
  label: string;
  re: RegExp;
}
const BAND_MATCHERS: Matcher[] = [
  { key: "glass", label: "Windshield / glass", re: /\b(windshield|windscreen|back ?glass|rear ?glass|quarter ?glass|window)\b/i },
  { key: "quarter_panel", label: "Quarter panel", re: /\bquarter ?panel\b/i },
  { key: "headlight", label: "Headlight assembly", re: /\bhead ?light\b/i },
  { key: "taillight", label: "Tail light", re: /\btail ?light\b/i },
  { key: "mirror", label: "Side mirror", re: /\bside ?mirror\b/i },
  { key: "catalytic_converter", label: "Catalytic converter", re: /\bcataly(tic|st)\b|\bcatalytic ?converter\b/i },
  { key: "bumper", label: "Bumper cover", re: /\bbumper\b/i },
  { key: "hood", label: "Hood", re: /\bhood\b/i },
  { key: "fender", label: "Fender", re: /\bfender\b/i },
  { key: "door", label: "Door (shell)", re: /\bdoor\b/i },
  { key: "tire", label: "Tire", re: /\b(tire|tyre)\b/i },
  { key: "wheel", label: "Wheel / Rim", re: /\b(wheel|rim)\b/i },
  { key: "transmission", label: "Transmission", re: /\b(transmission|gearbox)\b/i },
  { key: "engine", label: "Engine", re: /\bengine\b/i },
  { key: "alternator", label: "Alternator", re: /\balternator\b/i },
  { key: "starter", label: "Starter", re: /\bstarter\b/i },
  { key: "ac_compressor", label: "AC compressor", re: /\b(a\/?c )?compressor\b/i },
];

// Map a free-form part name (e.g. "Front Left Door") to its band, or null when
// the part type isn't one we have an anchor for.
export function bandFor(partName: string): PriceBand | null {
  for (const m of BAND_MATCHERS) {
    if (m.re.test(partName)) return BANDS[m.key] ?? null;
  }
  return null;
}

// Layer 2 constraint: clamp a model price into its band. The floor is enforced
// strictly (never undercut the recalibrated market); the ceiling is only a guard
// against absurd outliers, leaving luxury headroom up to CEILING_MULTIPLE×high.
// Parts with no band, or a null price, pass through untouched.
export function clampToBand(price: number | null, partName: string): number | null {
  if (price == null || !Number.isFinite(price)) return price;
  const band = bandFor(partName);
  if (!band) return price;
  if (price < band.low) return band.low;
  const ceiling = band.high * CEILING_MULTIPLE;
  if (price > ceiling) return ceiling;
  return price;
}

// A conservative catch-all band for part types we have no specific anchor for
// (interior trim, consoles, seat belts, etc.). Guarantees even an unrecognized
// part gets a sane positive floor, so nothing is ever posted at $0 (AHLAM-51).
export const DEFAULT_BAND: PriceBand = { low: 40, high: 160 };

// Round a fallback price to a realistic-looking number (nearest $5, min $5),
// matching the prompt's "use realistic round numbers" guidance. Only applied to
// computed fallbacks — a genuine in-range market/model price is left as-is.
function roundFallback(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5);
}

// Final price GUARANTEE (AHLAM-51): every part gets a positive, band-sane price.
// Unlike clampToBand (which passes null/unbanded prices straight through), this
// never returns null or <= 0:
//   • missing / zero / negative estimate  → middle of the part's band (fair
//     market, no undercut), using DEFAULT_BAND when the type has no anchor;
//   • below the band floor                → floored to the band low;
//   • absurd outlier above the ceiling    → capped at CEILING_MULTIPLE × high.
// An in-range price is returned unchanged so existing good prices are untouched.
export function floorPrice(price: number | null | undefined, partName: string): number {
  const band = bandFor(partName) ?? DEFAULT_BAND;
  if (price == null || !Number.isFinite(price) || price <= 0) {
    return roundFallback((band.low + band.high) / 2);
  }
  if (price < band.low) return roundFallback(band.low);
  const ceiling = band.high * CEILING_MULTIPLE;
  if (price > ceiling) return roundFallback(ceiling);
  return price;
}

// Sanity gate for an externally-sourced price (Layer 4 grounded search): reject
// values that fall below FLOOR_SANITY_FRACTION×floor or above the outlier
// ceiling, since those almost certainly aren't comps for this part. Parts with
// no band are accepted as long as the price is positive.
export function isSanePrice(price: number, partName: string): boolean {
  if (!Number.isFinite(price) || price <= 0) return false;
  const band = bandFor(partName);
  if (!band) return true;
  return price >= band.low * FLOOR_SANITY_FRACTION && price <= band.high * CEILING_MULTIPLE;
}

// Render the bands as the prompt's "TYPICAL USED-OEM PRICE BANDS" block, so
// Layer 2's guidance reflects the recalibrated (not frozen) numbers.
export function bandsPromptBlock(): string {
  const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
  const lines = BAND_MATCHERS
    // de-dupe by band key (matchers like starter/alternator share a value but
    // each gets its own line; keys are already distinct here)
    .map((m) => {
      const b = BANDS[m.key];
      return b ? `  - ${m.label}: ${usd(b.low)}–${usd(b.high)}` : null;
    })
    .filter(Boolean)
    .join("\n");
  const provenance = GENERATED_AT
    ? `(recalibrated from live eBay comps on ${GENERATED_AT.slice(0, 10)})`
    : `(training-era anchors — recalibration job has not run yet)`;
  return (
    `TYPICAL USED-OEM PRICE BANDS ${provenance} — a modern, popular vehicle in "Good" condition. ` +
    `Anchor near the MIDDLE of these; a single mainstream-car part is rarely worth under ~$150:\n` +
    lines +
    `\n  These are ballparks for popular models — adjust up for luxury/low-supply, down only for genuine damage ("Poor"). NEVER undercut the bottom of the band for a "Good" part.`
  );
}
