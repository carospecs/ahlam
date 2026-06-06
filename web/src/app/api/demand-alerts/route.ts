import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const db = supabaseAdmin();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await db
    .from("activity_log")
    .select("text")
    .gte("created_at", sevenDaysAgo)
    .not("text", "is", null);

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const key = row.text?.trim();
    if (key) counts[key] = (counts[key] || 0) + 1;
  }

  const result = Object.entries(counts)
    .map(([part, searches]) => ({ part, searches }))
    .sort((a, b) => b.searches - a.searches);

  return NextResponse.json(result);
}
