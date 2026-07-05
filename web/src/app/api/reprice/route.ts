// The universal pricing pass — every scan's part list is priced for the EXACT
// decoded vehicle through a tier ladder, BLOCKING in the scan's critical path:
//   cached market comp (≤14d)
//   → COMPS-FIRST: our code pulls real eBay listings in parallel (lib/ebay-comps),
//     then ONE batched fast-tier judgment call prices everything with comps
//     (lib/price-judge — a function, not an agent; see PRICING_MIGRATION_INSTRUCTION)
//   → zero-comp parts only: grounded web-search fallback on the strong model
//     (lib/market-pricing), run concurrently so it never blocks the fast majority
//   → Claude memory estimate → Gemini → the client's Gemini-vision prices.
// Market tiers return evidence-based confidence + comp counts + source domains;
// MARKET_RESEARCH=off skips the market tiers entirely (memory → Gemini only).
import { NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini";
import { anthropicEnabled, claudePriceParts, type RawPricedPart } from "@/lib/anthropic";
import { marketPriceParts, type MarketConfidence } from "@/lib/market-pricing";
import { fetchCompsForParts } from "@/lib/ebay-comps";
import { priceParts, type JudgeInputPart } from "@/lib/price-judge";
import { compKey, readMarketComps, writeMarketComps } from "@/lib/market-cache";
import { isSanePrice } from "@/lib/price-bands";
import { decodeVin, engineLabel } from "@/lib/vin";
import { type ConditionGrade } from "@/lib/age-pricing";
import { gradeAdjustUsed } from "@/lib/used-pricing";
import { classifyPowertrain, powertrainPromptLine } from "@/lib/powertrain";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 180; // parallel comps + one fast judgment call; the ≤120s grounded fallback only runs for zero-comp parts

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

type InPart = { name: string; grade: string; inferred?: boolean };

type RawPriced = { name?: string; usedPartPriceUsd?: unknown; usedPartPriceLowUsd?: unknown; usedPartPriceHighUsd?: unknown };

// Tier-2 fallback: the original Gemini text-only pricing call, prompt unchanged.
async function geminiPriceParts(prompt: string): Promise<RawPriced[] | null> {
  try {
    const res = await geminiGenerate("gemini-2.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text: string = (j.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text ?? "").join("");
    const arr = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim());
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // Auth: web session cookie OR Bearer token (same as /api/identify).
  const supabase = await (await import("@/lib/supabase-server")).supabaseServer();
  let { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const auth = req.headers.get("authorization") || "";
    if (auth.startsWith("Bearer ")) {
      const { data } = await supabaseAdmin().auth.getUser(auth.slice(7));
      user = data.user;
    }
  }
  if (!user) return NextResponse.json({ ok: false, error: "no auth" }, { status: 401, headers: CORS });

  let body: {
    vin?: string;
    vehicle?: { year?: number | null; make?: string | null; model?: string | null; trim?: string | null; engine?: string | null; drivetrain?: string | null };
    parts?: InPart[];
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad body" }, { status: 400, headers: CORS }); }

  const parts = (Array.isArray(body.parts) ? body.parts : [])
    .filter((p): p is InPart => !!p && typeof p.name === "string" && p.name.trim().length > 0)
    .slice(0, 80);
  if (!parts.length) return NextResponse.json({ ok: false, error: "no parts" }, { status: 400, headers: CORS });

  // Resolve the vehicle spec — prefer decoding the VIN (ground truth) over passed fields.
  let v = body.vehicle ?? {};
  let decoded: Awaited<ReturnType<typeof decodeVin>> = null;
  if (body.vin) {
    decoded = await decodeVin(body.vin);
    if (decoded) v = { year: decoded.year, make: decoded.make, model: decoded.model, trim: decoded.trim, engine: engineLabel(decoded), drivetrain: decoded.driveType };
  }
  const id = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
  if (!id) return NextResponse.json({ ok: false, error: "no vehicle" }, { status: 400, headers: CORS });
  const spec = [v.engine ? `engine ${v.engine}` : null, v.drivetrain ? `drivetrain ${v.drivetrain}` : null].filter(Boolean).join(", ");

  // Powertrain steer: the pricer must know a BEV's valuable parts from a gas car's.
  // The full NHTSA decode (electrification fields) wins over name heuristics.
  const powertrain = classifyPowertrain(decoded ?? { make: v.make, model: v.model, trim: v.trim });

  // One text-only call: USED-market selling price per part for THIS exact vehicle.
  // Echo the name back so the client can match by name (order is not relied upon).
  const list = parts.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
  const prompt =
    `You price USED auto parts for salvage yards / dismantlers. For a USED ${id}${spec ? ` (${spec})` : ""}, give the typical ` +
    `price a dismantler LISTS each part below for as a USED/recycled part — the realistic ASKING price you'd see on ` +
    `car-part.com, eBay, and dismantler listings for this exact vehicle in good used condition. ` +
    `NEVER the new/OEM/MSRP/aftermarket-new price (a used part lists for a fraction of new), and not a fire-sale or ` +
    `wholesale clearance price either — the price a yard would actually put on the listing. ` +
    `${powertrain.source !== "default" ? powertrainPromptLine(powertrain.type) + " " : ""}` +
    `Left & right of a paired part get the SAME price. ` +
    `Use realistic round numbers; if you truly have no basis for one, use null. ` +
    `Also give the realistic USED-listing RANGE as usedPartPriceLowUsd / usedPartPriceHighUsd (low ≤ price ≤ high): ` +
    `tight (±15% or less) when you know the part and vehicle well, wider when you're less sure. Null range when the price is null.\n\n` +
    `Return ONLY a JSON array (no prose), one object per part, shape: [{"name": string, "usedPartPriceUsd": number|null, "usedPartPriceLowUsd": number|null, "usedPartPriceHighUsd": number|null}]. ` +
    `Use the exact part names given.\n\nParts:\n${list}`;

  // ── THE TIER LADDER ────────────────────────────────────────────────────────
  // cached market comp (≤14d) → live web research → Claude memory → Gemini.
  // Every tier returns the same raw {name, price, low, high} shape; market tiers
  // also carry evidence metadata (confidence/compCount/sources). A tier failure
  // falls through — the route never 500s on a model error. MARKET_RESEARCH=off
  // restores the exact pre-agent behavior (memory → Gemini).
  const num = (v: unknown): number | null => (typeof v === "number" && v > 0 ? v : null);
  type Priced = { mid: number | null; lo: number | null; hi: number | null };
  const fromRaw = (r: RawPriced | undefined): Priced => {
    const mid = num(r?.usedPartPriceUsd);
    let lo = num(r?.usedPartPriceLowUsd), hi = num(r?.usedPartPriceHighUsd);
    if (mid == null || lo == null || hi == null) return { mid, lo: null, hi: null };
    if (lo > hi) [lo, hi] = [hi, lo];
    return { mid, lo: Math.min(lo, mid), hi: Math.max(hi, mid) };
  };
  const nameKey = (s: string) => s.toLowerCase().trim();
  const gradeOf = (p: InPart): ConditionGrade =>
    (["A", "B", "C"] as const).includes(p.grade as ConditionGrade) ? (p.grade as ConditionGrade) : "B";

  type Meta = { confidence: MarketConfidence; compCount: number; sources: string[] };
  const byName = new Map<string, Priced>();     // winning price rows, keyed by part name
  const metaByName = new Map<string, Meta>();   // market-evidence metadata where a market tier priced
  let fullRaw: RawPriced[] | null = null;       // full-list tier result — enables positional name-drift fallback
  let pricedBy: "claude-market" | "claude" | "gemini" = "gemini";

  const marketOn = process.env.MARKET_RESEARCH !== "off" && anthropicEnabled();
  const powertrainLine = powertrain.source !== "default" ? powertrainPromptLine(powertrain.type) : null;

  if (marketOn) {
    // Tier 0 — cache: a rescan of the same vehicle prices in seconds, same numbers.
    const cached = await readMarketComps(parts.map((p) => compKey(id, spec, p.name, gradeOf(p))));
    const researchable: InPart[] = [];
    for (const p of parts) {
      const hit = cached[compKey(id, spec, p.name, gradeOf(p))];
      if (gradeOf(p) === "C") continue; // no research spend; gradeAdjustUsed nulls it anyway
      if (hit) {
        byName.set(nameKey(p.name), { mid: hit.price_usd, lo: hit.low_usd, hi: hit.high_usd });
        metaByName.set(nameKey(p.name), { confidence: hit.confidence, compCount: hit.comp_count, sources: hit.sources });
      } else {
        researchable.push(p);
      }
    }

    // Tier 1 — comps-first: OUR code pulls real eBay listings for every uncached
    // part in parallel, then one batched fast-tier call judges them. Parts with
    // zero usable comps route to the grounded-search fallback on the strong model,
    // concurrently, so the slow path never blocks the fast majority.
    if (researchable.length) {
      const gradeByName = new Map(researchable.map((p) => [nameKey(p.name), gradeOf(p)]));
      const written: { part: { name: string; usedPartPriceUsd: number | null; usedPartPriceLowUsd: number | null; usedPartPriceHighUsd: number | null; confidence: MarketConfidence; compCount: number; sourceDomains: string[] }; grade: string }[] = [];
      const accept = (row: { name: string; usedPartPriceUsd: number | null; usedPartPriceLowUsd: number | null; usedPartPriceHighUsd: number | null; confidence: MarketConfidence; compCount: number; sourceDomains: string[] }) => {
        const key = nameKey(row.name);
        if (!gradeByName.has(key)) return; // echo drift to an unknown name — ignore
        // Sanity rail: an implausible price is DROPPED (never clamped) and the
        // part falls to the vision price the client already has.
        if (row.usedPartPriceUsd != null && !isSanePrice(row.usedPartPriceUsd, row.name)) return;
        byName.set(key, { mid: row.usedPartPriceUsd, lo: row.usedPartPriceLowUsd, hi: row.usedPartPriceHighUsd });
        metaByName.set(key, { confidence: row.confidence, compCount: row.compCount, sources: row.sourceDomains });
        written.push({ part: row, grade: gradeByName.get(key)! });
      };

      const fitment = { year: v.year, make: v.make, model: v.model, trim: v.trim, engine: v.engine };
      const comps = await fetchCompsForParts(fitment, researchable.map((p) => p.name));
      if (comps) {
        const withComps = researchable.filter((p) => (comps[p.name] ?? []).length > 0);
        const zeroComp = researchable.filter((p) => (comps[p.name] ?? []).length === 0);
        const judgeInput: JudgeInputPart[] = withComps.map((p) => ({
          part_id: p.name,
          name: p.name,
          condition: gradeOf(p) === "A" ? "good" : gradeOf(p) === "B" ? "fair" : "unknown",
          fitment,
          comps: comps[p.name] ?? [],
        }));
        const [judged, fallback] = await Promise.all([
          priceParts(judgeInput),
          zeroComp.length ? marketPriceParts({ vehicleId: id, spec, powertrainLine, parts: zeroComp }) : Promise.resolve([]),
        ]);
        for (const r of judged ?? []) {
          accept({
            name: r.part_id,
            usedPartPriceUsd: r.estimate,
            usedPartPriceLowUsd: r.low,
            usedPartPriceHighUsd: r.high,
            confidence: r.confidence === "med" ? "medium" : r.confidence,
            compCount: comps[r.part_id]?.length ?? 0,
            sourceDomains: ["ebay.com"],
          });
        }
        for (const r of fallback ?? []) accept(r);
        if ((judged && judged.length) || (fallback && fallback.length)) pricedBy = "claude-market";
      } else {
        // eBay itself unavailable (creds/auth/network) — don't treat every part as
        // zero-comp and stampede the slow fallback; the memory tier below handles it.
      }
      if (written.length) void writeMarketComps(id, spec, written); // best-effort, evidence-backed rows only
    } else if (byName.size) {
      pricedBy = "claude-market"; // fully served from cache
    }
  }

  // Tiers 2/3 — memory, then Gemini: run when research is off or its call failed.
  // Cached market rows (if any) still win over the full-list result.
  if (pricedBy !== "claude-market") {
    let parsed: RawPriced[] | null = null;
    if (anthropicEnabled()) {
      const claude: RawPricedPart[] | null = await claudePriceParts({ vehicleId: id, spec, powertrainLine, parts });
      if (claude) { parsed = claude; pricedBy = "claude"; }
    }
    if (!parsed) { parsed = await geminiPriceParts(prompt); if (parsed) pricedBy = "gemini"; }
    if (!parsed && byName.size === 0) {
      return NextResponse.json({ ok: false, error: "pricing unavailable" }, { status: 502, headers: CORS });
    }
    if (parsed) {
      fullRaw = parsed;
      for (const r of parsed) {
        if (typeof r?.name !== "string") continue;
        const key = nameKey(r.name);
        if (!byName.has(key)) byName.set(key, fromRaw(r)); // cache overlay wins
      }
    }
  }

  // Claude's price IS the price (class positioning removed 2026-07-03); only the
  // grade gate applies (A/B as-is, C unpriced) and the band renders as confidence.
  const out = parts.map((p, i) => {
    const key = nameKey(p.name);
    const priced = byName.get(key) ?? (fullRaw ? fromRaw(fullRaw[i]) : { mid: null, lo: null, hi: null });
    const grade = gradeOf(p);
    const meta = metaByName.get(key);
    return {
      name: p.name,
      usedPartPriceUsd: priced.mid,
      suggestedPriceUsd: gradeAdjustUsed(priced.mid, grade),
      suggestedPriceLowUsd: gradeAdjustUsed(priced.lo, grade),
      suggestedPriceHighUsd: gradeAdjustUsed(priced.hi, grade),
      ...(meta ? { confidence: meta.confidence, compCount: meta.compCount, sources: meta.sources } : {}),
    };
  });

  return NextResponse.json({ ok: true, vehicle: id, pricedBy, parts: out }, { headers: CORS });
}
