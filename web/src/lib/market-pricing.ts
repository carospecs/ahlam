// MARKET-PRICING AGENT — prices parts from real market listings, not memory.
// One Claude call per vehicle with the server-side web_search tool: the agent
// spends a bounded search budget (≤8 searches, 120s wall clock) on the parts
// where mispricing costs real money (engines, battery packs, tailgates, other
// high-value items) using venue-level queries (car-part.com, eBay, dismantler
// listings), and prices the long tail from knowledge with wider bands and lower
// confidence. Confidence is EVIDENCE-based, not vibes:
//   high   = 3+ concordant listings for the exact vehicle/part   (band ±10–15%)
//   medium = comps from a similar trim/generation                (band ±20–25%)
//   low    = no usable comps — knowledge estimate                (band ±35%)
// Grade-C parts get no research spend and stay unpriced (the route nulls them).
// Callers fall back to the memory pricer (lib/anthropic claudePriceParts) when
// this returns null — the scan never depends on research succeeding.
import { getAnthropic, pricingModel } from "./anthropic";

export type MarketConfidence = "high" | "medium" | "low";

export type MarketPricedPart = {
  name: string;
  usedPartPriceUsd: number | null;
  usedPartPriceLowUsd: number | null;
  usedPartPriceHighUsd: number | null;
  confidence: MarketConfidence;
  compCount: number;
  sourceDomains: string[];
};

export const MARKET_BUDGET_MS = 120_000; // hard wall clock for the whole research call
const MAX_SEARCHES = 8;

// Structured-output schema. web_search + json_schema may or may not compose on a
// given API build — marketPriceParts probes once and falls back to instructed
// JSON automatically (see runMarketCall).
const MARKET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["parts"],
  properties: {
    parts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "usedPartPriceUsd",
          "usedPartPriceLowUsd",
          "usedPartPriceHighUsd",
          "confidence",
          "compCount",
          "sourceDomains",
        ],
        properties: {
          name: { type: "string" },
          usedPartPriceUsd: { type: ["number", "null"] },
          usedPartPriceLowUsd: { type: ["number", "null"] },
          usedPartPriceHighUsd: { type: ["number", "null"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          compCount: { type: "number" },
          sourceDomains: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const MARKET_SYSTEM =
  "You are a market-pricing agent for a salvage yard / dismantler. For the exact vehicle the user names, price every " +
  "listed part at the typical price a dismantler LISTS it for as a USED/recycled part — the realistic ASKING price on " +
  "car-part.com, eBay, and dismantler listings. NEVER the new/OEM/MSRP/aftermarket-new price, and not a fire-sale or " +
  "wholesale clearance price either.\n\n" +
  "RESEARCH BUDGET — you have a limited number of web searches. Spend them where mispricing costs real money: the " +
  "highest-value parts first (engines, transmissions, battery packs, drive units, tailgates, doors, headlamp " +
  "assemblies, wheels), and parts with demand-driven prices (frequently stolen or fast-selling items like truck " +
  "tailgates command listing prices at the TOP of their range). Use venue-level queries (e.g. site or marketplace " +
  "listings for this exact vehicle + part). Do NOT spend searches on low-value or generic parts — price those from " +
  "knowledge. Never search for parts graded C.\n\n" +
  "CONFIDENCE is evidence-based, per part:\n" +
  '- "high": you found 3+ concordant CURRENT listings for this exact vehicle/part. Band tight: ±10–15%.\n' +
  '- "medium": you found comps for a similar trim or the same generation. Band ±20–25%.\n' +
  '- "low": no usable comps — a knowledge estimate. Band wide: ±35%.\n' +
  "compCount = how many real listings you actually saw for that part (0 when none). sourceDomains = the bare domains " +
  'the comps came from (e.g. ["ebay.com", "car-part.com"]) — empty when none.\n\n' +
  "Rules: left & right of a paired part get the SAME price. Use realistic round numbers. If you truly have no basis " +
  "for a price, use null (with null band). low ≤ price ≤ high always. Echo each part's exact given name WITHOUT the " +
  'parenthetical grade metadata — for "3. Tailgate (grade A)" the name is "Tailgate".';

// ── Pure helpers (unit-tested with plain node — keep free of SDK/env access) ──

// Strip optional markdown fences and parse the {parts:[...]} JSON envelope.
export function parseMarketJson(text: string): unknown[] | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { parts?: unknown[] };
    return Array.isArray(parsed?.parts) ? parsed.parts : null;
  } catch {
    return null;
  }
}

// Coerce one model row into a MarketPricedPart, or null when malformed.
// Normalizes band ordering, clamps the point into the band, strips an echoed
// "(inferred)" suffix, and reduces sourceDomains to clean bare domains.
export function sanitizeMarketRow(row: unknown): MarketPricedPart | null {
  const r = row as Record<string, unknown>;
  if (!r || typeof r.name !== "string" || !r.name.trim()) return null;
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);
  const mid = num(r.usedPartPriceUsd);
  let lo = num(r.usedPartPriceLowUsd), hi = num(r.usedPartPriceHighUsd);
  if (mid == null) { lo = null; hi = null; }
  else if (lo != null && hi != null) {
    if (lo > hi) [lo, hi] = [hi, lo];
    lo = Math.min(lo, mid); hi = Math.max(hi, mid);
  } else { lo = null; hi = null; }
  const confidence: MarketConfidence =
    r.confidence === "high" || r.confidence === "medium" || r.confidence === "low" ? r.confidence : "low";
  const compCount = typeof r.compCount === "number" && r.compCount > 0 ? Math.min(50, Math.round(r.compCount)) : 0;
  const domains = Array.isArray(r.sourceDomains)
    ? [...new Set(r.sourceDomains
        .filter((d): d is string => typeof d === "string" && !!d.trim())
        .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0])
        .filter((d) => d.includes(".")))]
        .slice(0, 5)
    : [];
  return {
    // The part list annotates each name with "(grade X[, inferred])" metadata and
    // the model sometimes echoes it — strip any such trailing annotation so the
    // route's match-by-name works.
    name: r.name.replace(/\s*\((?:grade\s+[a-c])?(?:,?\s*inferred)?\)\s*$/i, "").trim(),
    usedPartPriceUsd: mid,
    usedPartPriceLowUsd: lo,
    usedPartPriceHighUsd: hi,
    // Evidence gate: a confidence claim without any comps is a knowledge estimate.
    confidence: compCount === 0 && confidence !== "low" ? "low" : confidence,
    compCount,
    sourceDomains: domains,
  };
}

// ── The agent call ────────────────────────────────────────────────────────────

type MessageParam = { role: "user" | "assistant"; content: unknown };

// Whether json_schema output composes with web_search on the current API build.
// Probed on first failure and remembered for the process lifetime.
let schemaComposes: boolean | null = null;
export function composePathActive(): "json_schema" | "instructed-json" | "unprobed" {
  return schemaComposes === null ? "unprobed" : schemaComposes ? "json_schema" : "instructed-json";
}

async function runMarketCall(user: string, deadline: number): Promise<string | null> {
  const timeLeft = () => {
    const ms = deadline - Date.now();
    if (ms < 5_000) throw new Error("market budget exhausted");
    return Math.min(ms, 60_000);
  };
  const base = {
    model: pricingModel(),
    max_tokens: 16000,
    thinking: { type: "adaptive" as const },
    output_config: { effort: "medium" as const },
    tools: [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: MAX_SEARCHES }],
    system: MARKET_SYSTEM,
  };
  const create = async (messages: MessageParam[], withSchema: boolean) =>
    getAnthropic().messages.create(
      {
        ...base,
        ...(withSchema
          ? { output_config: { effort: "medium" as const, format: { type: "json_schema" as const, schema: MARKET_SCHEMA as unknown as Record<string, unknown> } } }
          : {}),
        messages: messages as never,
      },
      { timeout: timeLeft() },
    );

  const instructed =
    user +
    '\n\nReturn ONLY a JSON object (no prose, no markdown): {"parts": [{"name": string, "usedPartPriceUsd": number|null, ' +
    '"usedPartPriceLowUsd": number|null, "usedPartPriceHighUsd": number|null, "confidence": "high"|"medium"|"low", ' +
    '"compCount": number, "sourceDomains": string[]}]}';

  let useSchema = schemaComposes !== false;
  let messages: MessageParam[] = [{ role: "user", content: useSchema ? user : instructed }];
  let resp;
  try {
    resp = await create(messages, useSchema);
    if (useSchema) schemaComposes = true;
  } catch (e) {
    // A 400 on the schema path means json_schema + web_search don't compose on
    // this build — retry once with instructed JSON. Anything else bubbles up.
    const status = (e as { status?: number }).status;
    if (!useSchema || status !== 400) throw e;
    schemaComposes = false;
    useSchema = false;
    messages = [{ role: "user", content: instructed }];
    resp = await create(messages, false);
  }
  // Server-tool loop: resume pause_turn within the same wall-clock budget.
  for (let i = 0; i < 4 && resp.stop_reason === "pause_turn"; i++) {
    messages = [...messages, { role: "assistant", content: resp.content }];
    resp = await create(messages, useSchema);
  }
  return resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n") || null;
}

// Price the given parts from live market research. Returns null on ANY failure
// (including budget exhaustion before a usable reply) — the caller falls back to
// the memory pricer. Never include Grade-C parts in `parts`.
export async function marketPriceParts(input: {
  vehicleId: string;
  spec: string;
  powertrainLine: string | null;
  parts: { name: string; grade: string; inferred?: boolean }[];
}): Promise<MarketPricedPart[] | null> {
  if (!input.parts.length) return [];
  const list = input.parts
    .map((p, i) => `${i + 1}. ${p.name} (grade ${p.grade}${p.inferred ? ", inferred" : ""})`)
    .join("\n");
  const user =
    `USED ${input.vehicleId}${input.spec ? ` (${input.spec})` : ""}.\n` +
    `${input.powertrainLine ? input.powertrainLine + "\n" : ""}` +
    `Price these parts (inferred = not photographed but expected present; price normally):\n${list}`;
  try {
    const text = await runMarketCall(user, Date.now() + MARKET_BUDGET_MS);
    if (!text) return null;
    const rows = parseMarketJson(text);
    if (!rows) return null;
    const out = rows.map(sanitizeMarketRow).filter((r): r is MarketPricedPart => r !== null);
    return out.length ? out : null;
  } catch {
    return null;
  }
}
