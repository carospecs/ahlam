// SEO verification harness for the {slug}.ahlam.io shop sites + apex pages.
// Assumes a PRODUCTION server is ALREADY running on http://localhost:3100:
//   next build && next start -p 3100   (run separately by the operator)
// This script does NOT build or start anything — it only probes and asserts.
// Run from web/:
//   node scripts/verify-seo.mjs      (or: npm run verify:seo)
// Uses curl via spawnSync because undici/fetch blocks Host header overrides.
// Dependency-free. Exits 1 if any assertion fails.
import { spawnSync } from "node:child_process";

const BASE = process.env.SEO_BASE_URL || "http://localhost:3100";
const DAD_HOST = "downtownautodismantlers.ahlam.io";
const FAKE_HOST = "somefakeyard123.ahlam.io";
const APEX_HOST = "ahlam.io";
const DAD_ORIGIN = `https://${DAD_HOST}`;
const DAD_SHOP_ID = "159c4cdc-3cbc-4061-9942-5c901486df49";

// ── HTTP via curl (no redirect following; headers + body + status captured) ──
const responseCache = new Map();

function request(host, path) {
  const key = `${host}|${path}`;
  if (responseCache.has(key)) return responseCache.get(key);
  const res = spawnSync(
    "curl",
    ["-s", "-D", "-", "-o", "-", "-w", "\n__HTTP_STATUS__:%{http_code}", "-H", `Host: ${host}`, `${BASE}${path}`],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  let out;
  if (res.error || res.status !== 0) {
    out = { status: 0, headers: {}, body: "", error: res.error?.message || res.stderr || `curl exited ${res.status}` };
  } else {
    const raw = res.stdout;
    const statusMatch = raw.match(/\n__HTTP_STATUS__:(\d{3})$/);
    const status = statusMatch ? Number(statusMatch[1]) : 0;
    let rest = statusMatch ? raw.slice(0, statusMatch.index) : raw;
    // Strip header block(s) written by -D - (loop handles interim 1xx responses).
    const headers = {};
    while (/^HTTP\//.test(rest)) {
      let end = rest.indexOf("\r\n\r\n");
      let sepLen = 4;
      if (end === -1) { end = rest.indexOf("\n\n"); sepLen = 2; }
      if (end === -1) break;
      for (const line of rest.slice(0, end).split(/\r?\n/).slice(1)) {
        const i = line.indexOf(":");
        if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
      }
      rest = rest.slice(end + sepLen);
    }
    out = { status, headers, body: rest };
  }
  responseCache.set(key, out);
  return out;
}

// ── HTML helpers (regex-based; good enough for our own rendered output) ──────
function attrOf(tag, attr) {
  const m = tag.match(new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? (m[2] ?? m[3]) : null;
}

function titleOf(body) {
  const m = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

function metaDescriptionOf(body) {
  for (const tag of body.match(/<meta\b[^>]*>/gi) || []) {
    if (/name\s*=\s*["']description["']/i.test(tag)) return attrOf(tag, "content");
  }
  return null;
}

function canonicalOf(body) {
  for (const tag of body.match(/<link\b[^>]*>/gi) || []) {
    if (/rel\s*=\s*["']canonical["']/i.test(tag)) return attrOf(tag, "href");
  }
  return null;
}

function jsonLdBlocks(body) {
  const blocks = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(body))) {
    try { blocks.push(JSON.parse(m[1])); } catch { /* unparseable block: ignored */ }
  }
  return blocks;
}

// Deep-search parsed JSON-LD for a node whose @type matches one of `types`.
function findLdNode(value, types) {
  if (Array.isArray(value)) {
    for (const v of value) { const hit = findLdNode(v, types); if (hit) return hit; }
    return null;
  }
  if (value && typeof value === "object") {
    const t = value["@type"];
    const list = Array.isArray(t) ? t : [t];
    if (list.some((x) => types.includes(x))) return value;
    for (const v of Object.values(value)) { const hit = findLdNode(v, types); if (hit) return hit; }
  }
  return null;
}

function storeNode(body) {
  for (const block of jsonLdBlocks(body)) {
    const node = findLdNode(block, ["AutoPartsStore", "AutomotiveBusiness"]);
    if (node) return node;
  }
  return null;
}

function sameOrigin(href, origin) {
  return href === origin || href === `${origin}/`;
}

// ── test cases ───────────────────────────────────────────────────────────────
// expect(body, status, headers) returns an array of failure strings (empty = PASS).
const tests = [
  // Shop subdomain: downtownautodismantlers.ahlam.io
  {
    name: "DAD home: status 200",
    host: DAD_HOST,
    path: "/",
    expect: (body, status) => (status === 200 ? [] : [`expected 200, got ${status}`]),
  },
  {
    name: 'DAD home: <title> starts with "Downtown Auto Dismantlers"',
    host: DAD_HOST,
    path: "/",
    expect: (body) => {
      const title = titleOf(body);
      if (!title) return ["no <title> found"];
      return title.startsWith("Downtown Auto Dismantlers") ? [] : [`title is ${JSON.stringify(title)}`];
    },
  },
  {
    name: 'DAD home: meta description contains "6828 McKinley Ave"',
    host: DAD_HOST,
    path: "/",
    expect: (body) => {
      const desc = metaDescriptionOf(body);
      if (desc == null) return ["no <meta name=\"description\"> found"];
      return desc.includes("6828 McKinley Ave") ? [] : [`description is ${JSON.stringify(desc)}`];
    },
  },
  {
    name: `DAD home: canonical is ${DAD_ORIGIN}`,
    host: DAD_HOST,
    path: "/",
    expect: (body) => {
      const href = canonicalOf(body);
      if (href == null) return ["no <link rel=\"canonical\"> found"];
      return sameOrigin(href, DAD_ORIGIN) ? [] : [`canonical is ${JSON.stringify(href)}`];
    },
  },
  {
    name: "DAD home: JSON-LD AutoPartsStore/AutomotiveBusiness present",
    host: DAD_HOST,
    path: "/",
    expect: (body) => {
      const blocks = jsonLdBlocks(body);
      if (blocks.length === 0) return ["no parseable application/ld+json script found"];
      return storeNode(body) ? [] : [`no AutoPartsStore/AutomotiveBusiness node in ${blocks.length} JSON-LD block(s)`];
    },
  },
  {
    name: 'DAD home: JSON-LD telephone contains "758-5167"',
    host: DAD_HOST,
    path: "/",
    expect: (body) => {
      const node = storeNode(body);
      if (!node) return ["store node missing (see previous test)"];
      const tel = String(node.telephone ?? "");
      return tel.includes("758-5167") ? [] : [`telephone is ${JSON.stringify(node.telephone)}`];
    },
  },
  {
    name: 'DAD home: JSON-LD postalCode is "90001"',
    host: DAD_HOST,
    path: "/",
    expect: (body) => {
      const node = storeNode(body);
      if (!node) return ["store node missing (see previous test)"];
      return JSON.stringify(node).includes('"90001"') ? [] : ["postalCode 90001 not found in store node"];
    },
  },
  {
    name: "DAD robots.txt: 200, Allow + absolute Sitemap",
    host: DAD_HOST,
    path: "/robots.txt",
    expect: (body, status) => {
      const fails = [];
      if (status !== 200) fails.push(`expected 200, got ${status}`);
      if (!body.includes("Allow")) fails.push('missing "Allow"');
      if (!body.includes(`Sitemap: ${DAD_ORIGIN}/sitemap.xml`)) fails.push(`missing "Sitemap: ${DAD_ORIGIN}/sitemap.xml"`);
      return fails;
    },
  },
  {
    name: "DAD sitemap.xml: 200 with shop origin URLs",
    host: DAD_HOST,
    path: "/sitemap.xml",
    expect: (body, status) => {
      const fails = [];
      if (status !== 200) fails.push(`expected 200, got ${status}`);
      if (!body.includes(DAD_ORIGIN)) fails.push(`missing "${DAD_ORIGIN}"`);
      return fails;
    },
  },
  {
    name: "DAD /guides: 404 (apex content must not leak)",
    host: DAD_HOST,
    path: "/guides",
    expect: (body, status) => (status === 404 ? [] : [`expected 404, got ${status}`]),
  },

  // Unknown subdomain
  {
    name: "Fake subdomain robots.txt: Disallow: /",
    host: FAKE_HOST,
    path: "/robots.txt",
    expect: (body) => (body.includes("Disallow: /") ? [] : ['missing "Disallow: /"']),
  },

  // Apex: ahlam.io
  {
    name: 'Apex home: 200, title contains "Ahlam"',
    host: APEX_HOST,
    path: "/",
    expect: (body, status) => {
      const fails = [];
      if (status !== 200) fails.push(`expected 200, got ${status}`);
      const title = titleOf(body);
      if (!title || !title.includes("Ahlam")) fails.push(`title is ${JSON.stringify(title)}`);
      return fails;
    },
  },
  {
    name: "Apex /shops: 200, links to DAD subdomain",
    host: APEX_HOST,
    path: "/shops",
    expect: (body, status) => {
      const fails = [];
      if (status !== 200) fails.push(`expected 200, got ${status}`);
      if (!body.includes(`href="${DAD_ORIGIN}`)) fails.push(`missing href="${DAD_ORIGIN}`);
      return fails;
    },
  },
  {
    name: `Apex /shop/${DAD_SHOP_ID}: canonical is DAD subdomain`,
    host: APEX_HOST,
    path: `/shop/${DAD_SHOP_ID}`,
    expect: (body) => {
      const href = canonicalOf(body);
      if (href == null) return ["no <link rel=\"canonical\"> found"];
      return sameOrigin(href, DAD_ORIGIN) ? [] : [`canonical is ${JSON.stringify(href)}`];
    },
  },
  {
    name: "Apex /site/downtownautodismantlers: permanent redirect to subdomain",
    host: APEX_HOST,
    path: "/site/downtownautodismantlers",
    expect: (body, status, headers) => {
      const fails = [];
      if (![301, 307, 308].includes(status)) fails.push(`expected 301/307/308, got ${status}`);
      const location = headers.location || "";
      if (!location.includes(DAD_HOST)) fails.push(`Location is ${JSON.stringify(location)}`);
      return fails;
    },
  },
];

// ── runner ───────────────────────────────────────────────────────────────────
console.log(`verify-seo: probing ${BASE} (server must already be running)\n`);

const results = [];
for (const t of tests) {
  const res = request(t.host, t.path);
  let fails;
  if (res.error) {
    fails = [`request failed: ${res.error}`];
  } else {
    try {
      fails = t.expect(res.body, res.status, res.headers);
    } catch (err) {
      fails = [`expect threw: ${err.message}`];
    }
  }
  const pass = fails.length === 0;
  results.push({ name: t.name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${t.name}`);
  for (const f of fails) console.log(`      ↳ ${f}`);
}

// ── summary table ────────────────────────────────────────────────────────────
const width = Math.max(...results.map((r) => r.name.length));
console.log(`\n${"─".repeat(width + 8)}`);
for (const r of results) console.log(`${r.name.padEnd(width)}  ${r.pass ? "PASS" : "FAIL"}`);
console.log("─".repeat(width + 8));
const failed = results.filter((r) => !r.pass).length;
console.log(`${results.length - failed}/${results.length} passed`);

process.exit(failed > 0 ? 1 : 0);
