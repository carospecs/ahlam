import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateMarketingDraft } from "@/lib/marketing-draft-agent";
import {
  CLIENT_STOREFRONTS,
  cronRequestAuthorized,
  extensionPayload,
  fallbackMarketingDraft,
  marketingWindow,
  selectMarketingCandidate,
} from "../../../../../scripts/marketing-core.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

type ShopResult = { shop: string; state: "ready" | "skipped" | "error"; detail: string };

function authorized(req: NextRequest) {
  return cronRequestAuthorized(process.env.CRON_SECRET, req.headers.get("authorization"));
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const now = new Date();
  const window = marketingWindow(now);
  if (!window.due) {
    return NextResponse.json({ ok: true, due: false, window });
  }

  const db = supabaseAdmin();
  const { data: shops, error: shopsError } = await db.from("shops")
    .select("id,name,location,business_phone,description,marketing_enabled")
    .eq("marketing_enabled", true)
    .order("name");
  if (shopsError) return NextResponse.json({ error: shopsError.message }, { status: 500 });

  // Each enabled shop is independent. Run them together so one slow model call
  // cannot consume the whole serverless window before later shops are reached.
  const results: ShopResult[] = await Promise.all((shops || []).map(async (shop): Promise<ShopResult> => {
    try {
      const [vehiclesResult, listingsResult, historyResult] = await Promise.all([
        db.from("vehicles")
          .select("id,year,make,model,trim,body,color,mileage,asking_price,sell_mode,status,title,description,photo_url,photo_urls,created_at,updated_at")
          .eq("shop_id", shop.id).eq("status", "active").order("updated_at", { ascending: false }),
        db.from("listings")
          .select("id,vehicle_id,status,price_usd,corrected,ai_output,photo_url,photo_urls,created_at,updated_at")
          .eq("shop_id", shop.id).eq("status", "active").order("updated_at", { ascending: false }),
        db.from("marketing_post_drafts")
          .select("source_vehicle_id,source_listing_id")
          .eq("shop_id", shop.id).eq("platform", "facebook")
          .order("created_at", { ascending: false }).limit(100),
      ]);
      if (vehiclesResult.error) throw vehiclesResult.error;
      if (listingsResult.error) throw listingsResult.error;
      if (historyResult.error) throw historyResult.error;

      const usedSourceKeys = (historyResult.data || []).map((row) => row.source_listing_id
        ? `listing:${row.source_listing_id}`
        : row.source_vehicle_id ? `vehicle:${row.source_vehicle_id}` : null).filter(Boolean) as string[];
      const candidate = selectMarketingCandidate({
        vehicles: vehiclesResult.data || [],
        listings: listingsResult.data || [],
        usedSourceKeys,
      } as any);
      if (!candidate) {
        return { shop: shop.name, state: "skipped", detail: "No active inventory with a public photo" };
      }

      const storefrontUrl = (CLIENT_STOREFRONTS as Record<string, string>)[shop.id] || `https://ahlam.io/shop/${shop.id}`;
      const fallback = fallbackMarketingDraft({ shop, candidate, storefrontUrl });
      const draft = await generateMarketingDraft({ shop, candidate, storefrontUrl, fallback });
      const payload = extensionPayload({ shop, candidate, draft });
      const { data, error } = await db.from("marketing_post_drafts").upsert({
        shop_id: shop.id,
        source_vehicle_id: candidate.vehicle?.id || null,
        source_listing_id: candidate.listing?.id || null,
        platform: "facebook",
        slot_key: window.slotKey,
        scheduled_for: now.toISOString(),
        headline: draft.headline,
        body: draft.body,
        image_url: candidate.photos[0] || null,
        payload,
        status: "ready",
        generator: draft.generator,
        agent_run_id: draft.agentRunId,
      }, { onConflict: "shop_id,platform,slot_key", ignoreDuplicates: true }).select("id").maybeSingle();
      if (error) throw error;
      return data?.id
        ? { shop: shop.name, state: "ready", detail: candidate.label }
        : { shop: shop.name, state: "skipped", detail: "This time slot already exists" };
    } catch (error: any) {
      return { shop: shop.name, state: "error", detail: error?.message || "Unknown error" };
    }
  }));

  return NextResponse.json({
    ok: !results.some((result) => result.state === "error"),
    due: true,
    slotKey: window.slotKey,
    created: results.filter((result) => result.state === "ready").length,
    results,
  });
}
