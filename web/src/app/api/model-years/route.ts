import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 30;

const GEMINI_MODEL = "gemini-2.5-flash";
const MIN_YEAR = 1980;
const MAX_YEAR = new Date().getFullYear() + 2;

// Returns the model years a given make+model was actually sold, so the year
// picker only offers real years (e.g. a BMW 335i won't list 2027). Free text is
// still allowed in the UI, so the user can override.
export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, years: [] }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const make = searchParams.get("make")?.trim();
  const model = searchParams.get("model")?.trim();
  if (!make || !model) return NextResponse.json({ ok: true, years: [] });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ ok: true, years: [] });

  const prompt = `For the vehicle make "${make}" model "${model}", give the model-year range it was sold (US/North America).
If still in production, set "end" to ${MAX_YEAR - 1}. If it doesn't exist or you're unsure, set both to null.
Return STRICT JSON only: {"start": number|null, "end": number|null}`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) return NextResponse.json({ ok: true, years: [] });
    const json = await res.json();
    const txt = (json.candidates?.[0]?.content?.parts || []).map((p: any) => p.text ?? "").join("");
    const parsed = JSON.parse(txt);
    let start = Number(parsed.start), end = Number(parsed.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return NextResponse.json({ ok: true, years: [] });
    start = Math.max(MIN_YEAR, Math.min(start, MAX_YEAR));
    end = Math.max(MIN_YEAR, Math.min(end, MAX_YEAR));
    if (end < start) [start, end] = [end, start];
    const years: string[] = [];
    for (let y = end; y >= start; y--) years.push(String(y));
    return NextResponse.json({ ok: true, years, start, end });
  } catch {
    return NextResponse.json({ ok: true, years: [] });
  }
}
