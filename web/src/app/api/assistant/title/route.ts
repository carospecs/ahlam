import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { geminiGenerate, getPrimaryKey, getFallbackKey } from "@/lib/gemini";

const MODEL = "gemini-2.5-flash";

// Summarizes a conversation into a short title. Used to auto-name chats.
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!getPrimaryKey() && !getFallbackKey()) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const { messages } = await req.json().catch(() => ({ messages: [] }));
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No messages" }, { status: 400 });
  }

  const transcript = messages
    .slice(-12)
    .filter((m: any) => m && typeof m.content === "string")
    .map((m: any) => `${m.role === "assistant" ? "Assistant" : "User"}: ${String(m.content).slice(0, 500)}`)
    .join("\n");

  try {
    const res = await geminiGenerate(MODEL, {
      system_instruction: { parts: [{ text: "You write very short chat titles. Given a conversation, reply with ONLY a 2-6 word title summarizing what it's about, in the same language as the conversation. No quotes, no punctuation at the end, no prefix." }] },
      contents: [{ role: "user", parts: [{ text: transcript }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 20, thinkingConfig: { thinkingBudget: 0 } },
    });
    if (!res.ok) return NextResponse.json({ error: "title failed" }, { status: 502 });
    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts;
    const raw = Array.isArray(parts) ? parts.map((p: any) => p.text ?? "").join("") : "";
    let title = raw.trim().replace(/^["']|["']$/g, "").replace(/[.]$/, "");
    if (title.length > 48) title = title.slice(0, 48).trim();
    if (!title) return NextResponse.json({ error: "empty" }, { status: 502 });
    return NextResponse.json({ title });
  } catch {
    return NextResponse.json({ error: "title failed" }, { status: 502 });
  }
}
