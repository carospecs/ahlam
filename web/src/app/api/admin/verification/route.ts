import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin, requireAdminOrViewer } from "@/lib/admin";

export const runtime = "nodejs";

// GET — the review queue for the founder console: pending verification
// requests with their shop names. Viewers (interns) can read it too.
export async function GET() {
  const who = await requireAdminOrViewer();
  if (!who) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const db = supabaseAdmin();
  const { data: requests, error } = await db
    .from("verification_requests")
    .select("id, shop_id, method, detail, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shopIds = [...new Set((requests || []).map((r: any) => r.shop_id).filter(Boolean))];
  const names = new Map<string, string>();
  if (shopIds.length) {
    const { data: shops } = await db.from("shops").select("id, name").in("id", shopIds);
    for (const s of (shops || []) as any[]) names.set(s.id, s.name || "Shop");
  }

  return NextResponse.json({
    requests: (requests || []).map((r: any) => ({
      id: r.id,
      shopId: r.shop_id,
      shopName: names.get(r.shop_id) || r.shop_id,
      method: r.method,
      detail: r.detail,
      createdAt: r.created_at,
    })),
  });
}

// POST {requestId, action: "approve" | "reject"} — founders only. Approving
// stamps the shop verified (the badge shows on its storefront and listings).
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { requestId, action } = await req.json().catch(() => ({}));
  if (!requestId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "requestId and action (approve|reject) required" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: request } = await db
    .from("verification_requests")
    .select("id, shop_id, method, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if ((request as any).status !== "pending") {
    return NextResponse.json({ error: "Already decided" }, { status: 409 });
  }

  const status = action === "approve" ? "approved" : "rejected";
  const { error: uErr } = await db.from("verification_requests")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  if (action === "approve") {
    const { error: sErr } = await db
      .from("shops")
      .update({ verified: true, verified_at: new Date().toISOString(), verification_method: (request as any).method })
      .eq("id", (request as any).shop_id);
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
