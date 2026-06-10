import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeGrade } from "@/lib/grade";
import { geminiGenerate } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_MODEL = "gemini-2.5-flash";

const PHOTO_SEARCH_PROMPT = `Identify the single most prominent car part in this photo. Return ONLY JSON: { partName: string, confidence: 'high'|'medium'|'low' }`;

async function callGemini(base64: string, mime: string, userText: string): Promise<string | undefined> {
  const res = await geminiGenerate(GEMINI_MODEL, {
    system_instruction: { parts: [{ text: PHOTO_SEARCH_PROMPT }] },
    contents: [{ role: "user", parts: [
      { text: userText },
      { inline_data: { mime_type: mime, data: base64 } },
    ] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p: any) => p.text ?? "").join("") || undefined : undefined;
}

export async function POST(req: Request) {
  const db = supabaseAdmin();

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request body" }, { status: 400 });
  }

  if (!body.image) {
    return NextResponse.json({ error: "no image provided" }, { status: 400 });
  }

  const rawBase64 = body.image.replace(/^data:[^;]+;base64,/, "");
  const mime = body.image.startsWith("data:") ? (body.image.match(/^data:([^;]+);/)?.[1] ?? "image/jpeg") : "image/jpeg";

  try {
    const content = await callGemini(rawBase64, mime, "Identify the car part in this photo.");
    if (!content) {
      return NextResponse.json({ error: "empty completion" }, { status: 503 });
    }

    const { partName, confidence } = JSON.parse(content) as { partName: string; confidence: string };

    const searchTerm = partName.toLowerCase();

    const { data: listings } = await db
      .from("listings")
      .select("*")
      .eq("status", "active");

    const results = (listings || [])
      .filter((l: any) => {
        const c = l.corrected || l.ai_output || {};
        const name = (c.partName || c.part_name || "").toLowerCase();
        return name.includes(searchTerm);
      })
      .map((l: any) => {
        const c = l.corrected || l.ai_output || {};
        return {
          id: l.id,
          partName: c.partName || c.part_name || "Used Part",
          grade: normalizeGrade(c.condition),
          price: l.price_usd ?? c.priceUsd ?? c.suggestedPriceUsd ?? 0,
          fitment: formatFit(c.fitment),
          category: c.partCategory || c.part_category || "",
          views: l.views || 0,
          photoUrl: l.photo_url || null,
          sellerId: l.seller_id || l.created_by,
          shopId: l.shop_id,
        };
      })
      .sort((a: any, b: any) => {
        const aExact = a.partName.toLowerCase() === searchTerm ? 1 : 0;
        const bExact = b.partName.toLowerCase() === searchTerm ? 1 : 0;
        return bExact - aExact || b.views - a.views;
      });

    return NextResponse.json({ partName, confidence, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

function formatFit(fit: any): string {
  if (!fit) return "";
  if (typeof fit === "string") return fit;
  if (Array.isArray(fit)) {
    return fit.map((f: any) => {
      if (typeof f === "string") return f;
      const yr = f.yearStart && f.yearEnd && f.yearStart !== f.yearEnd ? `${f.yearStart}–${f.yearEnd}` : (f.yearStart || "");
      return [yr, f.make, f.model, f.notes].filter(Boolean).join(" ").trim();
    }).filter(Boolean).join(", ");
  }
  return "";
}
