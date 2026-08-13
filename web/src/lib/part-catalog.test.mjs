// Unit tests for the canonical part catalog. Runs with plain `node`:
//
//   node web/src/lib/part-catalog.test.mjs
//
// Registers the same .ts resolution hook as ebay-comps.test.mjs and re-runs itself.
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));

if (!process.env.__PART_CATALOG_TEST_CHILD) {
  const fs = await import("node:fs");
  const hookPath = pathResolve(HERE, ".part-catalog.ext-hook.mjs");
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
    { stdio: "inherit", env: { ...process.env, __PART_CATALOG_TEST_CHILD: "1" } },
  );
  try { fs.unlinkSync(hookPath); } catch { /* best-effort cleanup */ }
  process.exit(child.status ?? 1);
}

const assert = (await import("node:assert/strict")).default;
const {
  PART_CATALOG, CATALOG_BY_SLUG, canonicalizePart, canonicalPartId, resolveSaleUnit,
  visionCatalogSection, visionCenterList, visionLateralList, visionNameOf,
} = await import("./part-catalog.ts");
const { PART_ASSEMBLIES } = await import("./part-assemblies.ts");
const { resolveAssembly } = await import("./assembly-resolve.ts");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

test("slugs are unique", () => {
  const slugs = PART_CATALOG.map((e) => e.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("every assemblyKey exists in PART_ASSEMBLIES", () => {
  for (const e of PART_CATALOG) {
    if (e.assemblyKey !== null) assert.ok(PART_ASSEMBLIES[e.assemblyKey], `${e.slug} → ${e.assemblyKey}`);
  }
});

test("shell/assembly links are bidirectional and cross-typed", () => {
  for (const e of PART_CATALOG) {
    if (e.shellSlug) {
      const shell = CATALOG_BY_SLUG[e.shellSlug];
      assert.ok(shell, `${e.slug} shellSlug ${e.shellSlug} missing`);
      assert.equal(shell.saleUnit, "shell");
      assert.equal(shell.assemblySlug, e.slug, `${shell.slug} must link back to ${e.slug}`);
      assert.equal(e.saleUnit, "complete-assembly");
    }
    if (e.assemblySlug) {
      const asm = CATALOG_BY_SLUG[e.assemblySlug];
      assert.ok(asm, `${e.slug} assemblySlug ${e.assemblySlug} missing`);
      assert.equal(asm.saleUnit, "complete-assembly");
      assert.equal(e.saleUnit, "shell");
    }
  }
});

test("shell entries are hidden from vision (reachable only via completeness)", () => {
  for (const e of PART_CATALOG) {
    if (e.saleUnit === "shell") assert.equal(e.visionHidden, true, e.slug);
  }
});

test("every entry has at least one alias and one eBay query term", () => {
  for (const e of PART_CATALOG) {
    assert.ok(e.aliases.length >= 1, e.slug);
    assert.ok(e.ebayQueryTerms.length >= 1, e.slug);
  }
});

test("vision names round-trip to their own slug", () => {
  for (const e of PART_CATALOG) {
    if (e.visionHidden) continue;
    const c = canonicalizePart(visionNameOf(e));
    assert.ok(c, `${e.slug}: "${visionNameOf(e)}" did not canonicalize`);
    assert.equal(c.entry.slug, e.slug, `"${visionNameOf(e)}" → ${c.entry.slug}, expected ${e.slug}`);
  }
});

test("sided names round-trip with the side captured", () => {
  for (const e of PART_CATALOG) {
    if (e.visionHidden || e.sidedness !== "lateral") continue;
    const name = `Driver Side ${visionNameOf(e)}`;
    const c = canonicalizePart(name);
    assert.ok(c, name);
    assert.equal(c.entry.slug, e.slug, name);
    assert.equal(c.side, "driver", name);
    assert.equal(c.partId, `${e.slug}:driver`, name);
    const p = canonicalizePart(`Passenger Side ${visionNameOf(e)}`);
    assert.equal(p?.partId, `${e.slug}:passenger`);
  }
});

test("center parts never carry a side in their partId", () => {
  const c = canonicalizePart("Left Hood"); // nonsense input, but must not produce a sided hood
  assert.ok(c);
  assert.equal(c.entry.slug, "hood");
  assert.equal(c.side, null);
  assert.equal(c.partId, "hood");
});

test("legacy names resolve as designed", () => {
  // The known bug: legacy "Front Bumper Cover" meant the on-car COMPLETE bumper.
  assert.equal(canonicalizePart("Front Bumper Cover")?.entry.slug, "front-bumper-assembly");
  assert.equal(canonicalizePart("Rear Bumper Cover")?.entry.slug, "rear-bumper-assembly");
  // applyVinEngine's spec suffix strips.
  assert.equal(canonicalizePart("Engine — 2.5L I4")?.entry.slug, "engine-assembly");
  // Slash + side conventions.
  assert.equal(canonicalPartId("Wheel / Rim"), "wheel-rim");
  assert.equal(canonicalPartId("Driver Side Front Door"), "front-door-assembly:driver");
  assert.equal(canonicalPartId("Passenger Side Mirror"), "side-mirror-assembly:passenger");
  assert.equal(canonicalPartId("Left Fender"), "front-fender:driver");
  assert.equal(canonicalPartId("Tail Light Assembly"), "taillight-assembly");
  // Interior rear-view mirror is its own center part, never the side mirror.
  assert.equal(canonicalPartId("Rear View Mirror"), "rear-view-mirror");
});

test("sub-components do NOT canonicalize to their parent assembly", () => {
  assert.equal(canonicalizePart("Front Door Window Regulator"), null);
  assert.equal(canonicalizePart("Tailgate Handle"), null);
  assert.equal(canonicalizePart("Mirror Glass"), null);
  // Door panels are their own SKU, not doors.
  assert.equal(canonicalizePart("Front Door Panel")?.entry.slug, "front-door-panel");
  assert.equal(canonicalizePart("Door Panel")?.entry.slug, "door-panel");
  // Windows are glass, not doors.
  assert.equal(canonicalizePart("Front Door Window")?.entry.slug, "front-door-window");
});

test("resolveSaleUnit: completeness picks shell vs assembly", () => {
  assert.equal(resolveSaleUnit("Front Bumper", "shell")?.slug, "front-bumper-cover");
  assert.equal(resolveSaleUnit("Front Bumper", "complete")?.slug, "front-bumper-assembly");
  assert.equal(resolveSaleUnit("Front Bumper", "unknown")?.slug, "front-bumper-assembly");
  assert.equal(resolveSaleUnit("Front Bumper")?.slug, "front-bumper-assembly");
  assert.equal(resolveSaleUnit("Engine", "shell")?.slug, "engine-long-block");
  assert.equal(resolveSaleUnit("Headlight Assembly", "shell")?.slug, "headlight-housing");
  // A shell slug explicitly marked complete upgrades to the assembly.
  assert.equal(resolveSaleUnit("front-bumper-cover", "complete")?.slug, "front-bumper-assembly");
  // Shell signal on a part with no shell split keeps the entry (fail-soft).
  assert.equal(resolveSaleUnit("Grille", "shell")?.slug, "grille");
  assert.equal(resolveSaleUnit("Totally Unknown Part", "shell"), null);
});

test("catalog agrees with resolveAssembly on the judge's completeness data", () => {
  for (const e of PART_CATALOG) {
    if (e.visionHidden || !e.assemblyKey) continue;
    const viaName = resolveAssembly(visionNameOf(e));
    assert.ok(viaName, `resolveAssembly("${visionNameOf(e)}") returned null but catalog maps ${e.slug} → ${e.assemblyKey}`);
    assert.equal(viaName.key, e.assemblyKey, `${e.slug}: resolveAssembly → ${viaName.key}, catalog → ${e.assemblyKey}`);
  }
});

test("visionCatalogSection contains every vision name and no shell-only name", () => {
  const section = visionCatalogSection();
  for (const e of PART_CATALOG) {
    if (e.visionHidden) {
      if (e.slug === "front-bumper-cover" || e.slug === "rear-bumper-cover") continue; // substring of the assembly's legacy alias context — checked below
      assert.ok(!section.includes(`"${e.displayName}"`), `shell ${e.slug} leaked into the vision catalog`);
    } else {
      assert.ok(section.includes(`"${visionNameOf(e)}"`), `${e.slug} missing from the vision catalog`);
    }
  }
  // The bumper fix specifically: vision is told "Front Bumper", never the shell name.
  assert.ok(section.includes('"Front Bumper"'));
  assert.ok(!section.includes('"Front Bumper Cover"'));
  assert.ok(section.includes('"Wheel / Rim"'));
});

test("center/lateral vision lists partition and cover the right names", () => {
  const center = visionCenterList();
  const lateral = visionLateralList();
  for (const e of PART_CATALOG) {
    if (e.visionHidden) continue;
    const n = visionNameOf(e);
    if (e.sidedness === "center") assert.ok(center.includes(n), `${n} missing from center list`);
    if (e.sidedness === "lateral") assert.ok(lateral.includes(n), `${n} missing from lateral list`);
  }
  assert.ok(center.includes("Front Bumper"));
  assert.ok(lateral.includes("Headlight Assembly"));
  assert.ok(!lateral.includes("Rear View Mirror")); // interior mirror is center, not a side part
});

console.log(`part-catalog: ${passed} passed`);
