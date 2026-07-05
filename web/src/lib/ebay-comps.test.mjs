// Unit tests for the comps-retrieval + judgment pure helpers. Runs with plain `node`:
//
//   node web/src/lib/ebay-comps.test.mjs
//
// Registers the same .ts resolution hook as qa-agent.test.mjs and re-runs itself.
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));

if (!process.env.__EBAY_COMPS_TEST_CHILD) {
  const fs = await import("node:fs");
  const hookPath = pathResolve(HERE, ".ebay-comps.ext-hook.mjs");
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
    { stdio: "inherit", env: { ...process.env, __EBAY_COMPS_TEST_CHILD: "1" } },
  );
  try { fs.unlinkSync(hookPath); } catch { /* best-effort cleanup */ }
  process.exit(child.status ?? 1);
}

const assert = (await import("node:assert/strict")).default;
const { compQuery, cleanComps } = await import("./ebay-comps.ts");
const { sanitizeJudgedRow } = await import("./price-judge.ts");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

console.log("ebay-comps + price-judge:");

// ── compQuery ────────────────────────────────────────────────────────────────

test("query is year+make+model+part, trim deliberately excluded (interchange)", () => {
  assert.equal(compQuery({ year: 2021, make: "Toyota", model: "Tacoma" }, "Tailgate"), "2021 Toyota Tacoma Tailgate");
});

test("query tolerates missing fields", () => {
  assert.equal(compQuery({ make: "Toyota", model: "Tacoma" }, "Tailgate"), "Toyota Tacoma Tailgate");
});

// ── cleanComps hygiene ───────────────────────────────────────────────────────

const mk = (title, price = 500, condition = "Used") => ({ title, price, condition });

test("drops core/for-parts/broken/shell junk in code", () => {
  const out = cleanComps([
    mk("2021 Tacoma Tailgate OEM clean"),
    mk("Tacoma Tailgate FOR PARTS not working"),
    mk("Tacoma engine CORE only"),
    mk("Tacoma tailgate shell only"),
    mk("Tacoma tailgate cracked corner"),
  ], 2021);
  assert.equal(out.length, 1);
});

test("drops 'For parts or not working' condition label", () => {
  const out = cleanComps([mk("Tacoma Tailgate nice", 400, "For parts or not working")], 2021);
  assert.equal(out.length, 0);
});

test("drops obvious wrong-generation hits by title years (2.4T vs old V6 trap)", () => {
  const out = cleanComps([
    mk("2005 2006 2007 Toyota Tacoma Tailgate"),   // 2nd gen — all years far from 2024
    mk("2024 Toyota Tacoma Tailgate OEM"),
    mk("Toyota Tacoma Tailgate no year in title"), // passes — nuance left to the judge
  ], 2024);
  assert.deepEqual(out.map((c) => c.title.slice(0, 4)), ["2024", "Toyo"]);
});

test("dedupes near-identical title+price and caps the list", () => {
  const raw = Array.from({ length: 30 }, (_, i) => mk(`2021 Toyota Tacoma Tailgate OEM listing variant ${i}`, 500 + i));
  raw.push(mk("2021 Toyota Tacoma Tailgate OEM listing variant 0", 500)); // dupe
  const out = cleanComps(raw, 2021);
  assert.equal(out.length, 12); // cap
});

test("drops non-positive / missing prices and empty titles", () => {
  const out = cleanComps([mk("", 500), mk("Tacoma Tailgate", 0), mk("Tacoma Tailgate", NaN), { title: "Tacoma Tailgate" }], 2021);
  assert.equal(out.length, 0);
});

// ── sanitizeJudgedRow ────────────────────────────────────────────────────────

test("passes a clean judged row; clamps estimate into band", () => {
  const r = sanitizeJudgedRow({ part_id: "Tailgate", estimate: 700, low: 750, high: 650, confidence: "high", note: "6 comps" });
  assert.deepEqual(r, { part_id: "Tailgate", estimate: 700, low: 650, high: 750, confidence: "high", note: "6 comps" });
});

test("rejects rows without id or positive estimate; coerces unknown confidence", () => {
  assert.equal(sanitizeJudgedRow({ estimate: 100 }), null);
  assert.equal(sanitizeJudgedRow({ part_id: "X", estimate: -5 }), null);
  assert.equal(sanitizeJudgedRow({ part_id: "X", estimate: 100, low: 90, high: 110, confidence: "sure", note: "" }).confidence, "low");
});

test("missing band collapses to the estimate", () => {
  const r = sanitizeJudgedRow({ part_id: "X", estimate: 100, confidence: "med", note: "" });
  assert.equal(r.low, 100);
  assert.equal(r.high, 100);
});

console.log(`  ${passed} passed`);
