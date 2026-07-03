// PRICING RESEARCH AGENT (A2, docs/agent-layer-blueprint.md) — the comp anchor, reborn
// OFF the scan path. After results land, the client sends the top few high-value parts
// here and this route researches what comparable used parts actually sold for. Primary
// engine: Claude with the server-side web_search tool (sources from the tool-result
// blocks). Fallback: the original Gemini grounded search (same mechanism as
// lib/pricing.ts's groundedMedianPrice, sources from the grounding metadata).
//
// Contract: research is ADVISORY. The response carries a proposed price with provenance;
// the client renders it as an accept/dismiss badge and never silently changes a price.
// A result with no sources doesn't render. Bounds: ≤ 5 parts per call, 1 search call
// per part. Failures return nothing for that part — the formula price stands.
import { NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini";
import { anthropicEnabled, getAnthropic, pricingModel, extractSearchSources } from "@/lib/anthropic";
import { supabaseAdmin } from "@/lib/supabase";
import { parseGroundedPrice } from "@/lib/pricing";
import { isSanePrice } from "@/lib/price-bands";
import { type ConditionGrade } from "@/lib/age-pricing";
import { gradeAdjustUsed } from "@/lib/used-pricing";

export const runtime = "nodejs";
export const maxDuration = 90; // web-search turns run longer than one flash call; parts fan out in parallel

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const MAX_PARTS = 5;      // research only the top-value parts — that's where mispricing costs money
const MIN_PRICE_USD = 150; // parts under this aren't worth a research call

type InPart = { name: string; grade?: string; currentPriceUsd?: number | null };

export type ResearchResult = {
  name: string;
  compMedianUsd: number;   // grounded median SOLD price for a good-used (≈ Grade B) part
  compCount: number;       // how many comps the model corroborated
  proposedPriceUsd: number; // median, adjusted from Grade B to this part's grade
  confidence: "high" | "low";
  sources: { title: string; url: string }[];
};

// The search brief — identical for both engines so their results are comparable.
function searchPrompt(query: string, spec: string): string {
  return (
    `Search the web to find what this USED auto part ACTUALLY SOLD FOR recently: "${query}"${spec ? ` (${spec})` : ""}. ` +
    `Cross-check several sources — eBay SOLD/completed listings, car-part.com, Google Shopping, Facebook Marketplace — and corroborate across them. ` +
    `Strongly prefer COMPLETED/SOLD prices over asking prices. Exclude brand-new parts, cores, and "for parts only" wrecks. ` +
    `Assume good used condition (normal wear, fully functional).\n\n` +
    `Reply in EXACTLY this two-line format (no other words):\n` +
    `MEDIAN: $<amount>\nCOMPS: <how many real sold comps you corroborated>\n\n` +
    `If you cannot corroborate at least 2 real sold comps, reply with exactly "NONE".`
  );
}

// Shared post-processing: parse the two-line reply, gate on sanity/comps/sources,
// re-express the Grade-B median in this part's grade. Null → the formula price stands.
function toResult(part: InPart, text: string, sources: { title: string; url: string }[]): ResearchResult | null {
  const median = parseGroundedPrice(text);
  if (median == null || !isSanePrice(median, part.name)) return null;
  const compCount = Math.max(0, parseInt(/COMPS:\s*(\d+)/i.exec(text)?.[1] ?? "0", 10));
  if (compCount < 2) return null;
  if (!sources.length) return null; // a number with no sources doesn't ship

  // Comps are good-used ≈ Grade B; re-express the median in this part's grade using
  // the same grade factors as the formula. Grade C is unpriced — never researched.
  const grade: ConditionGrade = part.grade === "A" ? "A" : "B";
  return {
    name: part.name,
    compMedianUsd: median,
    compCount,
    proposedPriceUsd: gradeAdjustUsed(median, grade)!,
    confidence: compCount >= 3 && sources.length >= 2 ? "high" : "low",
    sources,
  };
}

// Fallback engine: one Gemini grounded search per part, sources from the grounding
// metadata. Null when grounding finds nothing usable.
async function researchPartGemini(vehicleId: string, spec: string, part: InPart): Promise<ResearchResult | null> {
  const query = `${vehicleId} ${part.name}`;
  try {
    const res = await geminiGenerate("gemini-2.5-flash", {
      contents: [{ role: "user", parts: [{ text: searchPrompt(query, spec) }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0 },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const cand = j.candidates?.[0];
    const text: string = (cand?.content?.parts || []).map((p: { text?: string }) => p.text ?? "").join("");
    const chunks: { web?: { uri?: string; title?: string } }[] = cand?.groundingMetadata?.groundingChunks ?? [];
    const sources = chunks
      .map((c) => ({ title: c.web?.title || "source", url: c.web?.uri || "" }))
      .filter((s) => s.url)
      .slice(0, 3);
    return toResult(part, text, sources);
  } catch {
    return null;
  }
}

// Primary engine: Claude with the server-side web_search tool. THROWS on an API
// failure (so the dispatcher can fall back to Gemini for that part) and returns
// null only when the search legitimately found nothing usable.
async function researchPartClaude(vehicleId: string, spec: string, part: InPart): Promise<ResearchResult | null> {
  const query = `${vehicleId} ${part.name}`;
  const params = {
    model: pricingModel(),
    max_tokens: 16000,
    thinking: { type: "adaptive" as const },
    output_config: { effort: "low" as const }, // a lookup, not deep reasoning — 5 parts run in parallel
    tools: [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 4 }],
  };
  let messages: { role: "user" | "assistant"; content: unknown }[] = [
    { role: "user", content: searchPrompt(query, spec) },
  ];
  let resp = await getAnthropic().messages.create(
    { ...params, messages: messages as never },
    { timeout: 45_000 },
  );
  // Server-tool loop: pause_turn means the search loop hit its iteration limit —
  // resend with the assistant content appended and it resumes. Bounded.
  for (let i = 0; i < 3 && resp.stop_reason === "pause_turn"; i++) {
    messages = [...messages, { role: "assistant", content: resp.content }];
    resp = await getAnthropic().messages.create(
      { ...params, messages: messages as never },
      { timeout: 45_000 },
    );
  }
  const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const sources = extractSearchSources(resp.content).slice(0, 3);
  return toResult(part, text, sources);
}

// Dispatch: Claude when configured, falling back to Gemini per part if the Claude
// call itself errors (a legit "no comps" null does NOT re-run on Gemini).
async function researchPart(vehicleId: string, spec: string, part: InPart): Promise<ResearchResult | null> {
  if (anthropicEnabled()) {
    try {
      return await researchPartClaude(vehicleId, spec, part);
    } catch {
      /* fall through to Gemini */
    }
  }
  return researchPartGemini(vehicleId, spec, part);
}

export async function POST(req: Request) {
  // Auth: web session cookie OR Bearer token (same as /api/reprice).
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
    vehicle?: { year?: string | number | null; make?: string | null; model?: string | null; trim?: string | null; engine?: string | null };
    parts?: InPart[];
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad body" }, { status: 400, headers: CORS }); }

  const v = body.vehicle ?? {};
  const vehicleId = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
  if (!vehicleId) return NextResponse.json({ ok: false, error: "no vehicle" }, { status: 400, headers: CORS });
  const spec = v.engine ? `engine ${v.engine}` : "";

  // Server-side guard mirrors the client filter: priced, not Grade C, worth a call —
  // then only the top few by value.
  const parts = (Array.isArray(body.parts) ? body.parts : [])
    .filter((p): p is InPart => !!p && typeof p.name === "string" && p.name.trim().length > 0)
    .filter((p) => p.grade !== "C" && typeof p.currentPriceUsd === "number" && p.currentPriceUsd >= MIN_PRICE_USD)
    .sort((a, b) => (b.currentPriceUsd ?? 0) - (a.currentPriceUsd ?? 0))
    .slice(0, MAX_PARTS);
  if (!parts.length) return NextResponse.json({ ok: false, error: "no parts" }, { status: 400, headers: CORS });

  const results = (await Promise.all(parts.map((p) => researchPart(vehicleId, spec, p)))).filter(Boolean);

  return NextResponse.json({ ok: true, vehicle: vehicleId, results }, { headers: CORS });
}
