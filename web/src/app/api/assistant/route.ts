import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

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

PRICING DISCIPLINE: Never give a single confident dollar figure as if it were certain. Always (1) give a realistic RANGE, and (2) state the BASIS — what it's grounded in (e.g. "typical used eBay/Car-Part comps", "scrap/core value", "depends on trim"). For TRIM/VARIANT-sensitive parts (headlights halogen vs HID vs LED, wheels, seats, engines/transmissions by engine size & drivetrain, infotainment), ask which variant before pricing rather than guessing. For VOLATILE COMMODITIES — catalytic converters, precious-metal cores, batteries, scrap aluminum/copper — flag that the price swings with metal markets and must be verified with a current core buyer; keep core values realistic (a standard catalytic converter core is typically ~$50–$250, not $500–$1,000+; only specific high-value converters exceed that). When you're not sure, say so and give the range wide.

STYLE: Be concise, practical and shop-floor friendly. Give real numbers and ranges when pricing. Use short paragraphs or tight bullet points. Don't invent fake VINs or exact fitment you can't support — say when something needs to be verified.`;

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to use the assistant" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "The assistant isn't configured yet (missing GROQ_API_KEY)." }, { status: 503 });
  }

  const { messages } = await req.json().catch(() => ({ messages: [] }));
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No message provided" }, { status: 400 });
  }

  // Keep the last ~10 turns for context; coerce to {role, content}.
  const history = messages
    .slice(-10)
    .filter((m: any) => m && typeof m.content === "string" && m.content.trim())
    .map((m: any) => ({
      role: m.role === "assistant" || m.role === "ai" ? "assistant" : "user",
      content: String(m.content).slice(0, 4000),
    }));

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 700,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Groq error", res.status, detail);
      return NextResponse.json({ error: "The assistant is busy right now — try again in a moment." }, { status: 502 });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return NextResponse.json({ error: "The assistant didn't return a reply." }, { status: 502 });

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("Assistant request failed", e);
    return NextResponse.json({ error: "Couldn't reach the assistant. Check your connection." }, { status: 502 });
  }
}
