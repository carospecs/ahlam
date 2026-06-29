// VIN-anchored re-pricing — one cheap text-only Gemini call that re-estimates each
// part's brand-new OEM price for the EXACT decoded vehicle, then applies the same
// grade discount as the scan. Used by AddVehicle to auto-refine prices when a VIN was
// found in the photos (decoded only after the vision call) rather than supplied up
// front — so the seller never has to scan, confirm, and re-run.
import { NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini";
import { decodeVin, engineLabel } from "@/lib/vin";
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
  if (body.vin) {
    const d = await decodeVin(body.vin);
    if (d) v = { year: d.year, make: d.make, model: d.model, trim: d.trim, engine: engineLabel(d), drivetrain: d.driveType };
  }
  const id = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
  if (!id) return NextResponse.json({ ok: false, error: "no vehicle" }, { status: 400, headers: CORS });
  const spec = [v.engine ? `engine ${v.engine}` : null, v.drivetrain ? `drivetrain ${v.drivetrain}` : null].filter(Boolean).join(", ");

  // One text-only call: brand-new OEM retail price per part for THIS exact vehicle.
  // Echo the name back so the client can match by name (order is not relied upon).
  const list = parts.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
  const prompt =
    `You price auto parts for salvage yards. For a ${id}${spec ? ` (${spec})` : ""}, give the approximate BRAND-NEW ` +
    `OEM (or quality aftermarket) retail price in USD for each part below — the NEW replacement price for THIS exact ` +
    `make/model/year/trim/engine, NOT a used or salvage price. Left & right of a paired part get the SAME price. ` +
    `Use realistic round numbers; if you truly have no basis for one, use null.\n\n` +
    `Return ONLY a JSON array (no prose), one object per part, shape: [{"name": string, "newPartPriceUsd": number|null}]. ` +
    `Use the exact part names given.\n\nParts:\n${list}`;

  let parsed: { name?: string; newPartPriceUsd?: unknown }[] = [];
  try {
    const res = await geminiGenerate("gemini-2.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: `model ${res.status}` }, { status: 502, headers: CORS });
    const j = await res.json();
    const text: string = (j.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text ?? "").join("");
    const arr = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim());
    if (Array.isArray(arr)) parsed = arr;
  } catch { return NextResponse.json({ ok: false, error: "parse" }, { status: 502, headers: CORS }); }

  // Match the model's prices back to the requested parts by name, falling back to
  // positional order. Then apply the same grade discount the scan uses.
  const byName = new Map<string, number | null>();
  parsed.forEach((r) => {
    if (typeof r?.name === "string") {
      byName.set(r.name.toLowerCase().trim(), typeof r.newPartPriceUsd === "number" ? r.newPartPriceUsd : null);
    }
  });
  const out = parts.map((p, i) => {
    const newPartPriceUsd = byName.has(p.name.toLowerCase().trim())
      ? byName.get(p.name.toLowerCase().trim())!
      : (typeof parsed[i]?.newPartPriceUsd === "number" ? (parsed[i].newPartPriceUsd as number) : null);
    const grade = (["A", "B", "C"] as const).includes(p.grade as ConditionGrade) ? (p.grade as ConditionGrade) : "B";
    return { name: p.name, newPartPriceUsd, suggestedPriceUsd: usedPriceFromNew(newPartPriceUsd, grade) };
  });

  return NextResponse.json({ ok: true, vehicle: id, parts: out }, { headers: CORS });
}
