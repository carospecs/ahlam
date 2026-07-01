// GROUNDED DESCRIPTIONS (pipeline Stage 5) — makes a listing stop contradicting itself.
//
// THE PROBLEM. The vision model scans each photo independently, so it describes the SAME
// car with a different body color on every panel: the driver door comes back "gray", the
// hood "bronze", the fender "metallic green". Each is defensible in its own frame (light,
// dirt, shadow, glare), but stitched into one listing they read like a parts-bin special.
// Separately, a part caught at the very edge of a frame — a sliver of a bumper, a headlight
// half out of shot — gets described with the same confident "clean, no damage" as a part
// shot dead-center, even though the camera barely saw it.
//
// We can't fix this in the prompt: each photo is a separate call with no memory of the
// others, and the model won't reliably self-assess how much of a part it actually saw. So
// this is a DETERMINISTIC CODE post-pass that runs once over the reconciled part list,
// AFTER dedup/parity and damage propagation, with the vehicle's single reconciled body
// color in hand. It applies two grounding rules and nothing else:
//
//   1. COLOR LOCK. There is exactly ONE body color for a car. For every painted exterior
//      body panel (and ONLY those), if the description names a body color that differs from
//      the locked one, swap it to the locked color. Glass, lights, mirrors, wheels/tires,
//      and every interior part are left alone — they legitimately have their own colors, so
//      recoloring a "green tint" windshield to "Silver" would be a new bug, not a fix.
//
//   2. HEDGING. A part the camera barely saw (a tiny detection box) or is unsure about
//      (low confidence) gets a one-line hedge appended so the listing doesn't overclaim a
//      condition it couldn't verify.
//
// DESIGN: CONSERVATIVE and NON-INVENTING. We never ADD a color to a panel that didn't
// mention one (absence of a stated color is not a contradiction to fix). We only ever
// REPLACE a color the model already committed to. The body-panel test is a tight allow-list
// of painted sheet metal; anything ambiguous (glass, trim, lamps) is treated as NON-body so
// its color is never touched. Both rules are idempotent — re-running over the output is a
// no-op — and the whole pass is pure (no input mutation).
//
// Companion to scan-qa.ts, which explicitly defers color-uniformity checking to this stage.

// The minimal shape this pass reads and rewrites — the spec's `Part`, a structural subset
// of the scanner's richer part object. `box` is a detection rectangle in frame fractions
// [x, y, w, h] (0–1); its w*h is how prominently the part appears. Callers pass their fuller
// objects straight through `groundDescriptions<T extends Part>` unchanged.
export type Part = {
  partName: string;
  description?: string;
  box?: [number, number, number, number];
  confidence?: "high" | "medium" | "low";
};

// The one-line hedge appended to a barely-seen part. Exported as a constant so the
// idempotency guard (don't append twice) and the unit tests reference the exact same
// string. Leading space lets it join cleanly onto any existing description.
export const HEDGE_NOTE = " Partially visible — condition not fully confirmed.";

// A part is "occluded/partial" when the camera barely saw it: its detection box covers less
// than this fraction of the frame. 2% is small enough that a squarely-photographed part
// clears it easily, but an edge sliver does not.
const OCCLUSION_AREA_THRESHOLD = 0.02;

// ─── PAINTED EXTERIOR BODY PANELS ────────────────────────────────────────────────
// These are the ONLY parts the color lock may touch: exterior sheet metal that wears the
// car's single body color. Matched against partName, case-insensitive.
//
// A door is subtle: the door SHELL is painted body color, but the parts mounted ON it —
// its glass/window, its handle, its interior trim panel — are NOT, and must keep their own
// color. So "Driver Side Front Door" is a body panel, while "Front Door Glass", "Door
// Window", "Door Handle", and "Door Panel" (interior trim) are excluded below.
const BODY_PANEL_PATTERNS: RegExp[] = [
  /\bfender\b/i,                                   // front/rear fender
  /\bhood\b/i,                                     // hood / bonnet
  /\bbumper\b/i,                                   // bumper cover (front/rear)
  /\bquarter\s?panel\b/i,                          // rear quarter panel
  /\btailgate\b/i,                                 // truck/SUV tailgate
  /\bliftgate\b/i,                                 // hatch / liftgate
  /\btrunk\s?(?:lid|deck)\b/i,                     // trunk lid / deck lid
  /\brocker(?:\s?panel)?\b/i,                      // rocker / sill panel
  /\broof\s?panel\b/i,                             // painted roof panel (not "roof rail"/"headliner")
  // DOOR SHELL — the painted door itself. Excludes the parts mounted on it (handled by the
  // NON_BODY guard below), so "Driver Side Front Door" matches but "Front Door Glass",
  // "Door Window", "Door Handle", and the interior "Door Panel" do not.
  /\bdoors?\b/i,
];

// Door-mounted / look-alike parts that contain a body-panel word ("door", "roof", "panel")
// but are NOT painted body color and must be excluded from the color lock. Checked BEFORE
// the panel patterns so it wins ties. Covers a door's glass/window/handle/interior trim,
// the roof's non-panel members, and the interior "door panel"/"trim panel".
const NON_BODY_OVERRIDE: RegExp[] = [
  /\b(?:window|glass|windshield|windscreen)\b/i,   // any glazing, incl. "door glass/window"
  /\bhandle\b/i,                                    // door handle
  /\b(?:door|trim|kick)\s?panel\b/i,               // interior door/trim/kick panel (not the shell)
  /\bmoulding|molding|trim\b/i,                     // trim strips / mouldings
  /\broof\s?(?:rail|rack|molding|moulding)\b/i,     // roof rail/rack, not the painted roof panel
  /\bheadliner\b/i,                                 // interior roof lining
];

// Parts that are categorically NOT body panels regardless of the above — glass, lamps,
// mirrors, wheels/tires, and obvious interior/mechanical items. Kept explicit so a future
// panel pattern can't accidentally start recoloring a headlight lens or a wheel.
const NEVER_BODY: RegExp[] = [
  /\b(?:windshield|windscreen|back\s?glass|rear\s?glass|quarter\s?glass|window|glass)\b/i,
  /\b(?:head|tail|fog|brake|marker|turn|signal)\s?(?:light|lamp)\b/i,
  /\b(?:light|lamp)\b/i,                            // any remaining lights (assembly, etc.)
  /\bmirror\b/i,
  /\b(?:wheel|tire|tyre|rim|hubcap|hub\s?cap)\b/i,
  /\b(?:dash|dashboard|seat|carpet|console|steering|airbag|engine|transmission)\b/i,
];

// TRUE when `partName` is a painted exterior body panel that wears the car's single body
// color. Exported so the classification is unit-testable in isolation, independent of the
// array transform.
//
// Order matters: the NEVER_BODY and NON_BODY_OVERRIDE exclusions are checked FIRST, so a
// name that contains both a panel word and an excluded word (e.g. "Front Door Glass",
// "Driver Side Headlight Assembly") is correctly classified NON-body.
export function isExteriorBodyPanel(partName: string): boolean {
  const name = partName ?? "";
  if (NEVER_BODY.some((re) => re.test(name))) return false;
  if (NON_BODY_OVERRIDE.some((re) => re.test(name))) return false;
  return BODY_PANEL_PATTERNS.some((re) => re.test(name));
}

// ─── VEHICLE BODY COLORS ─────────────────────────────────────────────────────────
// The common body-color adjectives the vision model emits. Multi-word colors ("army green",
// "dark gray") and finish-qualified colors ("metallic blue", "pearl white") are listed as a
// modifier + base so we can match and replace the WHOLE phrase — otherwise a naive "green"
// swap would turn "metallic green" into "metallic Silver", leaving a stray finish word.
//
// Order within the list is longest-first per base color so the regex prefers "army green"
// over "green" and "dark gray" over "gray" (alternation is greedy left-to-right).
const FINISHES = [
  "metallic",
  "pearl",
  "pearlescent",
  "matte",
  "gloss",
  "glossy",
  "satin",
  "candy",
  "dark",
  "light",
  "deep",
];

// Base color words. "grey" and "gray" are both listed. These form the tail of the phrase
// regex; each may be preceded by an optional finish/shade modifier from FINISHES, and a
// couple of inherently multi-word colors are spelled out explicitly.
const BASE_COLORS = [
  "white",
  "black",
  "silver",
  "gray",
  "grey",
  "red",
  "blue",
  "green",
  "gold",
  "bronze",
  "tan",
  "beige",
  "brown",
  "orange",
  "yellow",
  "maroon",
  "burgundy",
  "champagne",
  "charcoal",
  "navy",
  "teal",
  "purple",
  "pink",
];

// Inherently multi-word colors that aren't just "<finish> <base>". Listed longest-first.
const COMPOUND_COLORS = [
  "army green",
  "forest green",
  "olive green",
  "sky blue",
  "navy blue",
  "midnight blue",
  "off white",
  "off-white",
  "gunmetal gray",
  "gunmetal grey",
  "gun metal",
];

// Escape a literal for embedding in a RegExp.
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Build ONE case-insensitive, global, word-bounded regex that matches a body-color PHRASE:
// an optional finish/shade word ("metallic", "dark", …) followed by a base color, OR one of
// the explicit compound colors. Compounds and finish+base come first so the longest phrase
// wins before a bare base color can match a subset of it.
//
//   e.g. matches: "metallic green", "dark gray", "army green", "silver", "off-white"
const COLOR_PHRASE_RE = (() => {
  const finish = `(?:${FINISHES.map(esc).join("|")})`;
  const base = `(?:${BASE_COLORS.map(esc).join("|")})`;
  const compound = COMPOUND_COLORS.map(esc).join("|");
  // Optional finish (with a space) + base  |  compound  |  bare base.
  const phrase = `(?:${compound})|(?:${finish}\\s+${base})|(?:${base})`;
  return new RegExp(`\\b(?:${phrase})\\b`, "gi");
})();

// Does `text` name a body color OTHER than `locked`? Used to decide whether a panel even
// needs rewriting (skip the work — and keep the original reference — when it doesn't).
function mentionsConflictingColor(text: string, locked: string): boolean {
  const lockedLc = locked.trim().toLowerCase();
  COLOR_PHRASE_RE.lastIndex = 0;
  for (const m of text.matchAll(COLOR_PHRASE_RE)) {
    if (m[0].toLowerCase() !== lockedLc) return true;
  }
  return false;
}

// Replace every body-color phrase in `text` that differs from `locked` with `locked`,
// preserving the surrounding text exactly. A phrase already equal to the locked color is
// left untouched (so the pass is idempotent and doesn't churn casing needlessly).
function swapColors(text: string, locked: string): string {
  const lockedLc = locked.trim().toLowerCase();
  return text.replace(COLOR_PHRASE_RE, (match) =>
    match.toLowerCase() === lockedLc ? match : locked,
  );
}

// Detection-box area in [0,1], or null when there's no usable box. The box is
// [x0,y0,x1,y1] CORNER coordinates (matching the scanner), so area = (x1-x0)*(y1-y0).
// Guards against malformed/inverted boxes by treating them as "no box" rather than area 0
// — a bad box shouldn't silently hedge a well-seen part.
function boxArea(box: Part["box"]): number | null {
  if (!Array.isArray(box) || box.length !== 4) return null;
  const [x0, y0, x1, y1] = box;
  if (![x0, y0, x1, y1].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const w = x1 - x0, h = y1 - y0;
  if (w < 0 || h < 0) return null;
  return w * h;
}

// A part is occluded/partial when the camera barely saw it: a valid box under the area
// threshold, OR an explicit low confidence. (No box at all is NOT treated as occluded —
// absence of a box is unknown prominence, not proof of a sliver.)
function isOccluded(part: Part): boolean {
  if (part.confidence === "low") return true;
  const area = boxArea(part.box);
  return area !== null && area < OCCLUSION_AREA_THRESHOLD;
}

// GROUND the descriptions of a reconciled part list.
//
// For each part, in order:
//   1. COLOR LOCK — only when `opts.bodyColor` is set AND the part is an exterior body
//      panel: replace any body-color adjective in the description that differs from the
//      locked color. A panel that names no color, or already names the locked color, is
//      left as-is; a non-body part is never touched.
//   2. HEDGING — if the part is occluded/partial (tiny box or low confidence), ensure the
//      description ends with HEDGE_NOTE, appended exactly once.
//
// PURE: never mutates the input — returns a new array; a part that needs no change is
// returned as its original reference, and any changed part is a fresh shallow copy.
// IDEMPOTENT: re-running over the output is a no-op — colors already locked don't change,
// and the hedge is only appended when not already present.
export function groundDescriptions<T extends Part>(
  parts: T[],
  opts: { bodyColor?: string | null },
): T[] {
  if (!Array.isArray(parts)) return parts;
  const bodyColor = opts?.bodyColor?.trim() || null;

  return parts.map((part) => {
    let description = part.description;
    let changed = false;

    // 1) COLOR LOCK — body panels only, and only when a color is locked.
    if (
      bodyColor &&
      typeof description === "string" &&
      description.length > 0 &&
      isExteriorBodyPanel(part.partName) &&
      mentionsConflictingColor(description, bodyColor)
    ) {
      description = swapColors(description, bodyColor);
      changed = true;
    }

    // 2) HEDGING — barely-seen parts get a one-line hedge, appended once.
    if (isOccluded(part)) {
      const current = description ?? "";
      if (!current.includes(HEDGE_NOTE.trim())) {
        description = `${current}${HEDGE_NOTE}`.replace(/^\s+/, "");
        changed = true;
      }
    }

    return changed ? { ...part, description } : part;
  });
}
