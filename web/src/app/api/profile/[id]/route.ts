import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeGrade } from "@/lib/grade";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();

  const { data: profile } = await db.from("profiles").select("*").eq("id", id).single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: listings } = await db
    .from("listings")
    .select("*, shops(name, location)")
    .or(`seller_id.eq.${id},created_by.eq.${id}`)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const parts = (listings || []).map((l: any) => {
    const c = l.corrected || l.ai_output || {};
    return {
      id: l.id,
      part: c.partName || c.part_name || "Used Part",
      grade: normalizeGrade(c.condition),
      price: l.price_usd ?? c.suggestedPriceUsd ?? 0,
      fitment: fmtFit(c.fitment),
      category: c.partCategory || c.part_category || "",
      shopName: l.shops?.name || "Independent seller",
      shopLocation: l.shops?.location || "",
    };
  });

  return NextResponse.json({
    profile: {
      id: profile.id,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      bio: profile.bio,
      isOnline: profile.is_online,
      lastSeen: profile.last_seen,
    },
    listings: parts,
  });
}

function fmtFit(fit: any): string {
  if (!fit) return "";
  if (typeof fit === "string") return fit;
  if (Array.isArray(fit)) {
    return fit.map((f: any) => {
      if (typeof f === "string") return f;
      const yr = f.yearStart && f.yearEnd && f.yearStart !== f.yearEnd ? `${f.yearStart}–${f.yearEnd}` : (f.yearStart || "");
      return [yr, f.make, f.model].filter(Boolean).join(" ").trim();
    }).filter(Boolean).join(", ");
  }
  return "";
}
