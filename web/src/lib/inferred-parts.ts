// Phantom / inferred-part guard for the AI salvage scanner.
//
// THE PROBLEM. The vision model is told to catalog only what it can directly see
// (see the `visiblyPresent` rule in /api/identify), but it still occasionally lists
// a part that is physically hidden inside trim and is essentially never directly
// visible in ordinary exterior + interior photos — classically an AIRBAG, which
// sits sealed behind the steering-wheel hub or dashboard. The model nonetheless
// ships it with a firm price and a "restricted part" warning, which is misleading:
// the seller is being told to price something the camera never actually saw.
//
// We tried asking the model to self-report visibility and it won't reliably comply,
// so this is a DETERMINISTIC CODE rule: for a tiny, well-justified set of
// "rarely-directly-visible" part types we mark the part `inferred = true`, drop its
// firm price to null, and append a verify-before-listing note — UNLESS the seller's
// own text says the part is actually exposed (deployed / removed / on the bench…),
// in which case it is a genuinely observed part and we leave it alone.
//
// DESIGN: CONSERVATIVE. This list is deliberately TIGHT. We only flag parts that are
// almost never sellable-as-seen from normal photos unless specially exposed. A plain
// seat belt, a steering wheel, a dashboard, a door — all routinely visible — are NOT
// here. Only the hidden pyrotechnic / occluded restraint modules are. False positives
// (nulling the price on a part the model really did see) are worse than the occasional
// miss, so when in doubt we do NOT flag.
//
// This is intentionally separate from the compliance flag in /api/identify: compliance
// asks "is this part legally restricted to resell?" (a plain seat belt IS), whereas
// this asks "did the camera actually see it, or did the model infer it?" — a much
// narrower set. A part can be one, both, or neither.

// The minimal note appended to a part once it is marked inferred. Kept as a constant
// so the idempotency guard (don't append twice) and the unit test reference the exact
// same string. Leading space lets it join cleanly onto any existing conditionNotes.
export const INFERRED_NOTE =
  " Inferred — not directly visible in the photos; verify it is actually present before listing.";

// ── "Rarely-directly-visible" part types ────────────────────────────────────
// Matched against partName, case-insensitive, on WORD BOUNDARIES (so "airbag"
// does not fire on some unrelated substring). Each entry is commented with WHY it
// belongs — these are parts sealed inside trim that the scanner infers rather than
// sees. Keep this list TIGHT; add a type only when it is genuinely almost never
// directly visible/sellable from ordinary exterior + interior photos.
const RARELY_VISIBLE_PATTERNS: RegExp[] = [
  // Airbags / SRS / inflators: sealed behind the steering-wheel hub, dash trim,
  // seat bolster, or headliner. Not visible in a normal interior photo. Covers
  // "airbag", "air bag", the "SRS" system label, and the "inflator" module itself.
  /\bair\s?bags?\b/i,
  /\bsrs\b/i,
  /\binflators?\b/i,
  // Knee bolster AIRBAG: the airbag tucked behind the lower-dash knee bolster
  // panel. (The plain knee bolster trim panel is a visible cosmetic part and is
  // intentionally NOT matched — only the airbag variant is hidden/inferred.)
  /\bknee\s?bolster\s?air\s?bags?\b/i,
  // Seat-belt PRETENSIONER / restraint MODULE only — the pyrotechnic charge built
  // into the belt buckle/anchor, hidden inside the B-pillar or seat. A PLAIN SEAT
  // BELT is routinely visible and is NOT flagged: this pattern requires the word
  // "pretensioner" (or an explicit "... restraint module"), never a bare "seat belt".
  /\bpretensioners?\b/i,
  /\brestraint\s?modules?\b/i,
];

// Seller text that proves the part IS actually exposed / out where the camera could
// see it. When the part's description or conditionNotes matches this, we treat it as a
// genuinely observed part and DON'T mark it inferred (e.g. "airbag deployed, sitting on
// the bench" — that one really is visible and sellable as a core). Mirrors the wording
// in the spec: deployed | removed | exposed | visible | pulled | out of | in hand |
// on (the) bench/ground.
const EXPOSED_PATTERN =
  /\b(?:deployed|removed|exposed|visible|pulled|out of|in hand|on (?:the )?(?:bench|ground))\b/i;

// True when `partName` is one of the rarely-directly-visible types AND the supplied
// notes do NOT indicate it is exposed. Exported so the matching logic is unit-testable
// in isolation, independent of the array transform.
export function isLikelyInferred(partName: string, notes?: string): boolean {
  const name = partName ?? "";
  const isRarelyVisible = RARELY_VISIBLE_PATTERNS.some((re) => re.test(name));
  if (!isRarelyVisible) return false;
  // Exposed → genuinely observed; not inferred.
  if (notes && EXPOSED_PATTERN.test(notes)) return false;
  return true;
}

// The part shape this module operates on. A structural subset of the scanner's
// AIPartOutput (route.ts) — only the fields we read or write — so callers can pass
// their richer part objects through `markInferredParts<T extends Part>` unchanged.
export type Part = {
  partName: string;
  condition: "A" | "B" | "C";
  conditionNotes?: string;
  description?: string;
  suggestedPriceUsd: number | null;
  inferred?: boolean;
};

// Mark phantom / inferred parts in a scan result.
//
// For each part whose type is rarely directly visible and whose own text does NOT say
// it is exposed, we:
//   1. set `inferred = true`,
//   2. append INFERRED_NOTE to `conditionNotes`.
// Everything else is left exactly as-is.
//
// PRICING NOTE: inferred parts KEEP their price. Powertrain and other high-value parts
// are frequently invisible in exterior photos yet are among the most valuable parts on
// the car (a BEV's battery pack, a sedan's engine) — dropping the price because the
// camera didn't see them is how a Model X ships with an unpriced battery pack. The
// "inferred — verify" flag is the safeguard; the price stays so the seller starts from
// a real number instead of a blank.
//
// PURE: never mutates the input — returns a new array of new objects (untouched parts
// are returned as fresh shallow copies too, so the caller's array is fully independent).
// IDEMPOTENT: re-running over its own output is a no-op — the note is only appended when
// it is not already present.
export function markInferredParts<T extends Part>(parts: T[]): T[] {
  return parts.map((part) => {
    if (!isLikelyInferred(part.partName, `${part.description ?? ""} ${part.conditionNotes ?? ""}`)) {
      // Not an inferred type (or it's exposed) — pass through as a fresh copy.
      return { ...part };
    }
    const notes = part.conditionNotes ?? "";
    // Idempotency: only append the note once, even across repeated runs.
    const conditionNotes = notes.includes(INFERRED_NOTE.trim())
      ? notes
      : `${notes}${INFERRED_NOTE}`.replace(/^\s+/, "");
    return {
      ...part,
      inferred: true,
      conditionNotes,
    };
  });
}
