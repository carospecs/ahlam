import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";
import { normalizeGrade } from "@/lib/grade";
import { geminiGenerate } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

interface MarketMatch {
  id: string; part: string; price: number; grade: string;
  fit: string; shopId: string; shopName: string; link: string;
}

// Significant tokens (>=4 chars) of a part name, lowercased — used to match a
// searched part against marketplace listing titles ("Alternator" ~ "OEM Alternator").
function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z]{4,}/g) || []).filter((t) => !["assembly", "with", "used", "part", "left", "right", "front", "rear"].includes(t));
}
function partsOverlap(a: string, b: string): boolean {
  const ta = tokens(a), tb = new Set(tokens(b));
  return ta.some((t) => tb.has(t));
}
function fitsVehicle(fitment: any[], vehicles: { make: string; model: string }[]): boolean {
  if (!Array.isArray(fitment) || fitment.length === 0) return false;
  return fitment.some((f) => {
    const fm = String(f.make || "").toLowerCase(), fmod = String(f.model || "").toLowerCase();
    return vehicles.some((v) => {
      const vm = v.make.toLowerCase(), vmod = v.model.toLowerCase();
      if (!vm || !fm || !(fm.includes(vm) || vm.includes(fm))) return false;
      if (!vmod) return true;                                    // make-only match ok
      return !fmod || fmod.includes(vmod) || vmod.includes(fmod);
    });
  });
}

// Search our own active marketplace listings for the part, restricted to the
// vehicles the part fits (the searched one + the AI's compatible list).
async function findMarketMatches(part: string, vehicles: { make: string; model: string }[]): Promise<MarketMatch[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const [{ data: rows }, { data: shops }] = await Promise.all([
    db.from("listings").select("id, shop_id, ai_output, corrected, price_usd, status").eq("status", "active").limit(800),
    db.from("shops").select("id, name"),
  ]);
  const shopName = new Map((shops || []).map((s: any) => [s.id, s.name]));
  const out: MarketMatch[] = [];
  for (const l of rows || []) {
    const c = l.corrected || l.ai_output || {};
    const pName = c.partName || c.part_name || "";
    if (!pName || !partsOverlap(part, pName)) continue;
    if (!fitsVehicle(c.fitment || [], vehicles)) continue;
    const fit = (c.fitment || []).map((f: any) => `${f.make || ""} ${f.model || ""} ${f.yearStart ? `${f.yearStart}${f.yearEnd && f.yearEnd !== f.yearStart ? `-${f.yearEnd}` : ""}` : ""}`.trim()).filter(Boolean).slice(0, 2).join(", ");
    out.push({
      id: l.id, part: pName,
      price: l.price_usd ?? c.suggestedPriceUsd ?? c.priceUsd ?? 0,
      grade: normalizeGrade(c.condition),
      fit, shopId: l.shop_id, shopName: shopName.get(l.shop_id) || "Independent seller",
      link: `/shop/${l.shop_id}`,
    });
    if (out.length >= 12) break;
  }
  return out;
}

const GEMINI_MODEL = "gemini-2.5-flash";

interface InterchangeVehicle {
  make: string;
  model: string;
  years: string;
  note?: string;
}
interface InterchangeSuggestion {
  label: string;
  partNumber?: string;
  confidence: "high" | "medium" | "low";
  reason: string;
}
interface InterchangeResult {
  part: string;
  vehicle: string;
  summary: string;
  compatibleVehicles: InterchangeVehicle[];
  bestSuggestions: InterchangeSuggestion[];
  oemNumbers: string[];
  aftermarket: string[];
  cautions: string[];
  marketMatches?: unknown;
}

// Service-role client (bypasses RLS) for the interchange cache + catalog.
function svc() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Normalized cache key so "Alternator/BMW/M3/2003" hits regardless of casing/spacing.
function cacheKey(part: string, make: string, model: string, year: string, variant: string) {
  return [part, make, model, year, variant]
    .map((s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

// "2008-2013" / "2008–2013" / "2015" → [start, end].
function parseYears(s: string): [number | null, number | null] {
  const m = String(s || "").match(/(\d{4})\D+(\d{4})/);
  if (m) return [Number(m[1]), Number(m[2])];
  const one = String(s || "").match(/(\d{4})/);
  return one ? [Number(one[1]), Number(one[1])] : [null, null];
}

// Look up a prior AI answer. On hit, bump hit_count (fire-and-forget) and return it.
async function cacheGet(key: string): Promise<InterchangeResult | null> {
  const db = svc();
  if (!db) return null;
  const { data } = await db.from("interchange_cache").select("id, result, hit_count").eq("query_key", key).maybeSingle();
  if (!data) return null;
  db.from("interchange_cache").update({ hit_count: (data.hit_count || 1) + 1, updated_at: new Date().toISOString() }).eq("id", data.id).then(() => {}, () => {});
  return data.result as InterchangeResult;
}

// Store the AI answer and fan it out into the structured `interchange` catalog.
async function cachePut(key: string, fields: { part: string; make: string; model: string; year: string; variant: string }, result: InterchangeResult) {
  const db = svc();
  if (!db) return;
  try {
    await db.from("interchange_cache").upsert(
      { query_key: key, ...fields, result, updated_at: new Date().toISOString() },
      { onConflict: "query_key" }
    );
    const rows = (result.compatibleVehicles || []).slice(0, 20).map((v) => {
      const [ys, ye] = parseYears(v.years);
      return { part_name: result.part, oem_number: (result.oemNumbers || [])[0] || null, make: v.make, model: v.model, year_start: ys, year_end: ye, notes: v.note || null, source: "ai", confidence: "ai" };
    });
    if (rows.length) await db.from("interchange").insert(rows);
  } catch { /* cache/catalog write is best-effort — never block the lookup */ }
}

function buildPrompt(part: string, make: string, model: string, year: string, variant: string) {
  const vehicle = [year, make, model, variant].filter(Boolean).join(" ") || "the specified vehicle";
  return `You are an automotive parts interchange expert (like a Hollander / Car-Part interchange catalog).
For the part "${part}" on a ${vehicle}, produce a cross-reference of OTHER vehicles whose same part is
physically and functionally interchangeable (same fitment), plus common part numbers.

Rules:
- The drivetrain matters: ${variant ? `this is a ${variant} vehicle — only include applications compatible with that powertrain (hybrid/electric parts are NOT interchangeable with gas equivalents and vice-versa).` : "if this part differs between gas/hybrid/diesel variants, note that in each entry."}
- Only list genuinely interchangeable applications (same generation/platform, matching engine/options where it matters).
- Group by make+model with a YEAR RANGE string (e.g. "2008-2013").
- Include a short "note" when a caveat decides fitment (engine size, drive type, with/without a feature, amperage, etc.).
- Give real-world OEM part numbers when known, and a few common aftermarket equivalents (brand + line).
- "cautions" = the things a yard/buyer must verify before swapping.
- "bestSuggestions" = the TOP 5 interchangeable picks a yard/buyer should check FIRST, ranked best→worst (most certain, closest fit first). Pull these from the compatible vehicles. Each: { "label": "Make Model Years", "partNumber": best OEM/aftermarket number if known else "", "confidence": "high"|"medium"|"low", "reason": one short clause why it fits / what to verify }. Give at most 5 — fewer if fewer genuinely interchange. NEVER pad with weak matches.
- If you are unsure about exact numbers, still give the interchange vehicles; leave numbers arrays shorter rather than inventing.
- Return STRICT JSON only, matching this shape:
{
  "part": string,
  "vehicle": string,
  "summary": string,                 // 1-2 sentence plain-English interchange overview
  "compatibleVehicles": [ { "make": string, "model": string, "years": string, "note": string } ],
  "bestSuggestions": [ { "label": string, "partNumber": string, "confidence": "high"|"medium"|"low", "reason": string } ],
  "oemNumbers": [ string ],
  "aftermarket": [ string ],
  "cautions": [ string ]
}`;
}

async function callGemini(prompt: string): Promise<string | undefined> {
  const res = await geminiGenerate(GEMINI_MODEL, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p: any) => p.text ?? "").join("") : undefined;
}

export async function POST(req: Request) {
  // Require auth to prevent anonymous credit-burning.
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to use interchange." }, { status: 401 });

  let body: { part?: string; make?: string; model?: string; year?: string | number; variant?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 }); }

  const part = String(body.part ?? "").trim();
  const make = String(body.make ?? "").trim();
  const model = String(body.model ?? "").trim();
  const year = String(body.year ?? "").trim();
  const variant = String(body.variant ?? "").trim();

  if (!part) return NextResponse.json({ ok: false, error: "Pick or type a part." }, { status: 400 });
  if (!make && !model) return NextResponse.json({ ok: false, error: "Add at least a brand (make)." }, { status: 400 });

  try {
    const ckey = cacheKey(part, make, model, year, variant);

    // 1. Serve from our own catalog if we've answered this before (free + instant).
    let result = await cacheGet(ckey).catch(() => null);
    const cached = !!result;

    // 2. Otherwise ask the AI, then store it (and seed the structured catalog).
    if (!result) {
      const raw = await callGemini(buildPrompt(part, make, model, year, variant));
      if (!raw) return NextResponse.json({ ok: false, error: "No interchange data returned. Try again." }, { status: 502 });
      let parsed: InterchangeResult;
      try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: "Could not read interchange data." }, { status: 502 }); }
      // normalize arrays so the UI never crashes on a missing field
      result = {
        part: parsed.part || part,
        vehicle: parsed.vehicle || [year, make, model, variant].filter(Boolean).join(" "),
        summary: parsed.summary || "",
        compatibleVehicles: Array.isArray(parsed.compatibleVehicles) ? parsed.compatibleVehicles.filter((v) => v && v.make) : [],
        bestSuggestions: Array.isArray(parsed.bestSuggestions)
          ? parsed.bestSuggestions.filter((s) => s && s.label).slice(0, 5).map((s) => ({ label: s.label, partNumber: s.partNumber || "", confidence: (["high", "medium", "low"].includes(s.confidence) ? s.confidence : "medium") as InterchangeSuggestion["confidence"], reason: s.reason || "" }))
          : [],
        oemNumbers: Array.isArray(parsed.oemNumbers) ? parsed.oemNumbers.filter(Boolean) : [],
        aftermarket: Array.isArray(parsed.aftermarket) ? parsed.aftermarket.filter(Boolean) : [],
        cautions: Array.isArray(parsed.cautions) ? parsed.cautions.filter(Boolean) : [],
      };
      await cachePut(ckey, { part, make, model, year, variant }, result).catch(() => {});
    }

    // 3. Cross-reference our live marketplace fresh every time (don't cache stock).
    const lookupVehicles = [
      { make, model },
      ...result.compatibleVehicles.map((v) => ({ make: v.make, model: v.model })),
    ].filter((v) => v.make);
    let marketMatches: MarketMatch[] = [];
    try { marketMatches = await findMarketMatches(result.part, lookupVehicles); } catch { marketMatches = []; }

    return NextResponse.json({ ok: true, cached, result: { ...result, marketMatches } });
  } catch (err) {
    // Surface the real cause (e.g. Gemini 429/quota) in the server logs — the
    // user still gets a friendly message.
    console.error("[interchange] lookup failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Interchange lookup failed. Try again." }, { status: 500 });
  }
}
