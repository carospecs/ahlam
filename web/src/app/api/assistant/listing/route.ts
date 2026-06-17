import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { geminiGenerate, getPrimaryKey, getFallbackKey } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gemini-2.5-flash"; // handles both text and vision

// Manual-listing AI assist — Gemini.
//  • text mode: draft title/description/price from typed fields
//  • vision mode (image given): also read the photo to fill part/vehicle/condition
const SYSTEM = `You write and price used auto listings for a salvage/used-parts shop.
Return ONLY a JSON object with these keys (omit none you can fill):
{ "title": string, "description": string, "suggestedPriceUsd": number,
  "priceRange": { "min": number, "max": number },
  "needsVariant": boolean, "variantPrompt": string, "volatile": boolean,
  "partName": string, "condition": "A"|"B"|"C",
  "vehicle": { "make": string, "model": string, "year": number, "body": string, "mileage": string } }
Rules:
- "title": short, search-friendly (<= 80 chars), include year/make/model + the part (or "parting out"/"whole car") when known.
- "description": 1–3 honest sentences (what it is, fitment, condition). NEVER invent damage, mileage, VIN, or features you can't see/aren't told.
- "suggestedPriceUsd": realistic USED resale price (number). Grade C / damaged = core pricing. Use 0 if you truly can't estimate.
- "priceRange": ALWAYS return a realistic {min,max} used-market spread around the suggested price — never imply a single exact value is certain.
- PRICE-SENSITIVE PARTS — for parts whose price swings 2x+ on trim/variant, do NOT pick one number blindly. These include: headlights/taillights (halogen vs HID vs LED), wheels (size/finish), seats (cloth/leather/heated/powered), mirrors (with/without camera/signal/power-fold), engines & transmissions (engine size, 2WD vs 4WD/AWD, auto vs manual), infotainment/clusters (screen size/options). If the deciding variant wasn't given to you, set "needsVariant": true, set "variantPrompt" to a one-line question naming the options (e.g. "Halogen, HID, or LED headlight?"), and WIDEN priceRange to span the variants instead of guessing one.
- VOLATILE COMMODITIES — catalytic converters and scrap/core commodities (precious-metal cores, batteries, aluminum/copper) move with metal markets. Give a conservative realistic range (a standard catalytic converter core is typically ~$50–$250, NOT $500+; only rare/specific converters exceed that), set "volatile": true, and note in the description it should be verified with a current core buyer.
- "condition": ARA grade — "A" (like-new, installs as-is), "B" (good, normal wear, usable as-is), or "C" (rough / needs repair / core).
- When a photo is provided, identify what you actually see and fill partName/vehicle/condition from it. Don't guess sides; never put left/right on center parts (hood, grille, bumper, etc.).
- Write in English.`;

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  if (!getPrimaryKey() && !getFallbackKey()) return NextResponse.json({ error: "AI assist isn't configured (missing GEMINI_API_KEY)." }, { status: 503 });

  const b = await req.json().catch(() => ({}));
  const kind = b.kind === "part" ? "part" : "car";
  const v = b.vehicle || {};
  const vehStr = [v.year, v.make, v.model, v.trim, v.body].filter(Boolean).join(" ") || "unknown vehicle";
  const hasImage = typeof b.imageBase64 === "string" && b.imageBase64.length > 100;
  // Strip any data-URL prefix → raw base64 + mime for Gemini inline_data.
  let imgMime = "image/jpeg";
  let imgData: string | null = null;
  if (hasImage) {
    const m = b.imageBase64.match(/^data:([^;]+);base64,(.*)$/s);
    if (m) { imgMime = m[1]; imgData = m[2]; }
    else { imgData = b.imageBase64; }
  }

  const ask = kind === "part"
    ? `Write a listing for this used PART${b.partName ? `: "${b.partName}"` : (hasImage ? " (identify it from the photo)" : "")}. Vehicle/fitment: ${vehStr}. Condition: ${b.condition || "(judge it)"}.${b.notes ? ` Seller notes: ${String(b.notes).slice(0, 400)}` : ""}`
    : `Write a listing for this WHOLE vehicle (sold whole or parted out): ${vehStr}.${hasImage ? " Identify the vehicle from the photo if fields are missing." : ""} ${b.mileage ? `Mileage: ${b.mileage}. ` : ""}Condition: ${b.condition || "used"}.${b.notes ? ` Seller notes: ${String(b.notes).slice(0, 400)}` : ""}`;

  const userParts: any[] = [{ text: ask }];
  if (hasImage && imgData) userParts.push({ inline_data: { mime_type: imgMime, data: imgData } });

  try {
    const res = await geminiGenerate(MODEL, {
      system_instruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: userParts }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 600, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
    });
    if (!res.ok) {
      console.error("Gemini listing error", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ error: "AI assist is busy — try again." }, { status: 502 });
    }
    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts;
    const raw = (Array.isArray(parts) ? parts.map((p: any) => p.text ?? "").join("") : "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    let out: any = {};
    try { out = JSON.parse(raw); } catch { try { out = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); } catch {} }

    const cond = ["A", "B", "C"].includes(out.condition) ? out.condition : null;
    const veh = out.vehicle && typeof out.vehicle === "object" ? {
      make: typeof out.vehicle.make === "string" ? out.vehicle.make : null,
      model: typeof out.vehicle.model === "string" ? out.vehicle.model : null,
      year: out.vehicle.year ? String(out.vehicle.year) : null,
      body: typeof out.vehicle.body === "string" ? out.vehicle.body : null,
      mileage: typeof out.vehicle.mileage === "string" ? out.vehicle.mileage : null,
    } : null;

    // Price range (PRC-1/PRC-2): keep only a sane {min,max}.
    const rMin = Number(out.priceRange?.min);
    const rMax = Number(out.priceRange?.max);
    const priceRange = Number.isFinite(rMin) && Number.isFinite(rMax) && rMin > 0 && rMax >= rMin
      ? { min: Math.round(rMin), max: Math.round(rMax) }
      : null;

    return NextResponse.json({
      ok: true,
      title: typeof out.title === "string" ? out.title.slice(0, 80) : "",
      description: typeof out.description === "string" ? out.description : "",
      suggestedPriceUsd: typeof out.suggestedPriceUsd === "number" ? out.suggestedPriceUsd : Number(out.suggestedPriceUsd) || null,
      priceRange,
      needsVariant: out.needsVariant === true,
      variantPrompt: typeof out.variantPrompt === "string" ? out.variantPrompt.slice(0, 160) : "",
      volatile: out.volatile === true,
      partName: typeof out.partName === "string" ? out.partName : null,
      condition: cond,
      vehicle: veh,
    });
  } catch (e) {
    console.error("listing assist failed", e);
    return NextResponse.json({ error: "Couldn't reach AI assist." }, { status: 502 });
  }
}
