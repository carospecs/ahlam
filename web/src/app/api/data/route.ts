import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeGrade } from "@/lib/grade";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();

  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const shopId = profile?.shop_id || null;

  let shop: any = { name: "", location: "", phone: "", members: [], plan: "Pro", trialDaysLeft: 18 };
  let vehicles: any[] = [];
  let listings: any[] = [];
  let threads: any[] = [];
  let activity: any[] = [];
  let myRole = "owner";

  if (shopId) {
    const [shopRes, vehRes, listRes, convRes, actRes, membersRes] = await Promise.all([
      db.from("shops").select("*").eq("id", shopId).single(),
      db.from("vehicles").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }),
      db.from("listings").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }),
      db.from("conversations").select("*, messages(*)").eq("shop_id", shopId).order("created_at", { ascending: false }),
      db.from("activity_log").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }),
      db.from("shop_members").select("*, profiles(display_name, avatar_url)").eq("shop_id", shopId),
    ]);

    if (!shopRes.error) {
      vehicles = (vehRes.data || []).map((v: any) => ({
        id: v.id, year: v.year, make: v.make, model: v.model, trim: v.trim || "",
        body: v.body || "", vin: v.vin || "", color: v.color || "",
        added: timeAgo(v.created_at), photos: v.photos || 0, image: v.photo_url || null,
        images: Array.isArray(v.photo_urls) ? v.photo_urls.filter(Boolean) : (v.photo_url ? [v.photo_url] : []),
        parts: 0, value: 0, listed: 0, sold: 0, soldValue: 0,
        acquisitionCost: typeof v.acquisition_cost_cents === "number" ? v.acquisition_cost_cents / 100 : null,
        sellMode: v.sell_mode || "parts", askingPrice: v.asking_price, mileage: v.mileage || "",
        description: v.description || "", title: v.title || "", status: statusLabel(v.status),
        stock_number: v.stock_number || "",
        ebayUrl: v.ebay_url || null, ebayLotUrl: v.ebay_lot_url || null,
      }));

      listings = (listRes.data || []).map((l: any) => {
        const c = l.corrected || l.ai_output || {};
        return {
          id: l.id, part: c.partName || c.part_name || "Unknown Part",
          vehicleId: l.vehicle_id, listingType: l.listing_type || "part",
          grade: normalizeGrade(c.condition), price: l.price_usd ?? c.priceUsd ?? c.suggestedPriceUsd ?? c.suggested_price ?? 0,
          status: statusLabel(l.status), markets: l.marketplace_url ? [marketName(l.marketplace_url)] : [],
          views: l.views || 0, photos: 0, fitment: formatFit(c.fitment),
          category: c.partCategory || c.part_category || "", confidence: c.confidence || "high",
          note: c.conditionNotes || c.condition_notes || "", desc: c.description || "",
          sellerId: l.seller_id, ebayUrl: l.ebay_url || null, image: l.photo_url || null,
          stockLocation: l.stock_location || "", barcode: l.barcode || "",
          // Surfaced for the Car-Part.com / URG export (CHN-1).
          hollander: c.hollander || c.interchange || c.hollanderNumber || "",
          oem: Array.isArray(c.oemNumbers) ? (c.oemNumbers[0] || "") : (c.oem || ""),
          stockNumber: l.stock_number || "",
        };
      });

      const vMap = new Map(vehicles.map((v: any) => [v.id, v]));
      // A part belongs to a known vehicle, so its fitment should be that car —
      // not whatever the AI could (or couldn't) infer from a single photo. Replace
      // "unable to determine…" hedges (and blanks) with the linked car's identity.
      const isHedge = (s: string) => !s || /unable to|cannot determine|can'?t determine|not (?:visible|clear|determinable)|from (?:an? )?interior|photo alone|insufficient|unknown/i.test(s);
      const vehLabel = (v: any) => [v.year, v.make, v.model].filter(Boolean).join(" ");
      for (const l of listings) {
        const v = l.vehicleId ? vMap.get(l.vehicleId) : null;
        if (v) { v.parts++; if (l.price > 0) v.value += l.price; if (l.status === "Posted" || l.status === "active") v.listed++; if (l.status === "Sold") { v.sold++; v.soldValue += l.price || 0; } }
        if (isHedge(l.fitment)) l.fitment = v ? vehLabel(v) : "";
      }

      threads = (convRes.data || []).map((c: any) => ({
        id: c.id, name: c.contact_name, market: c.market === "CaroSpecs" ? "Ahlam" : (c.market || "Ahlam"),
        status: c.status || "open",
        part: c.part_name === "CaroSpecs" ? "Ahlam" : (c.part_name || ""), unread: c.unread || 0,
        buyerId: c.buyer_id || null,
        time: c.last_time || "", avatar: c.contact_avatar || c.contact_name?.slice(0, 2).toUpperCase(),
        messages: (c.messages || []).map((m: any) => ({
          from: m.sender === "me" ? "me" : "them", text: m.body, time: m.time || "",
        })),
      }));

      // Attach online status for each unique buyer.
      const buyerIds = [...new Set(threads.map((t: any) => t.buyerId).filter(Boolean))];
      if (buyerIds.length) {
        const { data: buyers } = await db.from("profiles").select("id, is_online").in("id", buyerIds);
        const onlineMap = new Map((buyers || []).map((b: any) => [b.id, b.is_online]));
        threads.forEach((t: any) => { if (t.buyerId) t.isOnline = onlineMap.get(t.buyerId) || false; });
      }

      activity = (actRes.data || []).map((a: any) => {
        // No entity FK on activity_log, so route the click to the relevant section.
        const txt = String(a.text || "").toLowerCase();
        const link = a.icon === "MessageSquare" || txt.includes("message") || txt.includes("inquiry") ? "messages"
          : txt.includes("part") ? "parts"
          : txt.includes("vehicle") || txt.includes("car") ? "vehicles"
          : txt.includes("export") || txt.includes("posted") || txt.includes("ebay") ? "parts"
          : "overview";
        return { icon: a.icon, text: a.text, time: a.time || timeAgo(a.created_at), tone: a.tone || "muted", link };
      });

      const members = (membersRes.data || []).map((m: any) => ({
        userId: m.user_id, name: m.profiles?.display_name || "Unknown", role: m.role,
        initials: (m.profiles?.display_name || "U").split(" ").map((s: string) => s[0]).join("").toUpperCase().slice(0, 2),
      }));

      myRole = members.find((m: any) => m.userId === user.id)?.role || "owner";

      const s = shopRes.data;
      const trialEnd = s.trial_ends_at ? new Date(s.trial_ends_at) : null;
      const trialLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : 0;
      const planName = s.plan || "Pro";
      shop = {
        id: s.id, name: s.name, location: s.location || "",
        phone: s.business_phone || "", email: s.email || "", website: s.website || "",
        description: s.description || "", hours: s.hours || "", logoUrl: s.logo_url || null,
        coverUrl: s.cover_url || null, members, plan: planName, trialDaysLeft: trialLeft,
      };
    }
  }

  return NextResponse.json({
    user: {
      id: user.id, email: user.email,
      displayName: profile?.display_name || user.email?.split("@")[0],
      avatarUrl: profile?.avatar_url, phone: profile?.phone, bio: profile?.bio, shopId,
      role: myRole, notificationPrefs: profile?.notification_prefs || null,
    },
    shop,
    vehicles,
    listings,
    threads,
    activity,
  });
}

function formatFit(fit: any): string {
  if (!fit) return "";
  if (typeof fit === "string") return fit;
  if (Array.isArray(fit)) {
    return fit.map((f: any) => {
      if (typeof f === "string") return f;
      const yr = f.yearStart && f.yearEnd && f.yearStart !== f.yearEnd ? `${f.yearStart}–${f.yearEnd}` : (f.yearStart || "");
      return [yr, f.make, f.model, f.notes].filter(Boolean).join(" ").trim();
    }).filter(Boolean).join(", ");
  }
  return "";
}

function statusLabel(s: string) {
  if (s === "active") return "Posted";
  if (s === "draft") return "Draft";
  if (s === "sold") return "Sold";
  return s;
}

function marketName(url: string) {
  if (!url) return "";
  if (url.includes("facebook")) return "Facebook";
  if (url.includes("offerup")) return "OfferUp";
  if (url.includes("ebay")) return "eBay";
  return "Marketplace";
}

function timeAgo(iso: string) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}
