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
