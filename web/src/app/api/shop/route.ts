import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

const EDITABLE = ["name", "location", "business_phone", "email", "website", "description", "hours", "logo_url", "cover_url"];

async function ctx() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, shopId: null, role: null, db: supabaseAdmin() };
  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = profile?.shop_id || null;
  let role: string | null = null;
  if (shopId) {
    const { data: m } = await db.from("shop_members").select("role").eq("shop_id", shopId).eq("user_id", user.id).single();
    role = m?.role || null;
  }
  return { user, shopId, role, db };
}

export async function GET() {
  const { user, shopId, db } = await ctx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!shopId) return NextResponse.json({ shop: null });
  const { data: shop } = await db.from("shops").select("*").eq("id", shopId).single();
  return NextResponse.json({ shop });
}

export async function PATCH(req: NextRequest) {
  const { user, shopId, role, db } = await ctx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!shopId) return NextResponse.json({ error: "No shop" }, { status: 400 });
  if (role !== "owner" && role !== "editor") {
    return NextResponse.json({ error: "You don't have permission to edit the shop" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, any> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const { data, error } = await db.from("shops").update(patch).eq("id", shopId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shop: data });
}
