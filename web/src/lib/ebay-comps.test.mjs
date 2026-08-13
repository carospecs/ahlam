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
const { compQuery, cleanComps, isAssemblyClass, compQueryVariants, interleave, siblingQueries, classifyComp } = await import("./ebay-comps.ts");
const { sanitizeJudgedRow, buildJudgeUserText } = await import("./price-judge.ts");
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

// ── sanitizeJudgedRow (V3 appraiser response shape) ──────────────────────────

const row = (over = {}) => ({
  independent_estimate: "step 1 reasoning",
  comp_analysis: "step 2 reasoning",
  discarded_count: 3,
  reconciliation: "step 3 reasoning",
  low: 650,
  recommended: 700,
  high: 750,
  confidence: "high",
  confidence_reason: "6 concordant complete-assembly comps",
  needs_human_review: false,
  missing_information: null,
  ...over,
});

test("passes a clean appraiser row; swapped low/high are reordered", () => {
  const r = sanitizeJudgedRow("Tailgate", row({ low: 750, high: 650 }));
  assert.equal(r.part_id, "Tailgate");
  assert.equal(r.estimate, 700);
  assert.equal(r.low, 650);
  assert.equal(r.high, 750);
  assert.equal(r.confidence, "high");
  assert.equal(r.needsReview, false);
  assert.equal(r.note, "6 concordant complete-assembly comps");
  assert.equal(r.reasoning.independent_estimate, "step 1 reasoning");
  assert.equal(r.reasoning.discarded_count, 3);
});

test("estimate outside the band widens the band to include it", () => {
  const r = sanitizeJudgedRow("X", row({ low: 800, high: 900, recommended: 700 }));
  assert.equal(r.low, 700);
  assert.equal(r.high, 900);
});

test("non-object rejects; unknown confidence coerces to low and flags review", () => {
  assert.equal(sanitizeJudgedRow("X", null), null);
  const r = sanitizeJudgedRow("X", row({ confidence: "sure" }));
  assert.equal(r.confidence, "low");
  assert.equal(r.needsReview, true); // low confidence always routes to review
});

test("null/invalid recommended is a VALID decline-to-price, not a rejection", () => {
  const a = sanitizeJudgedRow("Windshield", row({ low: null, recommended: null, high: null, confidence: "low", confidence_reason: "no true glass comps" }));
  assert.equal(a.estimate, null);
  assert.equal(a.low, null);
  assert.equal(a.needsReview, true);
  assert.equal(a.note, "no true glass comps");
  const b = sanitizeJudgedRow("X", row({ recommended: -5 }));
  assert.equal(b.estimate, null); // invalid coerces to the decline answer
  assert.equal(b.confidence, "low");
});

test("needs_human_review from the model is honored even at high confidence", () => {
  const r = sanitizeJudgedRow("X", row({ needs_human_review: true }));
  assert.equal(r.needsReview, true);
  assert.equal(r.estimate, 700); // price still carried — route decides what to do
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
  const r = sanitizeJudgedRow("X", row({ low: null, high: null, recommended: 100 }));
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
  // Catalog-known part: queries use the entry's own phrasings, side word
  // dropped (retrieval stays wide; the judge reads sides from titles).
  const qs = compQueryVariants(silverado, "Driver Side Front Door", { from: 2019, to: 2023 });
  assert.deepEqual(qs, [
    "2019 Chevrolet Silverado 1500 Front Door assembly",
    "2019-2023 Chevrolet Silverado 1500 Front Door",
    "2019 Chevrolet Silverado 1500 Front Door",
  ]);
});

test("bumper assemblies query as assemblies, never as 'cover assembly'", () => {
  // The V3 naming bug this push exists to kill: a complete front bumper used
  // to query "Front Bumper Cover assembly", mixing shell comps into the pool.
  const qs = compQueryVariants(silverado, "Front Bumper", null);
  assert.deepEqual(qs, [
    "2019 Chevrolet Silverado 1500 Front Bumper Assembly",
    "2019 Chevrolet Silverado 1500 Front Bumper",
  ]);
  // Legacy scans that still say "Front Bumper Cover" mean the complete bumper
  // and query the same way.
  assert.deepEqual(compQueryVariants(silverado, "Front Bumper Cover", null), qs);
  // An off-catalog name keeps the original ASSEMBLY_CLASS behavior untouched.
  assert.deepEqual(compQueryVariants(silverado, "Blend Door Actuator Bracket", null), [
    "2019 Chevrolet Silverado 1500 Blend Door Actuator Bracket assembly",
    "2019 Chevrolet Silverado 1500 Blend Door Actuator Bracket",
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

// ── siblingQueries (EV interchange retrieval widening) ───────────────────────

test("sibling hints become year-ranged queries, capped at two", () => {
  const hints = [
    { make: "Tesla", model: "Model 3", from: 2017, to: 2023 },
    { make: "Tesla", model: "Model Y", from: 2020, to: 2020 },
    { make: "Tesla", model: "Model S", from: 2012, to: 2020 },
  ];
  const qs = siblingQueries("Rear Drive Unit", hints);
  assert.deepEqual(qs, [
    "2017-2023 Tesla Model 3 Rear Drive Unit",
    "2020 Tesla Model Y Rear Drive Unit", // single-year span renders bare
  ]); // third hint dropped by the cap
  assert.deepEqual(siblingQueries("Rear Drive Unit", []), []);
  assert.deepEqual(siblingQueries("Rear Drive Unit", null), []);
});

// ── classifyComp (OEM / aftermarket title heuristics) ────────────────────────

test("classifyComp: real frozen-pool OEM pulls classify oem", () => {
  // Titles lifted from scripts/.cache/comps — all genuine salvage pulls.
  assert.equal(classifyComp("2018-2024 TOYOTA CAMRY FRONT BUMPER COVER OEM", "Used"), "oem");
  assert.equal(classifyComp("Front Bumper Cover White 2018-2020 Toyota Camry SE XSE 52119+06E20 OEM", "Used"), "oem");
  assert.equal(classifyComp("2018-2024 Toyota Camry Left Headlight Assembly Grey OEM 730601 42K Miles", "Used"), "oem");
  assert.equal(classifyComp("MERCEDES BENZ C300 HEADLIGHT LEFT DRIVER 2015 2016 2017 2018 HALOGEN A2059066902", "Used"), "oem");
  assert.equal(classifyComp("2016-2021 MERCEDES-BENZ C63 AMG S - REAR Trunk / DECK LID Shell 205750240028", "Used"), "oem");
});

test("classifyComp: reproduction brands and phrases classify aftermarket", () => {
  assert.equal(classifyComp("TYC Headlight Assembly Left Driver Side", "Used"), "aftermarket");
  assert.equal(classifyComp("Depo Tail Light Lamp Passenger Side New", "New"), "aftermarket");
  assert.equal(classifyComp("Front Bumper Cover Black Toyota Camry 2018 2019 2020 CAPA", "Used"), "aftermarket");
  assert.equal(classifyComp("Aftermarket Front Bumper Cover Primed", "Used"), "aftermarket");
  assert.equal(classifyComp("Headlight OE-Style Replacement for 2018 Camry", "New"), "aftermarket");
});

test("classifyComp: 'For <vehicle> 20xx-20xx' phrasing is aftermarket unless OEM evidence excuses it", () => {
  assert.equal(classifyComp("USED LED Projector Headlight For Toyota Camry 2018-2024 Head Lamps Sequential", "Used"), "aftermarket");
  assert.equal(classifyComp("RH+LH Full LED Projector Headlamp Assembly For Toyota Camry 2018-2024 Headlights", "Used"), "aftermarket");
  assert.equal(classifyComp("For 2018-2022 Camry Front Bumper Cover Replacement New", "New"), "aftermarket");
  // The excuses: an explicit OEM token, a part number, or mileage language.
  assert.equal(classifyComp("Tailgate for 2016-2019 Ford F-150 OEM w/ camera", "Used"), "oem");
  assert.equal(classifyComp("Headlight fits 2018-2024 Camry 42K Miles", "Used"), "oem");
});

test("classifyComp: bare fitment ranges never classify on their own", () => {
  // The most common OEM-pull title shape: leading year range, no for/fits.
  assert.equal(classifyComp("2018-2020 Toyota Camry Hood Panel Silver", "Used"), "unknown");
  assert.equal(classifyComp("W205 15-18 Mercedes C Class Front Bumper Cover Silver Damaged BR577", "Used"), "unknown");
});

test("classifyComp: 'new' on a Used listing is aftermarket, but take-offs are OEM", () => {
  assert.equal(classifyComp("Brand New Front Bumper Cover Primed Steel", "Used"), "aftermarket");
  assert.equal(classifyComp("New Take-Off Ford F150 Tailgate 2018 OEM", "Used"), "oem");
  assert.equal(classifyComp("F150 Tailgate new takeoff", "Used"), "oem"); // take-off language is OEM evidence in itself
});

test("classifyComp: year ranges never read as part numbers", () => {
  // "2018-2024" must not satisfy the OEM part-number pattern.
  assert.equal(classifyComp("2018-2024 Toyota Camry Front Bumper", "Used"), "unknown");
  assert.equal(classifyComp("", "Used"), "unknown");
});

// ── buildJudgeUserText: OEM tags + shell-aware INCLUDED block ────────────────

const judgePart = (over = {}) => ({
  part_id: "front-bumper-assembly",
  name: "Front Bumper",
  grade: "B",
  fitment: { year: 2018, make: "Toyota", model: "Camry" },
  comps: [],
  ...over,
});

test("judge listing lines carry the OEM/aftermarket tag, omit unknown", () => {
  const { marketData } = buildJudgeUserText(judgePart({
    comps: [
      { price: 199, title: "2018-2024 TOYOTA CAMRY FRONT BUMPER COVER OEM", condition: "Used", shipping: "free shipping", listedAt: "2026-01-15" },
      { price: 276, title: "Front Bumper Cover Black Toyota Camry 2018 2019 2020 CAPA", condition: "Used", shipping: null, listedAt: null },
      { price: 150, title: "2018-2020 Toyota Camry Hood Panel Silver", condition: "Used", shipping: null, listedAt: null },
    ],
  }));
  assert.ok(marketData.includes("[Used; free shipping; listed 2026-01-15; OEM]"));
  assert.ok(marketData.includes("CAPA [Used; shipping unknown; aftermarket]"));
  assert.ok(marketData.includes("Hood Panel Silver [Used; shipping unknown]")); // unknown → no tag
  assert.ok(marketData.includes("an OEM or aftermarket tag"));
});

test("assembly parts keep the complete-assembly INCLUDED block", () => {
  const { header } = buildJudgeUserText(judgePart());
  assert.ok(header.includes("This part is sold as a complete assembly as pulled from the vehicle."));
  assert.ok(header.includes("Attached components: bumper cover, reinforcement bar"));
  assert.ok(!header.includes("BARE SHELL"));
});

test("shell slugs invert the INCLUDED block", () => {
  const { header } = buildJudgeUserText(judgePart({ part_id: "front-bumper-cover", partSlug: "front-bumper-cover", name: "Front Bumper Cover" }));
  assert.ok(header.includes("This part is a BARE SHELL (Front Bumper Cover) — not a complete assembly."));
  assert.ok(header.includes("NOT included (sold with the complete assembly, absent here): bumper cover, reinforcement bar"));
  assert.ok(!header.includes("sold as a complete assembly as pulled"));
  // Without the slug, the same display name reads as the assembly (legacy alias, by design).
  const { header: legacy } = buildJudgeUserText(judgePart({ name: "Front Bumper Cover" }));
  assert.ok(legacy.includes("sold as a complete assembly as pulled"));
});

console.log(`  ${passed} passed`);
