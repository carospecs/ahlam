// VIN-first OCR — one cheap text+vision call (flash) that reads the VIN off the
// uploaded photos BEFORE the parts catalog runs, so the scan can classify and price
// every part for the exact vehicle on the first pass. Returns only a VIN that NHTSA
// recognizes, plus a small vehicle summary for the UI. The decode is cached, so the
// catalog's own up-front decode of the same VIN is effectively free.
import { NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini";
import { decodeVin, normalizeVin, engineLabel } from "@/lib/vin";
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

// Accept a data URL or raw base64; return Gemini inline_data parts.
function toInline(img: string): { mime_type: string; data: string } {
  const m = img.match(/^data:([^;]+);base64,(.*)$/s);
  if (m) return { mime_type: m[1], data: m[2] };
  return { mime_type: "image/jpeg", data: img.replace(/^data:[^;]+;base64,/, "") };
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

  let body: { images?: string[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad body" }, { status: 400, headers: CORS }); }
  const images = (Array.isArray(body.images) ? body.images : [])
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .slice(0, 15);
  if (!images.length) return NextResponse.json({ ok: false, error: "no images" }, { status: 400, headers: CORS });

  // Ask for EVERY legible VIN candidate, best-read first. A photo set can carry
  // more than one VIN-looking string (paperwork for another vehicle, a misread of
  // one character) — arbitration below keeps the first one NHTSA actually decodes,
  // so a single misread no longer kills the whole VIN-first pass.
  const prompt =
    `Read the Vehicle Identification Number (VIN) from these photos of one vehicle. A VIN is EXACTLY 17 characters, ` +
    `capital letters and digits only, and NEVER contains the letters I, O, or Q. Look across ALL the images — the ` +
    `windshield VIN plate (driver-side base), the driver door-jamb sticker, the firewall/engine-bay label, the ` +
    `dashboard, or any paperwork in frame. Transcribe all 17 characters carefully, character by character.\n\n` +
    `Return ONLY JSON: {"vins": ["<17 characters>", ...]} listing every DISTINCT legible VIN you can read, most ` +
    `clearly legible first (usually just one; empty array if none). NEVER invent, guess, or partially fill a VIN.`;

  let vinCandidates: string[] = [];
  try {
    const res = await geminiGenerate("gemini-2.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }, ...images.map((img) => ({ inline_data: toInline(img) }))] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: `model ${res.status}` }, { status: 502, headers: CORS });
    const j = await res.json();
    const text: string = (j.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text ?? "").join("");
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim());
    if (Array.isArray(parsed?.vins)) vinCandidates = parsed.vins.filter((v: unknown): v is string => typeof v === "string");
    else if (typeof parsed?.vin === "string") vinCandidates = [parsed.vin]; // tolerate the old shape
  } catch { return NextResponse.json({ ok: false, error: "parse" }, { status: 502, headers: CORS }); }

  // NHTSA arbitration: only a VIN the federal database can decode may anchor the
  // scan. Try candidates in the model's legibility order; first decodable wins.
  for (const raw of vinCandidates.slice(0, 3)) {
    const vin = normalizeVin(raw);
    if (!vin) continue;
    const d = await decodeVin(vin);
    if (!d) continue;
    return NextResponse.json({
      ok: true,
      vin,
      vehicle: { year: d.year, make: d.make, model: d.model, trim: d.trim, engine: engineLabel(d), drivetrain: d.driveType },
    }, { headers: CORS });
  }
  return NextResponse.json({ ok: true, vin: null, vehicle: null }, { headers: CORS });
}
