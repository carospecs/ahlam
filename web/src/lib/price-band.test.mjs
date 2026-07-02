// Unit tests for the price confidence band math. Runs with plain `node`:
//
//   node web/src/lib/price-band.test.mjs
//
// Node (>=22.6 with type-stripping) imports the real .ts module directly, so these
// assertions exercise the actual shipped code — not a copy.
import assert from "node:assert/strict";
import {
  fallbackBand,
  bandFor,
  bandFraction,
  priceAtFraction,
  roundYardPrice,
  FALLBACK_SPREAD,
} from "./price-band.ts";

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

console.log("price-band:");

// ── fallbackBand ─────────────────────────────────────────────────────────────

test("high confidence → tight ±10% band", () => {
  assert.deepEqual(fallbackBand(1000, "high"), { low: 900, high: 1100 });
});

test("low confidence → wide ±35% band (the 'Review' parts read wide)", () => {
  assert.deepEqual(fallbackBand(1000, "low"), { low: 650, high: 1350 });
});

test("unknown confidence falls back to the low spread", () => {
  assert.deepEqual(fallbackBand(1000, "nonsense"), fallbackBand(1000, "low"));
});

test("band never goes negative", () => {
  const b = fallbackBand(1, "low");
  assert.ok(b.low >= 0);
});

// ── bandFor (source precedence) ──────────────────────────────────────────────

test("model band wins when present and sane", () => {
  const b = bandFor({ suggestedPriceLowUsd: 400, suggestedPriceHighUsd: 600, confidence: "low", _aiPrice: 500 });
  assert.deepEqual(b, { low: 400, high: 600 });
});

test("degenerate model band (low ≥ high) falls back to confidence spread", () => {
  const b = bandFor({ suggestedPriceLowUsd: 600, suggestedPriceHighUsd: 600, confidence: "medium", _aiPrice: 500 });
  assert.deepEqual(b, fallbackBand(500, "medium"));
});

test("no model band + no AI anchor → no band (manual rows)", () => {
  assert.equal(bandFor({ confidence: "high" }), null);
  assert.equal(bandFor({ _aiPrice: null, confidence: "high" }), null);
  assert.equal(bandFor({ _aiPrice: 0, confidence: "high" }), null);
});

// ── marker math (two-way sync) ───────────────────────────────────────────────

test("bandFraction clamps to 0–1 and centers correctly", () => {
  const band = { low: 100, high: 300 };
  assert.equal(bandFraction(band, 200), 0.5);
  assert.equal(bandFraction(band, 50), 0);   // below the band → pinned left
  assert.equal(bandFraction(band, 999), 1);  // above the band → pinned right
});

test("priceAtFraction inverts bandFraction (drag → price → marker round-trips)", () => {
  const band = { low: 650, high: 1350 };
  for (const price of [650, 800, 1000, 1350]) {
    assert.equal(priceAtFraction(band, bandFraction(band, price)), price);
  }
});

test("priceAtFraction clamps out-of-track drags", () => {
  const band = { low: 100, high: 200 };
  assert.equal(priceAtFraction(band, -0.5), 100);
  assert.equal(priceAtFraction(band, 1.5), 200);
});

// ── roundYardPrice ───────────────────────────────────────────────────────────

test("odd AI figures round to $25 steps under $500", () => {
  assert.equal(roundYardPrice(298), 300);
  assert.equal(roundYardPrice(723 - 500), 225); // 223 → 225
  assert.equal(roundYardPrice(12), 25);         // floor: never rounds to $0
});

test("$50 steps at $500 and above", () => {
  assert.equal(roundYardPrice(723), 700);
  assert.equal(roundYardPrice(526), 550);
});

// Spread table sanity — the UI copy promises tight/green vs wide/amber.
test("spreads widen as confidence drops", () => {
  assert.ok(FALLBACK_SPREAD.high < FALLBACK_SPREAD.medium && FALLBACK_SPREAD.medium < FALLBACK_SPREAD.low);
});

console.log(`price-band: ${passed} passed`);
