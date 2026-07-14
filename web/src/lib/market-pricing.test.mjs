// Unit tests for the market-pricing agent's pure helpers. Runs with plain `node`:
//
//   node web/src/lib/market-pricing.test.mjs
//
// market-pricing.ts imports sibling .ts modules extensionlessly ("./anthropic"),
// which node's type-stripping can't resolve on its own — so, like qa-agent.test.mjs,
// this file registers a tiny resolution hook and re-runs itself once under it.
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));

if (!process.env.__MARKET_PRICING_TEST_CHILD) {
  const fs = await import("node:fs");
  const hookPath = pathResolve(HERE, ".market-pricing.ext-hook.mjs");
  fs.writeFileSync(
    hookPath,
    [
      'import { fileURLToPath, pathToFileURL } from "node:url";',
      'import { existsSync } from "node:fs";',
      'import { dirname, resolve as pathResolve } from "node:path";',
      "export function resolve(specifier, context, nextResolve) {",
      '  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {',
      "    const abs = pathResolve(dirname(fileURLToPath(context.parentURL)), specifier);",
      "    if (!existsSync(abs)) {",
      '      for (const ext of [".ts", ".tsx"]) {',
      "        if (existsSync(abs + ext)) return nextResolve(pathToFileURL(abs + ext).href, context);",
      "      }",
      "    }",
      "  }",
      "  return nextResolve(specifier, context);",
      "}",
    ].join("\n"),
  );
  const child = spawnSync(
    process.execPath,
    ["--no-warnings=MODULE_TYPELESS_PACKAGE_JSON", "--import", `data:text/javascript,import { register } from "node:module"; register(${JSON.stringify(pathToFileURL(hookPath).href)});`, fileURLToPath(import.meta.url)],
    { stdio: "inherit", env: { ...process.env, __MARKET_PRICING_TEST_CHILD: "1" } },
  );
  try { fs.unlinkSync(hookPath); } catch { /* best-effort cleanup */ }
  process.exit(child.status ?? 1);
}

const assert = (await import("node:assert/strict")).default;
const { parseMarketJson, sanitizeMarketRow } = await import("./market-pricing.ts");
const { compKey } = await import("./market-cache.ts");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

console.log("market-pricing:");

// ── parseMarketJson ──────────────────────────────────────────────────────────

test("parses a bare JSON envelope", () => {
  const rows = parseMarketJson('{"parts": [{"name": "Tailgate"}]}');
  assert.equal(rows.length, 1);
});

test("strips markdown fences (instructed-JSON fallback path)", () => {
  const rows = parseMarketJson('```json\n{"parts": [{"name": "Tailgate"}, {"name": "Engine"}]}\n```');
  assert.equal(rows.length, 2);
});

test("returns null on prose / malformed / missing parts", () => {
  assert.equal(parseMarketJson("I found the following prices..."), null);
  assert.equal(parseMarketJson('{"items": []}'), null);
  assert.equal(parseMarketJson(""), null);
});

// ── sanitizeMarketRow ────────────────────────────────────────────────────────

test("passes a clean researched row through", () => {
  const r = sanitizeMarketRow({
    name: "Tailgate", usedPartPriceUsd: 700, usedPartPriceLowUsd: 600, usedPartPriceHighUsd: 800,
    confidence: "high", compCount: 4, sourceDomains: ["ebay.com", "car-part.com"],
  });
  assert.deepEqual(r, {
    name: "Tailgate", usedPartPriceUsd: 700, usedPartPriceLowUsd: 600, usedPartPriceHighUsd: 800,
    confidence: "high", compCount: 4, sourceDomains: ["ebay.com", "car-part.com"],
  });
});

test("reorders an inverted band and clamps the point into it", () => {
  const r = sanitizeMarketRow({ name: "Hood", usedPartPriceUsd: 900, usedPartPriceLowUsd: 1000, usedPartPriceHighUsd: 700, confidence: "medium", compCount: 2, sourceDomains: [] });
  assert.equal(r.usedPartPriceLowUsd, 700);
  assert.equal(r.usedPartPriceHighUsd, 1000);
});

test("null price nulls the band; half-band collapses to null", () => {
  const a = sanitizeMarketRow({ name: "X", usedPartPriceUsd: null, usedPartPriceLowUsd: 100, usedPartPriceHighUsd: 200, confidence: "low", compCount: 0, sourceDomains: [] });
  assert.equal(a.usedPartPriceUsd, null); assert.equal(a.usedPartPriceLowUsd, null);
  const b = sanitizeMarketRow({ name: "X", usedPartPriceUsd: 150, usedPartPriceLowUsd: 100, confidence: "low", compCount: 0, sourceDomains: [] });
  assert.equal(b.usedPartPriceUsd, 150); assert.equal(b.usedPartPriceLowUsd, null); assert.equal(b.usedPartPriceHighUsd, null);
});

test("zero comps downgrades a claimed high/medium to low (evidence gate)", () => {
  const r = sanitizeMarketRow({ name: "X", usedPartPriceUsd: 100, usedPartPriceLowUsd: 80, usedPartPriceHighUsd: 120, confidence: "high", compCount: 0, sourceDomains: [] });
  assert.equal(r.confidence, "low");
});

test("strips echoed grade/inferred annotations from the name", () => {
  const mk = (name) => sanitizeMarketRow({ name, usedPartPriceUsd: 9000, usedPartPriceLowUsd: 8000, usedPartPriceHighUsd: 11000, confidence: "medium", compCount: 2, sourceDomains: [] }).name;
  assert.equal(mk("High-Voltage Battery Pack (inferred)"), "High-Voltage Battery Pack");
  assert.equal(mk("Side Mirror (grade B)"), "Side Mirror");
  assert.equal(mk("Engine (grade B, inferred)"), "Engine");
  assert.equal(mk("Door Panel (Front)"), "Door Panel (Front)"); // real parentheticals survive
});

test("normalizes sourceDomains to bare deduped domains", () => {
  const r = sanitizeMarketRow({
    name: "X", usedPartPriceUsd: 100, usedPartPriceLowUsd: 90, usedPartPriceHighUsd: 110, confidence: "medium", compCount: 3,
    sourceDomains: ["https://www.ebay.com/itm/123", "ebay.com", "Car-Part.com/search", "not a domain", ""],
  });
  assert.deepEqual(r.sourceDomains, ["ebay.com", "car-part.com"]);
});

test("rejects rows without a usable name", () => {
  assert.equal(sanitizeMarketRow({ usedPartPriceUsd: 100 }), null);
  assert.equal(sanitizeMarketRow({ name: "   " }), null);
  assert.equal(sanitizeMarketRow(null), null);
});

test("negative / zero / NaN prices become null", () => {
  const r = sanitizeMarketRow({ name: "X", usedPartPriceUsd: -50, usedPartPriceLowUsd: 0, usedPartPriceHighUsd: NaN, confidence: "low", compCount: 0, sourceDomains: [] });
  assert.equal(r.usedPartPriceUsd, null);
});

test("unknown confidence value coerces to low", () => {
  const r = sanitizeMarketRow({ name: "X", usedPartPriceUsd: 100, usedPartPriceLowUsd: 90, usedPartPriceHighUsd: 110, confidence: "certain", compCount: 3, sourceDomains: [] });
  assert.equal(r.confidence, "low");
});

// ── compKey ──────────────────────────────────────────────────────────────────

test("compKey normalizes case and whitespace", () => {
  assert.equal(
    compKey("2021 Toyota  Tacoma TRD Sport", "engine 3.5L V6", "Tailgate", "A"),
    compKey("  2021 toyota tacoma trd sport ", "ENGINE 3.5l v6", "tailgate", "a"),
  );
});

test("compKey separates vehicles, parts, and grades", () => {
  const base = compKey("2021 Toyota Tacoma", "", "Tailgate", "B");
  assert.notEqual(base, compKey("2020 Toyota Tacoma", "", "Tailgate", "B"));
  assert.notEqual(base, compKey("2021 Toyota Tacoma", "", "Hood", "B"));
  assert.notEqual(base, compKey("2021 Toyota Tacoma", "", "Tailgate", "A"));
  assert.equal(base, compKey("2021 Toyota Tacoma", "", "Tailgate", "")); // missing grade defaults to B
});

console.log(`  ${passed} passed`);
