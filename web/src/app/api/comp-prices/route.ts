// Comp anchor — replaces the vision model's GUESSED new price with a REAL searched new
// price for the highest-value parts, then applies the same grade discount. Called by
// AddVehicle in the background for the top ~10 parts. Each part is a grounded web search,
// so the client caps the list; here we cap defensively too. Best-effort: a part with no
// credible comp is simply omitted, and the client keeps its formula price.
import { NextResponse } from "next/server";
import { groundedNewPrice } from "@/lib/pricing";
import { decodeVin } from "@/lib/vin";
import { usedPriceFromNew, type ConditionGrade } from "@/lib/age-pricing";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

type InPart = { name: string; grade: string };

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
    vehicle?: { year?: number | null; make?: string | null; model?: string | null; trim?: string | null };
    parts?: InPart[];
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad body" }, { status: 400, headers: CORS }); }

  const parts = (Array.isArray(body.parts) ? body.parts : [])
    .filter((p): p is InPart => !!p && typeof p.name === "string" && p.name.trim().length > 0)
    .slice(0, 12);
  if (!parts.length) return NextResponse.json({ ok: false, error: "no parts" }, { status: 400, headers: CORS });

  // Resolve the vehicle label — prefer decoding the VIN (most precise query).
  let v = body.vehicle ?? {};
  if (body.vin) {
    const d = await decodeVin(body.vin);
    if (d) v = { year: d.year, make: d.make, model: d.model, trim: d.trim };
  }
  const label = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
  if (!label) return NextResponse.json({ ok: false, error: "no vehicle" }, { status: 400, headers: CORS });

  // One grounded NEW-price search per part (parallel), then the grade discount.
  const results = await Promise.all(parts.map(async (p) => {
    const newPartPriceUsd = await groundedNewPrice(`${label} ${p.name} new OEM replacement part price`);
    if (newPartPriceUsd == null) return null;
    const grade = (["A", "B", "C"] as const).includes(p.grade as ConditionGrade) ? (p.grade as ConditionGrade) : "B";
    return { name: p.name, newPartPriceUsd, suggestedPriceUsd: usedPriceFromNew(newPartPriceUsd, grade) };
  }));

  return NextResponse.json({ ok: true, vehicle: label, parts: results.filter(Boolean) }, { headers: CORS });
}
