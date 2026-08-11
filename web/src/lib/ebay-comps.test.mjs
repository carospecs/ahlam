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
  // Hook resolves both relative extensionless .ts imports AND the "@/…" alias
  // (part-enrich.ts imports "@/lib/age-pricing"), mapping @/ to web/src/.
  const SRC = pathResolve(HERE, "..");
  fs.writeFileSync(
    hookPath,
    [
      'import { fileURLToPath, pathToFileURL } from "node:url";',
      'import { existsSync } from "node:fs";',
      'import { dirname, resolve as pathResolve } from "node:path";',
      `const SRC = ${JSON.stringify(SRC)};`,
      "export function resolve(specifier, context, nextResolve) {",
      '  const aliased = specifier.startsWith("@/");',
      '  if ((aliased || specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {',
      "    const abs = aliased",
      "      ? pathResolve(SRC, specifier.slice(2))",
      "      : pathResolve(dirname(fileURLToPath(context.parentURL)), specifier);",
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
const { compQuery, cleanComps, isAssemblyClass, compQueryVariants, interleave } = await import("./ebay-comps.ts");
const { sanitizeJudgedRow, chunkJudgeParts } = await import("./price-judge.ts");
const { dropGenericWhenPositioned } = await import("./part-enrich.ts");

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

// ── cleanComps hygiene (minimal on purpose — the judge weighs the rest) ──────

const mk = (title, price = 500, condition = "Used") => ({ title, price, condition });

test("drops ONLY clearly-broken for-parts/not-working listings", () => {
  const out = cleanComps([
    mk("2021 Tacoma Tailgate OEM clean"),
    mk("Tacoma Tailgate FOR PARTS not working"),
    mk("Tacoma tailgate PARTS ONLY"),
  ]);
  assert.equal(out.length, 1);
});

test("drops 'For parts or not working' condition label", () => {
  const out = cleanComps([mk("Tacoma Tailgate nice", 400, "For parts or not working")]);
  assert.equal(out.length, 0);
});

test("KEEPS cheaper configurations and off-generation listings for the judge", () => {
  // Per PRICING_MIGRATION_INSTRUCTION (2): shell-only / long-block / core /
  // cracked / wrong-generation listings are information the judge weighs — code
  // must not delete them.
  const out = cleanComps([
    mk("Tacoma engine long block, turbo sold separately"),
    mk("Tacoma tailgate shell only"),
    mk("Tacoma engine CORE - needs rebuild"),
    mk("Tacoma tailgate cracked corner"),
    mk("2005 2006 2007 Toyota Tacoma Tailgate"), // wrong gen — judge's call, not code's
  ]);
  assert.equal(out.length, 5);
});

test("dedupes exact repeats and caps the list", () => {
  const raw = Array.from({ length: 30 }, (_, i) => mk(`2021 Toyota Tacoma Tailgate OEM listing variant ${i}`, 500 + i));
  raw.push(mk("2021 Toyota Tacoma Tailgate OEM listing variant 0", 500)); // dupe
  const out = cleanComps(raw);
  assert.equal(out.length, 12); // cap
});

test("drops non-positive / missing prices and empty titles", () => {
  const out = cleanComps([mk("", 500), mk("Tacoma Tailgate", 0), mk("Tacoma Tailgate", NaN), { title: "Tacoma Tailgate" }]);
  assert.equal(out.length, 0);
});

// ── sanitizeJudgedRow ────────────────────────────────────────────────────────

test("passes a clean judged row; clamps estimate into band", () => {
  const r = sanitizeJudgedRow({ part_id: "Tailgate", estimate: 700, low: 750, high: 650, confidence: "high", note: "6 comps" });
  assert.deepEqual(r, { part_id: "Tailgate", estimate: 700, low: 650, high: 750, confidence: "high", note: "6 comps" });
});

test("rejects rows without id; coerces unknown confidence", () => {
  assert.equal(sanitizeJudgedRow({ estimate: 100 }), null);
  assert.equal(sanitizeJudgedRow({ part_id: "X", estimate: 100, low: 90, high: 110, confidence: "sure", note: "" }).confidence, "low");
});

test("null/invalid estimate is a VALID 'no usable comps' answer, not a rejection", () => {
  const a = sanitizeJudgedRow({ part_id: "Windshield", estimate: null, low: null, high: null, confidence: "low", note: "no true glass comps" });
  assert.deepEqual(a, { part_id: "Windshield", estimate: null, low: null, high: null, confidence: "low", note: "no true glass comps" });
  const b = sanitizeJudgedRow({ part_id: "X", estimate: -5, confidence: "high", note: "" });
  assert.equal(b.estimate, null); // invalid coerces to the null answer
  assert.equal(b.confidence, "low");
});

// ── dropGenericWhenPositioned (merge synonym dedupe) ─────────────────────────

test("bare synonym drops when a positioned sibling exists", () => {
  const out = dropGenericWhenPositioned([
    { partName: "Rear Spoiler" }, { partName: "Spoiler" },
    { partName: "Front Door Panel" }, { partName: "Door Panel" },
    { partName: "Hood" }, // no positioned sibling — stays
  ]);
  assert.deepEqual(out.map((p) => p.partName), ["Rear Spoiler", "Front Door Panel", "Hood"]);
});

test("positioned-only or bare-only groups are untouched", () => {
  const out = dropGenericWhenPositioned([
    { partName: "Front Bumper Cover" }, { partName: "Rear Bumper Cover" }, // both positioned — distinct parts
    { partName: "Grille" },
  ]);
  assert.equal(out.length, 3);
});

test("missing band collapses to the estimate", () => {
  const r = sanitizeJudgedRow({ part_id: "X", estimate: 100, confidence: "med", note: "" });
  assert.equal(r.low, 100);
  assert.equal(r.high, 100);
});

// ── isAssemblyClass ──────────────────────────────────────────────────────────

test("assembly-class parts: shells/sub-components flood their eBay best-match", () => {
  for (const name of ["Driver Side Front Door", "Liftgate", "2nd Row Seat", "Front Bumper", "Side Mirror", "Trunk Lid", "Engine", "Rear Axle", "Front Strut"]) {
    assert.equal(isAssemblyClass(name), true, name);
  }
});

test("non-assembly parts stay single-variant", () => {
  for (const name of ["Hood", "Fender", "Windshield", "Alloy Wheel", "Alternator"]) {
    assert.equal(isAssemblyClass(name), false, name);
  }
});

// ── compQueryVariants ────────────────────────────────────────────────────────

const silverado = { year: 2019, make: "Chevrolet", model: "Silverado 1500" };

test("assembly part + gen → 3 variants in priority order [assembly, gen, generic]", () => {
  const qs = compQueryVariants(silverado, "Driver Side Front Door", { from: 2019, to: 2023 });
  assert.deepEqual(qs, [
    "2019 Chevrolet Silverado 1500 Driver Side Front Door assembly",
    "2019-2023 Chevrolet Silverado 1500 Driver Side Front Door",
    "2019 Chevrolet Silverado 1500 Driver Side Front Door",
  ]);
});

test("non-assembly part, no gen → exactly the generic query", () => {
  assert.deepEqual(compQueryVariants(silverado, "Hood", null), ["2019 Chevrolet Silverado 1500 Hood"]);
});

test("part name already containing 'Assembly' gets no doubled assembly variant", () => {
  const qs = compQueryVariants(silverado, "Headlight Assembly", null);
  assert.deepEqual(qs, ["2019 Chevrolet Silverado 1500 Headlight Assembly"]);
  assert.equal(new Set(qs).size, qs.length);
});

test("gen variant skipped when make/model missing or gen is a single year", () => {
  assert.deepEqual(compQueryVariants({ year: 2019, model: "Silverado 1500" }, "Hood", { from: 2019, to: 2023 }), ["2019 Silverado 1500 Hood"]);
  assert.deepEqual(compQueryVariants({ year: 2019, make: "Chevrolet" }, "Hood", { from: 2019, to: 2023 }), ["2019 Chevrolet Hood"]);
  assert.deepEqual(compQueryVariants(silverado, "Hood", { from: 2022, to: 2022 }), ["2019 Chevrolet Silverado 1500 Hood"]);
});

// ── interleave + merged pool ─────────────────────────────────────────────────

test("interleave round-robins ragged pools and tolerates empties", () => {
  assert.deepEqual(interleave([["a0", "a1"], ["b0"], ["c0", "c1", "c2"]]), ["a0", "b0", "c0", "a1", "c1", "c2"]);
  assert.deepEqual(interleave([[], ["b0"], []]), ["b0"]);
  assert.deepEqual(interleave([]), []);
});

test("cross-variant dedupe: same title+price survives the merge once", () => {
  const dupe = mk("2019 Silverado 1500 Front Door assembly OEM", 900);
  const merged = cleanComps(interleave([[dupe, mk("assembly pool extra", 950)], [dupe, mk("gen pool extra", 850)]]), 18);
  assert.equal(merged.filter((c) => c.title === dupe.title).length, 1);
  assert.equal(merged.length, 3);
});

test("merged cap 18: shell flooding in one pool can't starve assembly comps", () => {
  const pool = (tag) => Array.from({ length: 12 }, (_, i) => mk(`${tag} listing number ${i} distinct title`, 100 * (i + 1) + tag.length));
  const pools = [pool("assembly"), pool("generation"), pool("generic")];
  const merged = cleanComps(interleave(pools), 18);
  assert.equal(merged.length, 18);
  for (let i = 0; i < 6; i++) {
    assert.ok(merged.some((c) => c.title === pools[0][i].title), `assembly comp ${i} survived`);
  }
});

// ── chunkJudgeParts ──────────────────────────────────────────────────────────

test("chunking: fixed-size, order-preserving, flat concat equals input", () => {
  assert.deepEqual(chunkJudgeParts([]), []);
  assert.deepEqual(chunkJudgeParts([1, 2, 3]).length, 1);
  const p15 = Array.from({ length: 15 }, (_, i) => i);
  assert.deepEqual(chunkJudgeParts(p15).map((c) => c.length), [15]);
  const p16 = Array.from({ length: 16 }, (_, i) => i);
  assert.deepEqual(chunkJudgeParts(p16).map((c) => c.length), [15, 1]);
  const p80 = Array.from({ length: 80 }, (_, i) => i);
  assert.deepEqual(chunkJudgeParts(p80).map((c) => c.length), [15, 15, 15, 15, 15, 5]);
  assert.deepEqual(chunkJudgeParts(p80).flat(), p80);
});

console.log(`  ${passed} passed`);
