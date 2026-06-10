import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// GET /api/reviews?shopId=... — public list of a shop's reviews + its summary.
export async function GET(req: Request) {
  const shopId = new URL(req.url).searchParams.get("shopId");
  if (!shopId) return NextResponse.json({ error: "shopId required" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: shop } = await db.from("shops").select("rating_avg, rating_count, verified").eq("id", shopId).single();
  const { data: rows } = await db
    .from("reviews")
    .select("id, rating, body, verified_purchase, created_at, author_id")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Attach reviewer display names (best-effort).
  const ids = Array.from(new Set((rows || []).map((r) => r.author_id)));
  const { data: profiles } = ids.length
    ? await db.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] };
  const nameOf = new Map((profiles || []).map((p: any) => [p.id, p.display_name]));

  const reviews = (rows || []).map((r) => ({
    id: r.id,
    rating: r.rating,
    body: r.body,
    verifiedPurchase: r.verified_purchase,
    createdAt: r.created_at,
    author: nameOf.get(r.author_id) || "Buyer",
  }));

  return NextResponse.json({
    ratingAvg: Number(shop?.rating_avg || 0),
    ratingCount: shop?.rating_count || 0,
    verified: !!shop?.verified,
    reviews,
  });
}

// POST /api/reviews — create or update the signed-in user's review for a shop.
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to leave a review" }, { status: 401 });

  const { shopId, rating, body } = await req.json().catch(() => ({}));
  const r = Number(rating);
  if (!shopId || !Number.isInteger(r) || r < 1 || r > 5) {
    return NextResponse.json({ error: "A rating from 1 to 5 is required" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Can't review your own shop.
  const { data: profile } = await db.from("profiles").select("shop_id").eq("id", user.id).single();
  if (profile?.shop_id === shopId) {
    return NextResponse.json({ error: "You can't review your own shop" }, { status: 400 });
  }

  // Mark as a verified purchase if the reviewer has a completed order here.
  const { data: order } = await db
    .from("orders")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("seller_shop_id", shopId)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();

  const { error } = await db
    .from("reviews")
    .upsert(
      {
        shop_id: shopId,
        author_id: user.id,
        rating: r,
        body: (body || "").toString().slice(0, 2000) || null,
        verified_purchase: !!order,
        order_id: order?.id || null,
      },
      { onConflict: "shop_id,author_id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
