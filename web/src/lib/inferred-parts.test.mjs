// Unit tests for the phantom / inferred-part guard. Runs with plain `node`:
//
//   node web/src/lib/inferred-parts.test.mjs
//
// Node (>=22.6 with type-stripping, default-on in Node 24) imports the real .ts module
// directly, so these assertions exercise the actual shipped code — not a copy.
import assert from "node:assert/strict";
import {
  markInferredParts,
  isLikelyInferred,
  INFERRED_NOTE,
} from "./inferred-parts.ts";

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

// Convenience: build a Part with sensible defaults.
function part(over) {
  return {
    partName: "Unknown",
    condition: "B",
    conditionNotes: "",
    description: "",
    suggestedPriceUsd: 100,
    ...over,
  };
}

console.log("inferred-parts:");

// 1) A plain "Airbag" with a firm price and no visibility note → inferred + note, but
//    the price STAYS (inferred parts are priced-and-flagged, never blanked — a hidden
//    part can be the most valuable one on the car).
test('"Airbag" (A, $723, no visibility note) → inferred, note appended, price KEPT', () => {
  const input = [part({ partName: "Airbag", condition: "A", suggestedPriceUsd: 723, conditionNotes: "" })];
  const [out] = markInferredParts(input);
  assert.equal(out.inferred, true);
  assert.equal(out.suggestedPriceUsd, 723);
  assert.ok(out.conditionNotes.includes(INFERRED_NOTE.trim()), "note appended");
  // Other fields untouched.
  assert.equal(out.partName, "Airbag");
  assert.equal(out.condition, "A");
});

// 2) An "Airbag" the seller says is deployed and on the bench → genuinely visible,
//    so NOT inferred and the price is left as-is.
test('"Airbag" "deployed, sitting on the bench" → NOT inferred, price unchanged', () => {
  const input = [
    part({ partName: "Airbag", condition: "C", suggestedPriceUsd: 40, conditionNotes: "deployed, sitting on the bench" }),
  ];
  const [out] = markInferredParts(input);
  assert.notEqual(out.inferred, true);
  assert.equal(out.suggestedPriceUsd, 40);
  assert.equal(out.conditionNotes, "deployed, sitting on the bench");
});

// 3) A PLAIN seat belt is routinely visible — only PRETENSIONER / restraint modules are
//    inferred. A "Passenger Side Seat Belt" must pass through untouched.
test('"Passenger Side Seat Belt" (plain, visible) → NOT inferred', () => {
  const input = [part({ partName: "Passenger Side Seat Belt", suggestedPriceUsd: 55 })];
  const [out] = markInferredParts(input);
  assert.notEqual(out.inferred, true);
  assert.equal(out.suggestedPriceUsd, 55);
  assert.equal(out.conditionNotes, "");
});

// 4) Ordinary visible parts are never touched.
test('"Driver Side Front Door" and "Engine" → untouched', () => {
  const input = [
    part({ partName: "Driver Side Front Door", suggestedPriceUsd: 300, conditionNotes: "minor scuff" }),
    part({ partName: "Engine", suggestedPriceUsd: 1200, conditionNotes: "runs" }),
  ];
  const out = markInferredParts(input);
  for (const o of out) {
    assert.notEqual(o.inferred, true);
  }
  assert.equal(out[0].suggestedPriceUsd, 300);
  assert.equal(out[0].conditionNotes, "minor scuff");
  assert.equal(out[1].suggestedPriceUsd, 1200);
  assert.equal(out[1].conditionNotes, "runs");
});

// 5) Idempotency: running twice equals running once — no double note, no re-changes.
test("idempotent — second pass is a no-op", () => {
  const input = [
    part({ partName: "Airbag", condition: "A", suggestedPriceUsd: 723 }),
    part({ partName: "Seat Belt Pretensioner", suggestedPriceUsd: 90, conditionNotes: "still in pillar" }),
    part({ partName: "Passenger Side Seat Belt", suggestedPriceUsd: 55 }),
    part({ partName: "Engine", suggestedPriceUsd: 1200 }),
  ];
  const once = markInferredParts(input);
  const twice = markInferredParts(once);
  assert.deepEqual(twice, once, "second pass changed nothing");
  // And the note appears exactly once on a flagged part.
  const ab = twice.find((p) => p.partName === "Airbag");
  const occurrences = ab.conditionNotes.split(INFERRED_NOTE.trim()).length - 1;
  assert.equal(occurrences, 1, "note appended exactly once");
});

// 6) Purity: the input array and its objects are not mutated.
test("pure — does not mutate input", () => {
  const original = part({ partName: "Airbag", condition: "A", suggestedPriceUsd: 723, conditionNotes: "" });
  const snapshot = JSON.parse(JSON.stringify(original));
  const input = [original];
  markInferredParts(input);
  assert.deepEqual(original, snapshot, "input object untouched");
});

// 7) The PRETENSIONER module IS flagged (the tight-list positive case), to prove the
//    seat-belt distinction in (3) is the pretensioner-vs-plain split, not a blanket skip.
test('"Seat Belt Pretensioner" (hidden module) → inferred, price kept', () => {
  const input = [part({ partName: "Seat Belt Pretensioner", suggestedPriceUsd: 90, conditionNotes: "in B-pillar" })];
  const [out] = markInferredParts(input);
  assert.equal(out.inferred, true);
  assert.equal(out.suggestedPriceUsd, 90);
  assert.ok(out.conditionNotes.includes(INFERRED_NOTE.trim()));
});

// 8) isLikelyInferred in isolation — the unit-testable helper behaves as specified.
test("isLikelyInferred helper — direct cases", () => {
  assert.equal(isLikelyInferred("Airbag"), true);
  assert.equal(isLikelyInferred("SRS Module"), true);
  assert.equal(isLikelyInferred("Knee Bolster Airbag"), true);
  assert.equal(isLikelyInferred("Airbag", "airbag removed and on the ground"), false); // exposed
  assert.equal(isLikelyInferred("Passenger Side Seat Belt"), false); // plain belt
  assert.equal(isLikelyInferred("Seat Belt Pretensioner"), true);
  assert.equal(isLikelyInferred("Engine"), false);
  assert.equal(isLikelyInferred("Driver Side Front Door"), false);
});

console.log(`\n${passed} passed`);
