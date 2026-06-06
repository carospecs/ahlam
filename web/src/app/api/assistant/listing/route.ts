import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

// Drafts a marketplace title + description and suggests a resale price for a
// MANUAL listing (whole car or a single part). Output is JSON the form prefills;
// the seller edits anything before posting.
const SYSTEM = `You write used auto listings for a salvage/used-parts shop and price them for resale.
Return ONLY a JSON object: { "title": string, "description": string, "suggestedPriceUsd": number }.
- "title": a short, search-friendly marketplace title (<= 80 chars). Include year/make/model + the part (or "parting out"/"whole car") when known.
- "description": 1–3 honest sentences a buyer would want — what it is, fitment, condition. NEVER invent damage, mileage, VIN, or features you weren't told. If unsure, keep it general.
- "suggestedPriceUsd": a realistic USED resale price (number, USD) based on what comparable used items sell for (Facebook/eBay sold/OfferUp). "Poor"/damaged = core pricing. If you truly can't estimate, use 0.
Write in English.`;

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI assist isn't configured (missing GROQ_API_KEY)." }, { status: 503 });

  const b = await req.json().catch(() => ({}));
  const kind = b.kind === "part" ? "part" : "car";
  const v = b.vehicle || {};
  const vehStr = [v.year, v.make, v.model, v.trim, v.body].filter(Boolean).join(" ") || "unknown vehicle";
  const ask = kind === "part"
    ? `Write a listing for this used PART: "${b.partName || "auto part"}". Vehicle/fitment: ${vehStr}. Condition: ${b.condition || "Good"}.${b.notes ? ` Seller notes: ${String(b.notes).slice(0, 400)}` : ""}`
    : `Write a listing for this WHOLE vehicle being sold (whole or parted out): ${vehStr}. ${b.mileage ? `Mileage: ${b.mileage}. ` : ""}Condition: ${b.condition || "used"}.${b.notes ? ` Seller notes: ${String(b.notes).slice(0, 400)}` : ""}`;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: ask }],
      }),
    });
    if (!res.ok) {
      console.error("Groq listing error", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ error: "AI assist is busy — try again." }, { status: 502 });
    }
    const data = await res.json();
    let out: any = {};
    try { out = JSON.parse(data.choices?.[0]?.message?.content || "{}"); } catch {}
    return NextResponse.json({
      ok: true,
      title: typeof out.title === "string" ? out.title.slice(0, 80) : "",
      description: typeof out.description === "string" ? out.description : "",
      suggestedPriceUsd: typeof out.suggestedPriceUsd === "number" ? out.suggestedPriceUsd : Number(out.suggestedPriceUsd) || null,
    });
  } catch (e) {
    console.error("listing assist failed", e);
    return NextResponse.json({ error: "Couldn't reach AI assist." }, { status: 502 });
  }
}
