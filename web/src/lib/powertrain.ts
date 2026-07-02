// POWERTRAIN TYPING — classify the vehicle's powertrain BEFORE pricing, and make
// every downstream pricing decision branch on it.
//
// WHY. The set of valuable parts differs completely by type: a gas car has an engine,
// transmission, fuel system, exhaust, and catalytic converter(s); a BEV has NONE of
// those and instead has a high-voltage battery pack, drive unit(s), an onboard
// charger, and an inverter/DC-DC — typically the single most valuable recoverable
// items on the car. Before this module, the scanner could list a catalytic converter
// on a Tesla and leave the battery pack unpriced because it wasn't in a photo.
//
// Classification sources, most→least authoritative:
//   1. NHTSA VIN decode (Electrification Level / Fuel Type fields) — ground truth.
//   2. Known-EV/hybrid make/model names — deterministic heuristic for VIN-less scans.
//   3. Default "ice" — statistically right for salvage; the appended powertrain parts
//      are always flagged "inferred — verify", so a rare misclassification surfaces
//      to the human instead of silently corrupting the listing.

export type PowertrainType = "ice" | "hybrid" | "bev";

export type PowertrainInfo = {
  type: PowertrainType;
  source: "vin" | "model" | "default"; // how confident the classification is
};

// Makes that sell ONLY battery-electric vehicles.
const BEV_MAKES = /\b(tesla|rivian|lucid|polestar|fisker|vinfast)\b/i;

// Model names that are BEVs regardless of make.
const BEV_MODELS =
  /\b(model\s?[s3xy]|cybertruck|bolt|leaf|ariya|ioniq\s?[56]|id\.?\s?4|id\.?\s?buzz|mach-?e|e-?tron|i[34x]\b|ix\b|taycan|ev[69]\b|lyriq|blazer\s?ev|equinox\s?ev|silverado\s?ev|hummer\s?ev|lightning|solterra|bz4x)\b/i;

// Model names that are hybrids (incl. plug-in) regardless of trim wording.
const HYBRID_MODELS = /\b(prius|insight|ct200h|niro(?!\s?ev)|volt\b|clarity|crosstrek\s?hybrid)\b/i;

// Classify from whatever identity we have. NHTSA fields win outright; the name
// heuristics cover VIN-less visual scans; everything else defaults to ICE.
export function classifyPowertrain(v: {
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  fuelType?: string | null;            // NHTSA "Fuel Type - Primary"
  fuelTypeSecondary?: string | null;   // NHTSA "Fuel Type - Secondary"
  electrificationLevel?: string | null; // NHTSA "Electrification Level"
}): PowertrainInfo {
  const elec = (v.electrificationLevel || "").toLowerCase();
  const fuel = (v.fuelType || "").toLowerCase();
  const fuel2 = (v.fuelTypeSecondary || "").toLowerCase();

  // 1 · NHTSA decode fields (ground truth).
  if (elec.includes("bev") || elec.includes("fcev")) return { type: "bev", source: "vin" };
  if (elec.includes("hev") || elec.includes("hybrid")) return { type: "hybrid", source: "vin" };
  if (fuel.includes("electric")) {
    // Electric primary + a combustion secondary = plug-in hybrid; alone = BEV.
    return { type: fuel2 && !fuel2.includes("electric") ? "hybrid" : "bev", source: "vin" };
  }
  if (fuel && fuel2.includes("electric")) return { type: "hybrid", source: "vin" };
  if (fuel.includes("gasoline") || fuel.includes("diesel") || fuel.includes("flex")) {
    return { type: "ice", source: "vin" };
  }

  // 2 · Known EV/hybrid names.
  const name = `${v.make ?? ""} ${v.model ?? ""} ${v.trim ?? ""}`;
  if (BEV_MAKES.test(name) || BEV_MODELS.test(name)) return { type: "bev", source: "model" };
  if (HYBRID_MODELS.test(name) || /\b(hybrid|phev)\b/i.test(name)) return { type: "hybrid", source: "model" };

  // 3 · Default.
  return { type: "ice", source: "default" };
}

// ── Part existence rules ─────────────────────────────────────────────────────

// Parts that CANNOT exist on a BEV. A 12V "Battery" is valid on every powertrain and
// intentionally does not match. Radiators stay allowed (EVs have coolant loops).
const BEV_IMPOSSIBLE =
  /\b(engine|transmission|catalytic\s?converter|exhaust|muffler|fuel\s?(pump|tank|injector|rail|filter)|alternator|starter|spark\s?plug|oil\s?pan|timing\s?(belt|chain))\b/i;

// Parts that cannot exist on a pure combustion vehicle.
const ICE_IMPOSSIBLE =
  /\b(high.?voltage\s?battery|hv\s?battery|traction\s?battery|battery\s?pack|drive\s?unit|onboard\s?charger|dc.?dc\s?converter|charge\s?port)\b/i;

// Would this part be a hallucination for the detected powertrain? Never emit these.
export function isImpossiblePart(partName: string, type: PowertrainType): boolean {
  if (type === "bev") return BEV_IMPOSSIBLE.test(partName);
  if (type === "ice") return ICE_IMPOSSIBLE.test(partName);
  return false; // hybrids legitimately carry parts from both lists
}

// One line for the vision prompt so the model never lists impossible parts either.
export function powertrainPromptLine(type: PowertrainType): string {
  if (type === "bev") {
    return (
      "POWERTRAIN: this vehicle is a BATTERY-ELECTRIC vehicle (BEV). It has NO engine, transmission, " +
      "fuel system, exhaust, or catalytic converter — NEVER list any of those. Its highest-value parts are the " +
      "high-voltage battery pack, drive unit(s)/motor(s), onboard charger, and inverter/DC-DC converter."
    );
  }
  if (type === "hybrid") {
    return (
      "POWERTRAIN: this vehicle is a HYBRID. It has BOTH combustion parts (engine, exhaust, catalytic converter) " +
      "AND electric parts (hybrid battery pack, inverter). Both sets are sellable and valuable."
    );
  }
  return "POWERTRAIN: this vehicle has an internal-combustion powertrain (engine, transmission, fuel system, exhaust, catalytic converter).";
}

// ── Expected high-value powertrain parts ─────────────────────────────────────

export type ExpectedPart = { partName: string; partCategory: string; description: string };

// The core high-value parts every vehicle of this type HAS, photographed or not.
// These are appended as "inferred — verify" (and priced) when the scan didn't see them.
export function expectedPowertrainParts(type: PowertrainType, opts?: { awd?: boolean }): ExpectedPart[] {
  if (type === "bev") {
    const parts: ExpectedPart[] = [
      { partName: "High-Voltage Battery Pack", partCategory: "Mechanical", description: "High-voltage traction battery pack. Typically the single most valuable recoverable part on a BEV." },
      { partName: "Rear Drive Unit (Motor)", partCategory: "Mechanical", description: "Rear electric drive unit — motor, gearbox, and inverter assembly." },
      { partName: "Onboard Charger", partCategory: "Mechanical", description: "Onboard AC charging module." },
      { partName: "Inverter / DC-DC Converter", partCategory: "Mechanical", description: "Power electronics — inverter and DC-DC converter." },
    ];
    if (opts?.awd) parts.splice(2, 0, { partName: "Front Drive Unit (Motor)", partCategory: "Mechanical", description: "Front electric drive unit — motor, gearbox, and inverter assembly." });
    return parts;
  }
  if (type === "hybrid") {
    return [
      { partName: "Engine", partCategory: "Mechanical", description: "Combustion engine." },
      { partName: "Transmission", partCategory: "Mechanical", description: "Transmission / transaxle." },
      { partName: "Hybrid Battery Pack", partCategory: "Mechanical", description: "Hybrid traction battery pack." },
    ];
  }
  return [
    { partName: "Engine", partCategory: "Mechanical", description: "Combustion engine." },
    { partName: "Transmission", partCategory: "Mechanical", description: "Transmission." },
  ];
}

// Does the scanned list already cover an expected part? Loose name match so
// "Engine — 3.5L V6" or "Rear Drive Unit" satisfy their slots; a 12V "Battery"
// does NOT satisfy the battery-pack slot.
function covers(partNames: string[], expected: string): boolean {
  const keys: Record<string, RegExp> = {
    "High-Voltage Battery Pack": /\b(high.?voltage|hv|traction|battery\s?pack)\b/i,
    "Hybrid Battery Pack": /\b(hybrid\s?battery|battery\s?pack|traction)\b/i,
    "Rear Drive Unit (Motor)": /\brear\b.*\b(drive\s?unit|motor)\b|\b(drive\s?unit|motor)\b.*\brear\b/i,
    "Front Drive Unit (Motor)": /\bfront\b.*\b(drive\s?unit|motor)\b|\b(drive\s?unit|motor)\b.*\bfront\b/i,
    "Onboard Charger": /\bonboard\s?charger|charger\s?module\b/i,
    "Inverter / DC-DC Converter": /\binverter|dc.?dc\b/i,
    "Engine": /\bengine\b/i,
    "Transmission": /\btransmission\b/i,
  };
  const re = keys[expected] ?? new RegExp(`\\b${expected}\\b`, "i");
  return partNames.some((n) => re.test(n));
}

// Enforce powertrain reality on a scanned part list:
//   1. DROP parts that cannot exist for this powertrain (never list a catalytic
//      converter on a BEV).
//   2. APPEND the expected high-value powertrain parts that the photos didn't show,
//      via `make` so the caller controls the concrete part shape. Appended parts
//      must be flagged inferred + priced by the caller's pricing pass.
// Returns { parts, added, dropped } so callers can report what changed.
export function ensurePowertrainParts<T extends { partName: string }>(
  parts: T[],
  type: PowertrainType,
  make: (p: ExpectedPart) => T,
  opts?: { awd?: boolean },
): { parts: T[]; added: T[]; dropped: T[] } {
  const dropped = parts.filter((p) => isImpossiblePart(p.partName, type));
  const kept = parts.filter((p) => !isImpossiblePart(p.partName, type));
  const names = kept.map((p) => p.partName);
  const added = expectedPowertrainParts(type, opts)
    .filter((e) => !covers(names, e.partName))
    .map(make);
  return { parts: [...kept, ...added], added, dropped };
}
