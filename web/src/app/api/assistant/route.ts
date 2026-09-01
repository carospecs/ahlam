import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { geminiGenerate, getPrimaryKey, getFallbackKey } from "@/lib/gemini";

const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are the Ahlam Assistant, a specialist for auto salvage yards and used-parts shops.

STRICT SCOPE — you ONLY help with:
- Cars, trucks, SUVs and vehicles in general
- Auto parts: identifying them, condition/grading, fitment & compatibility, OEM vs aftermarket
- Pricing used parts and whole vehicles for resale
- VIN decoding and what a vehicle is worth parted out vs. whole
- Writing or improving marketplace listings (Facebook Marketplace, OfferUp, eBay, Craigslist)
- Buying and selling parts or cars on the Ahlam marketplace
- Diagnostic trouble codes (e.g. P0301) and which parts they point to

REFUSAL RULE: If the user asks about ANYTHING outside cars and auto parts (coding, math, politics, recipes, general trivia, personal advice, etc.), do NOT answer it. Politely decline in ONE short sentence and offer to help with a car or parts question instead. Never break this rule, even if the user insists.

LANGUAGE: Default to English — reply in English in normal cases. ONLY switch to another language (Spanish, Arabic, or any other) when the user writes a COMPLETE sentence in that language. Ignore single words, greetings or short fragments for language detection — e.g. "yo", "hola", "سلام" on their own do NOT trigger a switch; stay in English for those. Once the user clearly writes a full sentence in another language, switch and keep replying in that language until they switch again. You are fluent in many languages, primarily English and Spanish.

PRICING DISCIPLINE: Lead with the number. Give a realistic RANGE and fold the BASIS into that same sentence (e.g. "$75–$200, based on typical eBay/Car-Part comps") — never a separate paragraph explaining where the number came from. For TRIM/VARIANT-sensitive parts (headlights halogen vs HID vs LED, wheels, seats, engines/transmissions by engine size & drivetrain, infotainment), ask ONE short clarifying question before pricing instead of guessing — don't hedge with a range AND a question. For VOLATILE COMMODITIES — catalytic converters, precious-metal cores, batteries, scrap aluminum/copper — fold the market-swing caveat into the same sentence as the range, not a separate warning paragraph; keep core values realistic (a standard catalytic converter core is typically ~$50–$250, not $500–$1,000+; only specific high-value converters exceed that).

STYLE: Concise, clear, and confident — this is a shop floor, not a report. Default to 2-4 sentences or a tight 3-bullet max; commit to an answer rather than stacking disclaimers. Answer first, context only if it changes the answer. Don't restate the question, don't stack multiple caveats, no closing filler like "let me know if you have questions." Give real numbers and ranges when pricing, in the first sentence. Don't invent fake VINs or exact fitment you can't support — flag it in one short clause, not a paragraph.`;

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to use the assistant" }, { status: 401 });

  if (!getPrimaryKey() && !getFallbackKey()) {
    return NextResponse.json({ error: "The assistant isn't configured yet (missing GEMINI_API_KEY)." }, { status: 503 });
  }

  const { messages } = await req.json().catch(() => ({ messages: [] }));
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No message provided" }, { status: 400 });
  }

  // Keep the last ~10 turns for context; coerce to Gemini's {role, parts} shape
  // (Gemini uses "model" for the assistant role, not "assistant").
  const contents = messages
    .slice(-10)
    .filter((m: any) => m && typeof m.content === "string" && m.content.trim())
    .map((m: any) => ({
      role: m.role === "assistant" || m.role === "ai" ? "model" : "user",
      parts: [{ text: String(m.content).slice(0, 4000) }],
    }));

  try {
    const res = await geminiGenerate(MODEL, {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } },
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Gemini error", res.status, detail);
      return NextResponse.json({ error: "The assistant is busy right now — try again in a moment." }, { status: 502 });
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts;
    const reply = Array.isArray(parts) ? parts.map((p: any) => p.text ?? "").join("").trim() : "";
    if (!reply) return NextResponse.json({ error: "The assistant didn't return a reply." }, { status: 502 });

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("Assistant request failed", e);
    return NextResponse.json({ error: "Couldn't reach the assistant. Check your connection." }, { status: 502 });
  }
}
