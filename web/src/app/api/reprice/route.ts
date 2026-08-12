// The universal pricing pass — every scan's part list is priced for the EXACT
// decoded vehicle through a tier ladder, BLOCKING in the scan's critical path:
//   cached market comp (≤48h)
//   → COMPS-FIRST: our code pulls real eBay listings in parallel, up to three
//     query variants per part (lib/ebay-comps), then parallel PER-PART appraiser
//     calls (estimate-first reasoning, part photo included, review flags) price
//     everything with comps (lib/price-judge — see docs/pricing-prompt.md)
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
import { evRetrievalHints } from "@/lib/ev-interchange";
import { priceParts, type JudgeInputPart } from "@/lib/price-judge";
import { resolveGeneration } from "@/lib/generations";
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

type InPart = { name: string; grade: string; inferred?: boolean; photoIndex?: number; conditionNotes?: string };

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
  const t0 = Date.now();
  // Per-tier wall-clock (ms) — returned in the response and logged as one
  // greppable line; this is the seed of the V3 pricing_events telemetry.
  const tm = { cacheMs: 0, ebayMs: 0, judgeMs: 0, groundedMs: 0, memoryMs: 0 };
  const judgeCallMs: number[] = [];
  const counts = { cached: 0, judged: 0, zeroComp: 0, reviewFlagged: 0 };
  const pct = (a: number[], p: number): number =>
    a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0;

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

  // An expired free month can't run AI repricing (fail-open on lookup errors).
  try {
    const { resolveShopPlan } = await import("@/lib/usage");
    const { plan } = await resolveShopPlan(supabaseAdmin(), user.id);
    if (plan === "free") {
      return NextResponse.json(
        { ok: false, error: "Your free month has ended. Pick a plan under Settings > Billing to keep using AI repricing." },
        { status: 402, headers: CORS },
      );
    }
  } catch { /* fail-open */ }

  let body: {
    vin?: string;
    vehicle?: { year?: number | null; make?: string | null; model?: string | null; trim?: string | null; engine?: string | null; drivetrain?: string | null };
    parts?: InPart[];
    // Downscaled scan photos (data URLs); parts reference them by photoIndex so
    // the judge sees the part it is pricing (pricing-prompt.md: photos carry
    // condition/completeness information the written assessment misses).
    photos?: string[];
    // Progressive two-phase pricing: phase 1 (skipGrounded) returns the fast
    // comps-judged prices immediately — zero-comp parts keep their vision
    // prices and are named in the response so the client can send them back
    // with groundedOnly for the slow web-search pass in the background.
    skipGrounded?: boolean;
    groundedOnly?: boolean;
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
  // cached market comp (≤48h) → comps-first judgment (+ zero-comp grounded
  // fallback) → Claude memory → Gemini.
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

  const photos = Array.isArray(body.photos) ? body.photos.filter((s): s is string => typeof s === "string").slice(0, 24) : [];

  type Meta = { confidence: MarketConfidence; compCount: number; sources: string[]; needsReview?: boolean; note?: string };
  const byName = new Map<string, Priced>();     // winning price rows, keyed by part name
  const metaByName = new Map<string, Meta>();   // market-evidence metadata where a market tier priced
  let fullRaw: RawPriced[] | null = null;       // full-list tier result — enables positional name-drift fallback
  let pricedBy: "claude-market" | "claude" | "gemini" = "gemini";
  let deferredParts: string[] | null = null;    // skipGrounded: zero-comp parts the client should follow up on

  const marketOn = process.env.MARKET_RESEARCH !== "off" && anthropicEnabled();
  const powertrainLine = powertrain.source !== "default" ? powertrainPromptLine(powertrain.type) : null;

  if (marketOn) {
    // Tier 0 — cache (48h TTL): a near-term rescan prices in seconds, same numbers.
    const tCache = Date.now();
    const cached = await readMarketComps(parts.map((p) => compKey(id, spec, p.name, gradeOf(p))));
    tm.cacheMs = Date.now() - tCache;
    const researchable: InPart[] = [];
    for (const p of parts) {
      const hit = cached[compKey(id, spec, p.name, gradeOf(p))];
      if (gradeOf(p) === "C") continue; // no research spend; gradeAdjustUsed nulls it anyway
      if (hit) {
        counts.cached++;
        byName.set(nameKey(p.name), { mid: hit.price_usd, lo: hit.low_usd, hi: hit.high_usd });
        metaByName.set(nameKey(p.name), { confidence: hit.confidence, compCount: hit.comp_count, sources: hit.sources });
      } else {
        researchable.push(p);
      }
    }

    // Tier 1 — comps-first: OUR code pulls real eBay listings for every uncached
    // part in parallel (up to three query variants per part), then parallel
    // per-part appraiser calls (width-limited; lib/price-judge) price them.
    // Parts with zero usable comps route to the grounded-search fallback on the
    // strong model, concurrently, so the slow path never blocks the fast majority.
    if (researchable.length) {
      const gradeByName = new Map(researchable.map((p) => [nameKey(p.name), gradeOf(p)]));
      const written: { part: { name: string; usedPartPriceUsd: number | null; usedPartPriceLowUsd: number | null; usedPartPriceHighUsd: number | null; confidence: MarketConfidence; compCount: number; sourceDomains: string[] }; grade: string }[] = [];
      const accept = (row: { name: string; usedPartPriceUsd: number | null; usedPartPriceLowUsd: number | null; usedPartPriceHighUsd: number | null; confidence: MarketConfidence; compCount: number; sourceDomains: string[]; needsReview?: boolean; note?: string }) => {
        const key = nameKey(row.name);
        if (!gradeByName.has(key)) return; // echo drift to an unknown name — ignore
        // Sanity check runs AFTER the estimate and only FLAGS (pricing-prompt.md:
        // no bands/caps anywhere the model can see, and no silent drops — an
        // implausible price routes to human review instead of vanishing).
        const insane = row.usedPartPriceUsd != null && !isSanePrice(row.usedPartPriceUsd, row.name);
        const needsReview = !!row.needsReview || insane;
        byName.set(key, { mid: row.usedPartPriceUsd, lo: row.usedPartPriceLowUsd, hi: row.usedPartPriceHighUsd });
        metaByName.set(key, { confidence: row.confidence, compCount: row.compCount, sources: row.sourceDomains, ...(needsReview ? { needsReview: true } : {}), ...(row.note ? { note: row.note } : {}) });
        // A review-flagged price must not pin the 48h cache.
        if (!needsReview) written.push({ part: row, grade: gradeByName.get(key)! });
      };

      const fitment = { year: v.year, make: v.make, model: v.model, trim: v.trim, engine: v.engine };
      // Generation range widens retrieval; assembly variants are decided per
      // part inside ebay-comps. Widening only — never fitment filtering.
      const gen = resolveGeneration(v.make, v.model, v.year);
      const tEbay = Date.now();
      // groundedOnly = the phase-2 follow-up call: no comps, no judge — every
      // part goes straight to the grounded web-search tier.
      // EV parts shared across models (Model 3 ↔ Y drive unit) pull sibling-model
      // comps too — wider REAL evidence for the judge (lib/ev-interchange).
      const evHints = powertrain.type === "bev" && v.make && v.model
        ? (name: string) => evRetrievalHints(v.make!, v.model!, v.year ?? 0, name)
        : undefined;
      const comps = body.groundedOnly ? ({} as NonNullable<Awaited<ReturnType<typeof fetchCompsForParts>>>) : await fetchCompsForParts(fitment, researchable.map((p) => p.name), gen, evHints);
      tm.ebayMs = Date.now() - tEbay;
      if (comps) {
        const withComps = body.groundedOnly ? [] : researchable.filter((p) => (comps[p.name] ?? []).length > 0);
        const zeroComp = body.groundedOnly ? researchable : researchable.filter((p) => (comps[p.name] ?? []).length === 0);
        counts.zeroComp = zeroComp.length;
        const judgeInput: JudgeInputPart[] = withComps.map((p) => ({
          part_id: p.name,
          name: p.name,
          grade: gradeOf(p),
          conditionNotes: p.conditionNotes ?? null,
          fitment,
          comps: comps[p.name] ?? [],
          photo: typeof p.photoIndex === "number" ? photos[p.photoIndex] ?? null : null,
        }));
        // Judge and grounded fallback run concurrently; time each branch's own
        // wall clock (not the shared Promise.all) so the report shows which gated.
        const tJudge = Date.now(), tGrounded = Date.now();
        const [judged, fallback] = await Promise.all([
          priceParts(judgeInput, { callMs: judgeCallMs }).finally(() => { tm.judgeMs = Date.now() - tJudge; }),
          zeroComp.length && !body.skipGrounded
            ? marketPriceParts({ vehicleId: id, spec, powertrainLine, parts: zeroComp }).finally(() => { tm.groundedMs = Date.now() - tGrounded; })
            : Promise.resolve([]),
        ]);
        // Phase-1 contract: name the parts we deliberately left unpriced so the
        // client can request just those with groundedOnly in the background.
        if (body.skipGrounded && zeroComp.length) deferredParts = zeroComp.map((p) => p.name);
        counts.judged = judged?.length ?? 0;
        for (const r of judged ?? []) {
          // Null estimate = the judge declined to price (junk pool / cannot
          // identify). The part keeps its vision price downstream, but the
          // review flag still surfaces so the yard prices it by hand.
          if (r.estimate == null) {
            metaByName.set(nameKey(r.part_id), { confidence: "low", compCount: comps[r.part_id]?.length ?? 0, sources: ["ebay.com"], needsReview: true, ...(r.note ? { note: r.note } : {}) });
            continue;
          }
          accept({
            name: r.part_id,
            usedPartPriceUsd: r.estimate,
            usedPartPriceLowUsd: r.low,
            usedPartPriceHighUsd: r.high,
            confidence: r.confidence,
            compCount: comps[r.part_id]?.length ?? 0,
            sourceDomains: ["ebay.com"],
            needsReview: r.needsReview,
            note: r.note,
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
  // Never for groundedOnly: that call prices ONLY via the grounded tier — a
  // failed grounded pass returns unpriced rows the client simply ignores.
  if (pricedBy !== "claude-market" && !body.groundedOnly) {
    const tMemory = Date.now();
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
    tm.memoryMs = Date.now() - tMemory;
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
      ...(meta
        ? {
            confidence: meta.confidence,
            compCount: meta.compCount,
            sources: meta.sources,
            ...(meta.needsReview ? { needsReview: true } : {}),
            ...(meta.note ? { note: meta.note } : {}),
          }
        : {}),
    };
  });

  for (const m of metaByName.values()) if (m.needsReview) counts.reviewFlagged++;
  const timings = {
    totalMs: Date.now() - t0,
    ...tm,
    judgeCalls: judgeCallMs.length,
    judgeP50Ms: pct(judgeCallMs, 50),
    judgeP95Ms: pct(judgeCallMs, 95),
    counts,
  };
  console.log(JSON.stringify({ tag: "reprice-timing", vehicle: id, pricedBy, parts: parts.length, phase: body.groundedOnly ? "grounded-followup" : body.skipGrounded ? "fast" : "full", ...timings }));

  return NextResponse.json(
    { ok: true, vehicle: id, pricedBy, parts: out, timings, ...(deferredParts?.length ? { deferredParts } : {}) },
    { headers: CORS },
  );
}
