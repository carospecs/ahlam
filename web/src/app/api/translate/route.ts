import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

// Batch-translate UI strings to Spanish for the live language layer. The app is
// authored in English and everything is STORED in English — this only powers what
// a Spanish-viewing user sees. Returns one translation per input, in order.
const SYSTEM = `You translate software UI strings from English to natural, concise Spanish (neutral Latin American).
Rules:
- Keep numbers, prices ($225), emails, URLs, dates, codes, VINs, and brand/model/proper names UNCHANGED (e.g. "2020 BMW M3 Competition" stays as is).
- Preserve punctuation, separators (·, –), capitalization style, and any leading/trailing spaces.
- If a string is already non-translatable (pure number/symbol/name), return it unchanged.
- Translate the MEANING the way a native Spanish UI would phrase it; don't be literal/robotic.
Return ONLY a JSON object: {"t": string[]} — the translations in the SAME order and SAME length as the input array. No commentary.`;

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "translation not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const texts: string[] = Array.isArray(body.texts) ? body.texts.slice(0, 80).map((s: any) => String(s)) : [];
  if (!texts.length) return NextResponse.json({ ok: true, translations: [] });

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify(texts) }],
      }),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: "translate upstream error" }, { status: 502 });
    const data = await res.json();
    let out: any = {};
    try { out = JSON.parse(data.choices?.[0]?.message?.content || "{}"); } catch {}
    const t: string[] = Array.isArray(out.t) ? out.t : Array.isArray(out.translations) ? out.translations : [];
    // Only trust a same-length result; otherwise echo input (no broken UI).
    const translations = t.length === texts.length ? t.map((s, i) => (typeof s === "string" && s ? s : texts[i])) : texts;
    return NextResponse.json({ ok: true, translations });
  } catch {
    return NextResponse.json({ ok: false, error: "translate failed" }, { status: 502 });
  }
}
