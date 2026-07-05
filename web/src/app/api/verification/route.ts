import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMail, FOUNDER_REVIEWERS } from "@/lib/mailer";

export const runtime = "nodejs";

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

// GET — the shop's verification state + latest request status.
export async function GET() {
  const { user, shopId, db } = await ctx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!shopId) return NextResponse.json({ verified: false, request: null });

  const { data: shop } = await db.from("shops").select("verified, verification_method").eq("id", shopId).single();
  const { data: request } = await db
    .from("verification_requests")
    .select("method, status, created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    verified: !!shop?.verified,
    method: shop?.verification_method || null,
    request: request || null,
  });
}

// POST — submit a verification request for review. method: phone | license | business.
export async function POST(req: Request) {
  const { user, shopId, role, db } = await ctx();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!shopId) return NextResponse.json({ error: "Create your shop first" }, { status: 400 });
  if (role !== "owner") return NextResponse.json({ error: "Only the shop owner can request verification" }, { status: 403 });

  const { method, detail } = await req.json().catch(() => ({}));
  if (!["phone", "license", "business"].includes(method)) {
    return NextResponse.json({ error: "Pick a verification method" }, { status: 400 });
  }
  if (!detail?.toString().trim()) {
    return NextResponse.json({ error: "Add your phone, business email, or license link" }, { status: 400 });
  }

  // Don't stack duplicate pending requests.
  const { data: existing } = await db
    .from("verification_requests")
    .select("id")
    .eq("shop_id", shopId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, status: "pending", duplicate: true });

  const cleanDetail = detail.toString().slice(0, 500);
  const { error } = await db.from("verification_requests").insert({
    shop_id: shopId,
    method,
    detail: cleanDetail,
    status: "pending",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Tell the founders there's something to review. Fire-and-forget: the
  // request is already saved and shows in the adminhost queue either way.
  const { data: shop } = await db.from("shops").select("name").eq("id", shopId).maybeSingle();
  sendMail({
    to: FOUNDER_REVIEWERS,
    subject: `Verification request: ${(shop as { name?: string } | null)?.name || "a shop"}`,
    text: [
      "A seller asked to be verified on Ahlam.",
      "",
      `Shop: ${(shop as { name?: string } | null)?.name || shopId}`,
      `Requested by: ${user.email || user.id}`,
      `Method: ${method}`,
      `Detail: ${cleanDetail}`,
      "",
      "Review and approve it in the founder console:",
      "https://ahlam.io/adminhost",
    ].join("\n"),
  }).catch(() => {});

  return NextResponse.json({ ok: true, status: "pending" });
}
