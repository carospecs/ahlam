import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { validateSlug } from "@/lib/slug";

// Live availability check for the Settings "Your website" card:
// GET /api/shop/slug-check?slug=joes-yard → { available, reason? }

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("slug") || "").toLowerCase().trim();
  const v = validateSlug(slug);
  if (!v.ok) return NextResponse.json({ available: false, reason: v.reason });
  try {
    const db = supabaseAdmin();
    const { data } = await db.from("shops").select("id").ilike("slug", slug).maybeSingle();
    if (data) return NextResponse.json({ available: false, reason: "That address is taken." });
  } catch {
    // fail open — the PATCH's unique index is the real guard
  }
  return NextResponse.json({ available: true });
}
