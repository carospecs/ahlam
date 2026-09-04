import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrViewer, requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const EDITABLE_STATUSES = new Set(["ready", "opened", "published", "skipped"]);

export async function GET() {
  const caller = await requireAdminOrViewer();
  if (!caller) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const db = supabaseAdmin();
  const { data: drafts, error } = await db
    .from("marketing_post_drafts")
    .select("id,shop_id,source_vehicle_id,source_listing_id,platform,slot_key,scheduled_for,headline,body,image_url,payload,status,generator,agent_run_id,created_at,updated_at")
    .in("status", ["ready", "opened", "published"])
    .order("scheduled_for", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shopIds = [...new Set((drafts || []).map((draft) => draft.shop_id))];
  const { data: shops, error: shopsError } = shopIds.length
    ? await db.from("shops").select("id,name,location,business_phone").in("id", shopIds)
    : { data: [], error: null };
  if (shopsError) return NextResponse.json({ error: shopsError.message }, { status: 500 });
  const shopById = new Map((shops || []).map((shop) => [shop.id, shop]));

  return NextResponse.json({
    ok: true,
    role: caller.role,
    drafts: (drafts || []).map((draft) => ({ ...draft, shop: shopById.get(draft.shop_id) || null })),
  });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Draft id is required" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: existing, error: findError } = await db
    .from("marketing_post_drafts")
    .select("id,payload")
    .eq("id", id)
    .maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status != null) {
    const status = String(body.status);
    if (!EDITABLE_STATUSES.has(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    update.status = status;
  }
  const headline = body.headline == null ? null : String(body.headline).trim().slice(0, 150);
  const draftBody = body.body == null ? null : String(body.body).trim().slice(0, 1600);
  if (headline !== null) {
    if (!headline) return NextResponse.json({ error: "Headline cannot be blank" }, { status: 400 });
    update.headline = headline;
  }
  if (draftBody !== null) {
    if (!draftBody) return NextResponse.json({ error: "Post text cannot be blank" }, { status: 400 });
    update.body = draftBody;
  }
  if (headline !== null || draftBody !== null) {
    const payload = { ...((existing as any).payload || {}) };
    if (headline !== null) payload.title = headline;
    if (draftBody !== null) {
      payload.body = draftBody;
      payload.description = draftBody;
      payload.text = draftBody;
    }
    update.payload = payload;
  }

  const { data, error } = await db.from("marketing_post_drafts")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  console.log(`[marketing] ${admin} updated draft ${id}`);
  return NextResponse.json({ ok: true, draft: data });
}
