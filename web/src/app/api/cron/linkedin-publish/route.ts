import { NextRequest, NextResponse } from "next/server";
import { publishLinkedInDraft } from "@/lib/linkedin-draft-publisher";
import {
  getLinkedInConnection,
  linkedinAutoPublishEnabled,
  linkedinConfigured,
} from "@/lib/linkedin";
import { generateMarketingDraft } from "@/lib/marketing-draft-agent";
import { supabaseAdmin } from "@/lib/supabase";
import {
  CLIENT_STOREFRONTS,
  cronRequestAuthorized,
  fallbackLinkedInDraft,
  linkedinPayload,
  linkedinWindow,
  selectMarketingCandidate,
} from "../../../../../scripts/marketing-core.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  return cronRequestAuthorized(process.env.CRON_SECRET, req.headers.get("authorization"));
}

function usedSourceKeys(rows: any[]) {
  return rows.map((row) => row.source_listing_id
    ? `listing:${row.source_listing_id}`
    : row.source_vehicle_id ? `vehicle:${row.source_vehicle_id}` : null).filter(Boolean);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  const now = new Date();
  const window = linkedinWindow(now);
  if (!window.due) return NextResponse.json({ ok: true, due: false, window });

  const db = supabaseAdmin();
  const { data: existing, error: existingError } = await db.from("marketing_post_drafts")
    .select("id,status,shop_id,published_url,error")
    .eq("platform", "linkedin")
    .eq("slot_key", window.slotKey)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing) {
    return NextResponse.json({
      ok: existing.status !== "failed",
      due: true,
      created: false,
      draftId: existing.id,
      status: existing.status,
      publishedUrl: existing.published_url,
      error: existing.error,
    });
  }

  const [{ data: shops, error: shopsError }, { data: history, error: historyError }] = await Promise.all([
    db.from("shops")
      .select("id,name,location,business_phone,description,marketing_enabled")
      .eq("marketing_enabled", true)
      .in("id", Object.keys(CLIENT_STOREFRONTS))
      .order("name"),
    db.from("marketing_post_drafts")
      .select("shop_id,created_at")
      .eq("platform", "linkedin")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (shopsError) return NextResponse.json({ error: shopsError.message }, { status: 500 });
  if (historyError) return NextResponse.json({ error: historyError.message }, { status: 500 });

  const lastPostByShop = new Map<string, string>();
  for (const row of history || []) if (!lastPostByShop.has(row.shop_id)) lastPostByShop.set(row.shop_id, row.created_at);
  const orderedShops = [...(shops || [])].sort((a, b) => {
    const aLast = lastPostByShop.get(a.id) || "";
    const bLast = lastPostByShop.get(b.id) || "";
    return aLast.localeCompare(bLast) || a.name.localeCompare(b.name);
  });

  let prepared: { id: string; shop: string; source: string } | null = null;
  for (const shop of orderedShops) {
    const [vehiclesResult, listingsResult, sourceHistoryResult] = await Promise.all([
      db.from("vehicles")
        .select("id,year,make,model,trim,body,color,mileage,asking_price,sell_mode,status,title,description,photo_url,photo_urls,created_at,updated_at")
        .eq("shop_id", shop.id).eq("status", "active").order("updated_at", { ascending: false }),
      db.from("listings")
        .select("id,vehicle_id,status,price_usd,corrected,ai_output,photo_url,photo_urls,created_at,updated_at")
        .eq("shop_id", shop.id).eq("status", "active").order("updated_at", { ascending: false }),
      db.from("marketing_post_drafts")
        .select("source_vehicle_id,source_listing_id")
        .eq("shop_id", shop.id).eq("platform", "linkedin")
        .order("created_at", { ascending: false }).limit(100),
    ]);
    if (vehiclesResult.error || listingsResult.error || sourceHistoryResult.error) continue;
    const candidate = selectMarketingCandidate({
      vehicles: vehiclesResult.data || [],
      listings: listingsResult.data || [],
      usedSourceKeys: usedSourceKeys(sourceHistoryResult.data || []),
    } as any);
    if (!candidate) continue;

    const storefrontUrl = (CLIENT_STOREFRONTS as Record<string, string>)[shop.id] || `https://ahlam.io/shop/${shop.id}`;
    const fallback = fallbackLinkedInDraft({ shop, candidate, storefrontUrl });
    const draft = await generateMarketingDraft({ shop, candidate, storefrontUrl, fallback, platform: "linkedin" });
    const payload = linkedinPayload({ shop, candidate, draft, storefrontUrl });
    const { data, error } = await db.from("marketing_post_drafts").insert({
      shop_id: shop.id,
      source_vehicle_id: candidate.vehicle?.id || null,
      source_listing_id: candidate.listing?.id || null,
      platform: "linkedin",
      slot_key: window.slotKey,
      scheduled_for: now.toISOString(),
      headline: draft.headline,
      body: draft.body,
      image_url: candidate.photos[0] || null,
      payload,
      status: "ready",
      generator: draft.generator,
      agent_run_id: draft.agentRunId,
    }).select("id").single();
    if (error) {
      if (error.code === "23505") break;
      continue;
    }
    prepared = { id: data.id, shop: shop.name, source: candidate.label };
    break;
  }

  if (!prepared) {
    return NextResponse.json({ ok: true, due: true, created: false, status: "skipped", detail: "No public inventory with a photo is ready" });
  }

  let connection: any = null;
  if (linkedinConfigured()) {
    try { connection = await getLinkedInConnection(); } catch { /* migration or connection not ready */ }
  }
  if (!linkedinAutoPublishEnabled() || !linkedinConfigured() || connection?.status !== "active") {
    return NextResponse.json({
      ok: true,
      due: true,
      created: true,
      ...prepared,
      status: "ready",
      publish: linkedinAutoPublishEnabled() ? "connection_required" : "auto_publish_disabled",
    });
  }

  try {
    const published = await publishLinkedInDraft(prepared.id);
    return NextResponse.json({ ok: true, due: true, created: true, ...prepared, status: "published", ...published });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LinkedIn publishing failed";
    return NextResponse.json({ ok: false, due: true, created: true, ...prepared, status: "failed", error: message }, { status: 502 });
  }
}
