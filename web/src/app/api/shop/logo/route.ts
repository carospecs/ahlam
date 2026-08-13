import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = "shop-assets";
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

// Upload a shop logo OR cover photo (form field kind: "logo" | "cover") to
// public storage and save its URL on the shop. Owners/editors only. Service
// role handles the upload (bypasses storage RLS).
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  const shopId = profile?.shop_id;
  if (!shopId) return NextResponse.json({ error: "No shop" }, { status: 400 });
  const { data: member } = await db.from("shop_members").select("role").eq("shop_id", shopId).eq("user_id", user.id).single();
  if (!member || (member.role !== "owner" && member.role !== "editor")) {
    return NextResponse.json({ error: "You don't have permission to change the logo" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind") === "cover" ? "cover" : "logo";
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be under 4 MB" }, { status: 400 });
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: "Use a PNG, JPG, or WebP image" }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `${kind === "cover" ? "covers" : "logos"}/${shopId}.${ext}`;
  let { error: upErr } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: true });
  // Environments that predate the storage migration have no bucket yet, which
  // used to fail every upload with "Bucket not found". Create it and retry.
  if (upErr && /bucket not found/i.test(upErr.message)) {
    await db.storage.createBucket(BUCKET, { public: true });
    ({ error: upErr } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: true }));
  }
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Cache-bust so the new image shows immediately after re-upload to the same path.
  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${bytes.length}`;

  const { error: updErr } = await db.from("shops")
    .update(kind === "cover" ? { cover_url: url } : { logo_url: url })
    .eq("id", shopId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, kind, url, logoUrl: kind === "logo" ? url : undefined });
}
