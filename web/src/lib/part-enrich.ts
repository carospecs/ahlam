// VIN-confirmed engine enrichment — shared by the scan route (per-photo, /api/identify)
// and the scan aggregator (cross-photo, AddVehicle). The VIN decode is ground truth
// for the engine, so when we know it we OVERRIDE the vision model's visual guess in
// the engine part's title and description, rather than letting a wrong "2.4L inline-4"
// sit beside the VIN spec and contradict it.
//
// Why two callers: each photo is scanned independently, and the VIN (windshield /
// door-jamb) is almost never in the same frame as the engine bay. The server can only
// enrich when a single photo holds both; the aggregator applies the VIN engine — pooled
// across all of a vehicle's photos — down onto the engine part that came from a
// different, VIN-less shot.
import { type ConditionGrade } from "@/lib/age-pricing";
import { gradeAdjustUsed } from "@/lib/used-pricing";

// The engine itself — NOT "Engine Mount"/"Engine Cover"/"Engine Wiring Harness", which
// are distinct parts. `baseName` is the part name with any prior "— spec" suffix removed.
export function isEnginePart(baseName: string): boolean {
  return /^engine( assembly| motor| long block| short block)?$/i.test(baseName.trim());
}

// Strip DISPLACEMENT and CYLINDER-CONFIG claims the vision model guessed from a photo
// (e.g. "2.4L", "inline-4", "V6", "4-cyl") so the VIN-confirmed engine is the ONLY spec
// left in the description and nothing contradicts it. Everything else the model observed
// (condition, leaks, accessories) is intentionally left intact.
export function scrubEngineSpecs(text: string): string {
  if (!text) return "";
  return text
    .replace(/\b\d(?:\.\d)?\s?-?\s?(?:l\b|liters?\b|litres?\b)/gi, "")  // 2.4L, 2.4-liter
    .replace(/\b\d{3,4}\s?cc\b/gi, "")                                  // 2400cc
    .replace(/\bV[\s-]?\d{1,2}\b/gi, "")                                // V6, V-8
    .replace(/\b(?:inline|straight|flat)[\s-]?(?:\d{1,2}|two|three|four|five|six|eight|ten|twelve)\b/gi, "") // inline-4, straight-six
    .replace(/\bI[\s-]?[3-9]\b/g, "")                                   // I4, I-6 config
    .replace(/\b(?:\d{1,2}|two|three|four|five|six|eight|ten|twelve)[\s-]?cyl(?:inder)?s?\b/gi, "") // 4-cyl, four cylinder
    .replace(/\(\s*[,;]?\s*\)/g, "")                                    // empty () left behind
    .replace(/\b(?:a|an)\s+(engine|motor|powerplant)\b/gi, "$1")        // fix dangling article a scrub left
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;])/g, "$1")
    .replace(/^[\s,;.\-–—]+/, "")
    .trim();
}

// Apply the VIN-confirmed engine to an engine part's name + description. Idempotent:
// safe to run again (e.g. the server enriched a same-photo scan, then the aggregator
// re-applies across photos) because it strips any prior "VIN-confirmed engine:" lead
// before rebuilding. Returns the part unchanged when it isn't the engine, or when no
// engine spec is known.
export function applyVinEngine<T extends { partName: string; description: string }>(
  part: T,
  engine: string | null | undefined,
  drivetrain?: string | null,
): T {
  if (!engine) return part;
  const base = part.partName.replace(/\s*—.*$/, "").trim(); // drop any prior "— spec"
  if (!isEnginePart(base)) return part;
  const drive = drivetrain ? `, ${drivetrain}` : "";
  const lead = `VIN-confirmed engine: ${engine}${drive}.`;
  // Strip a prior lead first so re-runs neither stack it nor scrub its own spec.
  const prior = part.description.replace(/^\s*VIN-confirmed engine:.*?\.(?=\s|$)/i, "");
  const notes = scrubEngineSpecs(prior);
  return { ...part, partName: `Engine — ${engine}`, description: notes ? `${lead} ${notes}` : lead };
}

// Remove a left/right/driver/passenger side word from a part name. The "(?!…mirror)"
// guard keeps the "Side" of "Side Mirror" so "Driver Side Mirror" → "Side Mirror"
// (matching the bare catalog name), which lets pairs group correctly.
export function stripSide(name: string): string {
  return name
    .replace(/\b(driver'?s?|passenger'?s?)(?:[ -]side(?!\s+mirror\b))?\b/gi, "")
    .replace(/\b(left|right|lh|rh)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// L/R PRICE PARITY. A part's used-market base price is identical for the driver and
// passenger side — only condition differs — but the model often guesses the two sides
// at different prices, so paired parts of the SAME grade show different prices. For
// each genuine left+right pair, agree on ONE used base (the higher-confidence side;
// ties go to the larger number so we never lowball), then re-apply EACH side's own
// grade factor. Result: equal grades → identical price; different grades → still differ.
export function reconcilePairPrices<
  T extends { partName: string; condition: string; confidence?: "high" | "medium" | "low"; usedPartPriceUsd?: number | null; suggestedPriceUsd: number | null },
>(parts: T[]): T[] {
  const confRank = (c?: string) => (c === "high" ? 2 : c === "low" ? 0 : 1);
  const sideOf = (name: string): "L" | "R" | null =>
    /\b(passenger|right|rh)\b/i.test(name) ? "R" : /\b(driver|left|lh)\b/i.test(name) ? "L" : null;

  // Group sided parts by their base name (side removed). Unsided/center parts are skipped.
  const groups = new Map<string, T[]>();
  for (const p of parts) {
    const base = stripSide(p.partName).toLowerCase().trim();
    if (!base || base === p.partName.toLowerCase().trim()) continue;
    const g = groups.get(base);
    if (g) g.push(p); else groups.set(base, [p]);
  }

  const shared = new Map<T, number>();
  for (const members of groups.values()) {
    const priced = members.filter((m) => typeof m.usedPartPriceUsd === "number" && (m.usedPartPriceUsd as number) > 0);
    if (priced.length < 2) continue;
    if (new Set(priced.map((m) => sideOf(m.partName))).size < 2) continue; // need both sides present
    const consensus = priced.slice().sort(
      (a, b) => confRank(b.confidence) - confRank(a.confidence) || (b.usedPartPriceUsd as number) - (a.usedPartPriceUsd as number),
    )[0].usedPartPriceUsd as number;
    for (const m of priced) shared.set(m, consensus);
  }
  if (!shared.size) return parts;

  return parts.map((p) => {
    const np = shared.get(p);
    if (np == null) return p;
    const grade: ConditionGrade = (["A", "B", "C"] as const).includes(p.condition as ConditionGrade) ? (p.condition as ConditionGrade) : "B";
    return { ...p, usedPartPriceUsd: np, suggestedPriceUsd: gradeAdjustUsed(np, grade) };
  });
}

// Drop a generic (unsided) part when a sided sibling exists — e.g. a stray "Front Seat"
// next to "Driver Side Front Seat". Generalizes the old lateral-only rule to ANY part
// type (seats, etc.): the system only ever adds a side to a genuinely sidable part
// (center parts never get one), so the mere presence of a sided sibling proves the
// unsided entry is a phantom of the same physical part. Runs across photos.
export function dropGenericWhenSided<T extends { partName: string }>(parts: T[]): T[] {
  const isSided = (name: string) => stripSide(name).toLowerCase().trim() !== name.toLowerCase().trim();
  const groups = new Map<string, T[]>();
  for (const p of parts) {
    const base = stripSide(p.partName).toLowerCase().trim();
    const g = groups.get(base);
    if (g) g.push(p); else groups.set(base, [p]);
  }
  const drop = new Set<T>();
  for (const members of groups.values()) {
    if (members.length < 2 || !members.some((m) => isSided(m.partName))) continue;
    for (const m of members) if (!isSided(m.partName)) drop.add(m); // unsided sibling = phantom
  }
  return parts.filter((p) => !drop.has(p));
}
