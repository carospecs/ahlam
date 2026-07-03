// The universal pricing pass — Claude (Opus 4.8 by default) prices every scan's
// part list for the EXACT decoded vehicle, then the server applies the same
// class curve + grade factor as the scan (lib/used-pricing). Runs BLOCKING in the
// scan's critical path: the first prices the seller sees come from here. Fallback
// tiers: Claude → the original Gemini text call (kept verbatim below) → the client
// renders the Gemini-vision prices it already has.
import { NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini";
import { anthropicEnabled, claudePriceParts, type RawPricedPart } from "@/lib/anthropic";
import { decodeVin, engineLabel } from "@/lib/vin";
import { type ConditionGrade } from "@/lib/age-pricing";
import { gradeAdjustUsed } from "@/lib/used-pricing";
import { classifyPowertrain, powertrainPromptLine } from "@/lib/powertrain";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 90; // Claude ≤40s + Gemini fallback + VIN decode

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
    `price each part below ACTUALLY SELLS FOR as a USED/recycled part (car-part.com, eBay sold listings, LKQ) in good used ` +
    `condition — NEVER the new/OEM/MSRP price; a used part sells for a fraction of new. ` +
    `${powertrain.source !== "default" ? powertrainPromptLine(powertrain.type) + " " : ""}` +
    `Be conservative on large painted body panels (doors, liftgate, hood, fenders, quarter panels, bumper covers): they move ` +
    `slowly and sell near the LOW end of any range. Left & right of a paired part get the SAME price. ` +
    `Use realistic round numbers; if you truly have no basis for one, use null. ` +
    `Also give the realistic USED-market RANGE as usedPartPriceLowUsd / usedPartPriceHighUsd (low ≤ price ≤ high): ` +
    `tight (±15% or less) when you know the part and vehicle well, wider when you're less sure. Null range when the price is null.\n\n` +
    `Return ONLY a JSON array (no prose), one object per part, shape: [{"name": string, "usedPartPriceUsd": number|null, "usedPartPriceLowUsd": number|null, "usedPartPriceHighUsd": number|null}]. ` +
    `Use the exact part names given.\n\nParts:\n${list}`;

  // Tier 1: Claude (the pricing authority). Tier 2: the Gemini call. Both return
  // the same raw shape; a null falls through — the route never 500s on a model error.
  let parsed: RawPriced[] | null = null;
  let pricedBy: "claude" | "gemini" = "gemini";
  if (anthropicEnabled()) {
    const claude: RawPricedPart[] | null = await claudePriceParts({
      vehicleId: id,
      spec,
      powertrainLine: powertrain.source !== "default" ? powertrainPromptLine(powertrain.type) : null,
      parts,
    });
    if (claude) { parsed = claude; pricedBy = "claude"; }
  }
  if (!parsed) parsed = await geminiPriceParts(prompt);
  if (!parsed) return NextResponse.json({ ok: false, error: "pricing unavailable" }, { status: 502, headers: CORS });
  const raw: RawPriced[] = parsed;

  // Match the model's prices back to the requested parts by name, falling back to
  // positional order. Claude's typical-used-price IS the price (2026-07-03: class
  // positioning removed — it double-discounted on top of an already-conservative
  // estimate); only the grade factor applies, and the band renders as confidence.
  const num = (v: unknown): number | null => (typeof v === "number" && v > 0 ? v : null);
  type Priced = { mid: number | null; lo: number | null; hi: number | null };
  const fromRaw = (r: RawPriced | undefined): Priced => {
    const mid = num(r?.usedPartPriceUsd);
    let lo = num(r?.usedPartPriceLowUsd), hi = num(r?.usedPartPriceHighUsd);
    if (mid == null || lo == null || hi == null) return { mid, lo: null, hi: null };
    if (lo > hi) [lo, hi] = [hi, lo];
    return { mid, lo: Math.min(lo, mid), hi: Math.max(hi, mid) };
  };
  const byName = new Map<string, Priced>();
  raw.forEach((r) => {
    if (typeof r?.name === "string") byName.set(r.name.toLowerCase().trim(), fromRaw(r));
  });
  const out = parts.map((p, i) => {
    const priced = byName.get(p.name.toLowerCase().trim()) ?? fromRaw(raw[i]);
    const grade = (["A", "B", "C"] as const).includes(p.grade as ConditionGrade) ? (p.grade as ConditionGrade) : "B";
    const base = priced.mid;
    return {
      name: p.name,
      usedPartPriceUsd: base,
      suggestedPriceUsd: gradeAdjustUsed(base, grade),
      suggestedPriceLowUsd: gradeAdjustUsed(priced.lo, grade),
      suggestedPriceHighUsd: gradeAdjustUsed(priced.hi, grade),
    };
  });

  return NextResponse.json({ ok: true, vehicle: id, pricedBy, parts: out }, { headers: CORS });
}
