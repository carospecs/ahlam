// Guards the client-site registry against the exact failure that hid Aacon's
// inventory: the subdomain map and pinned public profile pointed at different
// shop rows. Runs with the web package's plain `node` test command.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));

if (!process.env.__SHOP_SUBDOMAIN_TEST_CHILD) {
  const hookPath = pathResolve(HERE, ".shop-subdomains.ext-hook.mjs");
  writeFileSync(
    hookPath,
    [
      'import { fileURLToPath, pathToFileURL } from "node:url";',
      'import { existsSync } from "node:fs";',
      'import { dirname, resolve as pathResolve } from "node:path";',
      "export function resolve(specifier, context, nextResolve) {",
      '  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {',
      "    const abs = pathResolve(dirname(fileURLToPath(context.parentURL)), specifier);",
      "    if (!existsSync(abs)) for (const ext of ['.ts', '.tsx']) if (existsSync(abs + ext)) return nextResolve(pathToFileURL(abs + ext).href, context);",
      "  }",
      "  return nextResolve(specifier, context);",
      "}",
    ].join("\n"),
  );
  const child = spawnSync(
    process.execPath,
    ["--no-warnings=MODULE_TYPELESS_PACKAGE_JSON", "--import", `data:text/javascript,import { register } from "node:module"; register(${JSON.stringify(pathToFileURL(hookPath).href)});`, fileURLToPath(import.meta.url)],
    { stdio: "inherit", env: { ...process.env, __SHOP_SUBDOMAIN_TEST_CHILD: "1" } },
  );
  try { unlinkSync(hookPath); } catch { /* best-effort cleanup */ }
  process.exit(child.status ?? 1);
}

const assert = (await import("node:assert/strict")).default;
const { SHOP_SUBDOMAINS } = await import("./shop-subdomains.ts");
const { SHOP_STATIC_PROFILES } = await import("./shop-static-profiles.ts");
const { CLIENT_STOREFRONTS } = await import("../../scripts/marketing-core.mjs");

for (const [slug, profile] of Object.entries(SHOP_STATIC_PROFILES)) {
  assert.equal(
    SHOP_SUBDOMAINS[slug],
    profile.id,
    `${slug} maps to two shop IDs; its dashboard inventory will not reach its personal site`,
  );
}

for (const [slug, shopId] of Object.entries(SHOP_SUBDOMAINS)) {
  assert.equal(
    new URL(CLIENT_STOREFRONTS[shopId]).hostname,
    `${slug}.ahlam.io`,
    `${slug} is missing or mismatched in the scheduled marketing registry`,
  );
}

assert.equal(SHOP_SUBDOMAINS.aaconautoparts, "9e40bef8-f3d4-4f5a-bc99-b01af1053499");
console.log(`shop-subdomains: ${Object.keys(SHOP_STATIC_PROFILES).length} client mappings agree`);
