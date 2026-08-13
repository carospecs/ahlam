// SCAN QA / VERIFICATION (pipeline Stage 7) — the end-of-run consistency guardrail that
// turns the scanner from an optimistic appraiser into a salvage inspector. Pure,
// deterministic code: it cross-checks the assembled part list for internal contradictions
// and surfaces low-confidence / must-verify items, instead of publishing silently.
//
// Every check is grounded in data the pipeline already produces (condition, inferred flag,
// compliance flag, price, side in name vs. description, the whole-car estimate). Color
// uniformity is intentionally NOT checked here yet — it belongs to the grounded Description
// stage (Stage 5), which locks a single vehicle color; there's nothing reliable to check
// until that ships.

import { canonicalizePart } from "./part-catalog";

export type QaFlag = { level: "warn" | "info"; message: string };

// Structural subset of a scanned part — only the fields QA reads. `condition` is typed
// loosely (string) so both the server's AIPartOutput ("A"|"B"|"C") and the client's AIPart
// pass through; the checks compare against "A"/"C" at runtime.
export type QaPart = {
  partName: string;
  condition: string;
  suggestedPriceUsd: number | null;
  conditionNotes?: string;
  description?: string;
  inferred?: boolean;
  compliance?: { label?: string } | undefined;
};

// Which side a name/description claims. Exported for the QA-resolver agent, which
// rebuilds the same side-conflict cases this module flags.
export const sideOf = (s: string): "L" | "R" | null =>
  /\bpassenger\b/i.test(s) ? "R" : /\bdriver\b/i.test(s) ? "L" : null;

const names = (ps: QaPart[]) => ps.map((p) => p.partName).join(", ");

// Do two photos name body colors with NO shared word (e.g. "gray" vs "gold")? That's a
// strong signal the color was misread — or, more seriously, that the photos aren't all the
// SAME vehicle. ("gray" vs "dark gray" share "gray" → not a conflict.) Returns the pair.
// Exported for the QA-resolver agent, which re-reads colors and re-runs this same check.
export function colorConflict(colors: string[]): [string, string] | null {
  const distinct = [...new Set(colors.map((c) => c.toLowerCase().trim()).filter(Boolean))];
  const words = distinct.map((c) => new Set(c.split(/\s+/)));
  for (let i = 0; i < distinct.length; i++)
    for (let j = i + 1; j < distinct.length; j++)
      if (![...words[i]].some((w) => words[j].has(w))) return [distinct[i], distinct[j]];
  return null;
}

// Run the consistency checks. Returns the flags to show the seller for review (empty when
// the listing is internally consistent). `wholeCarUsd` is the AI's standalone whole-car
// estimate; `photoColors` is the body color each photo reported (for the same-vehicle check).
export function runScanQa(parts: QaPart[], wholeCarUsd?: number | null, photoColors: string[] = []): QaFlag[] {
  const flags: QaFlag[] = [];

  // 1. Contradiction: a part graded A while flagged inside a damage zone. The damage pass
  //    downgrades A→B, so this should never fire — if it does, the pipeline disagrees with
  //    itself and a human should look. (Directly implements "no Grade-A part in a damage zone".)
  const aInZone = parts.filter((p) => p.condition === "A" && /impact zone/i.test(p.conditionNotes ?? ""));
  if (aInZone.length) flags.push({ level: "warn", message: `Grade A but in a damage zone — verify: ${names(aInZone)}.` });

  // 2. Side coherence: the side named in the description contradicts the side in the part
  //    name (e.g. "Driver Side Front Door" described as a passenger door).
  const sideConflict = parts.filter((p) => {
    const nameSide = sideOf(p.partName);
    if (!nameSide) return false;
    const descSide = sideOf(p.description ?? "");
    return descSide !== null && descSide !== nameSide;
  });
  if (sideConflict.length) flags.push({ level: "warn", message: `Description names the opposite side — verify: ${names(sideConflict)}.` });

  // 3. Inferred parts: not directly seen — never publish as observed.
  const inferred = parts.filter((p) => p.inferred);
  if (inferred.length) flags.push({ level: "info", message: `Inferred (not directly seen) — verify before listing: ${names(inferred)}.` });

  // 4. Restricted parts: confirm resale rules before listing.
  const restricted = parts.filter((p) => p.compliance);
  if (restricted.length) flags.push({ level: "warn", message: `Restricted resale — confirm the rules: ${names(restricted)}.` });

  // 5. Headline sanity vs. the whole-car estimate. The headline counts only clean, observed,
  //    sellable parts (not damaged, not inferred). Parting out normally EXCEEDS the whole-car
  //    value, so a headline below it is a signal the pricing is running conservative.
  const headline = parts.reduce(
    (s, p) => s + (p.inferred || p.condition === "C" ? 0 : p.suggestedPriceUsd || 0),
    0,
  );
  if (wholeCarUsd && wholeCarUsd > 0 && headline > 0 && headline < wholeCarUsd) {
    flags.push({
      level: "info",
      message: `Clean-parts total ($${headline.toLocaleString()}) is below the whole-car estimate ($${wholeCarUsd.toLocaleString()}) — parting out usually exceeds it, so pricing may be conservative.`,
    });
  }

  // 5b. Implausible total: parting out normally exceeds the whole-car value, but not by
  //     a huge margin (the 2018 Model X case ran ~1.6× — panels priced near retail).
  //     Flag it and point at the LARGEST line items first, since that's where the
  //     over-pricing hides. Uses ALL priced parts — this total is GROSS retail
  //     potential, and it's the gross figure that reads implausible.
  const total = parts.reduce((s, p) => s + (p.suggestedPriceUsd || 0), 0);
  if (wholeCarUsd && wholeCarUsd > 0 && total > wholeCarUsd * 1.5) {
    const biggest = parts
      .filter((p) => (p.suggestedPriceUsd || 0) > 0)
      .sort((a, b) => (b.suggestedPriceUsd || 0) - (a.suggestedPriceUsd || 0))
      .slice(0, 3)
      .map((p) => `${p.partName} ($${(p.suggestedPriceUsd || 0).toLocaleString()})`);
    flags.push({
      level: "warn",
      message: `Parts total ($${total.toLocaleString()}) runs ${Math.round((total / wholeCarUsd) * 100)}% of the whole-car value ($${wholeCarUsd.toLocaleString()}) — implausibly high. Re-examine the largest line items first: ${biggest.join(", ")}.`,
    });
  }

  // 6. Photos disagree on the body color → a color misread, or (worse) the photo set may
  //    mix DIFFERENT vehicles. Either way, a human should confirm before it lists.
  const cc = colorConflict(photoColors);
  if (cc) flags.push({ level: "warn", message: `Photos disagree on body color (${cc[0]} vs ${cc[1]}) — verify every photo is the SAME vehicle.` });

  // 7. Wreck with clean mechanicals: some part shows STRONG collision force, yet a
  //    mechanical part still carries an optimistic grade and a full price. The
  //    impact-face pass (lib/damage-zones applyImpactFaceDamage) normally condemns
  //    these; this is the last-line net for the cases it can't see (face origin
  //    graded B by the model, damage only in a photo the part wasn't boxed in).
  const STRONG = /crush|caved|collision|impact|torn|frame|airbag/i;
  const MECHANICAL = /^(engine\b|transmission\b|transaxle\b|radiator\b|condenser|compressor|alternator|starter|drive unit|fuel tank)/i;
  const wrecked = parts.some((p) => p.condition === "C" && STRONG.test(`${p.conditionNotes ?? ""} ${p.description ?? ""}`));
  if (wrecked) {
    const cleanMech = parts.filter(
      (p) => MECHANICAL.test(p.partName.trim()) && p.condition !== "C" && (p.suggestedPriceUsd || 0) > 0 && !STRONG.test(p.conditionNotes ?? ""),
    );
    if (cleanMech.length) {
      flags.push({
        level: "warn",
        message: `This vehicle shows collision damage, but these mechanical parts are still graded clean at full price — inspect before listing: ${names(cleanMech)}.`,
      });
    }
  }

  // 8. Off-catalog part names — the drift alarm for the canonical vocabulary
  //    (lib/part-catalog). The vision prompt's catalog is GENERATED from the
  //    same data, so in steady state everything resolves; a name that doesn't
  //    means the model free-styled (allowed for uncommon parts, worth a look)
  //    or the prompt/catalog regressed. Info-level: it gates nothing.
  const offCatalog = parts.filter((p) => !canonicalizePart(p.partName));
  if (offCatalog.length) {
    flags.push({ level: "info", message: `Not in the standard part catalog (name won't cache-match across scans) — check the name: ${names(offCatalog)}.` });
  }

  return flags;
}
