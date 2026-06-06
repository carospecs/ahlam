import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

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
        added: timeAgo(v.created_at), photos: v.photos || 0,
        parts: 0, value: 0, listed: 0, sold: 0,
        sellMode: v.sell_mode || "parts", askingPrice: v.asking_price, mileage: v.mileage || "",
        description: v.description || "", title: v.title || "", status: statusLabel(v.status),
        stock_number: v.stock_number || "",
      }));

      listings = (listRes.data || []).map((l: any) => {
        const c = l.corrected || l.ai_output || {};
        return {
          id: l.id, part: c.partName || c.part_name || "Unknown Part",
          vehicleId: l.vehicle_id, listingType: l.listing_type || "part",
          grade: c.condition || "Good", price: l.price_usd ?? c.priceUsd ?? c.suggestedPriceUsd ?? c.suggested_price ?? 0,
          status: statusLabel(l.status), markets: l.marketplace_url ? [marketName(l.marketplace_url)] : [],
          views: l.views || 0, photos: 0, fitment: formatFit(c.fitment),
          category: c.partCategory || c.part_category || "", confidence: c.confidence || "high",
          note: c.conditionNotes || c.condition_notes || "", desc: c.description || "",
          sellerId: l.seller_id,
        };
      });

      const vMap = new Map(vehicles.map((v: any) => [v.id, v]));
      for (const l of listings) {
        const v = l.vehicleId ? vMap.get(l.vehicleId) : null;
        if (v) { v.parts++; if (l.price > 0) v.value += l.price; if (l.status === "Posted" || l.status === "active") v.listed++; if (l.status === "Sold") v.sold++; }
      }

      threads = (convRes.data || []).map((c: any) => ({
        id: c.id, name: c.contact_name, market: c.market,
        status: c.status || "open",
        part: c.part_name || "", unread: c.unread || 0,
        time: c.last_time || "", avatar: c.contact_avatar || c.contact_name?.slice(0, 2).toUpperCase(),
        messages: (c.messages || []).map((m: any) => ({
          from: m.sender === "me" ? "me" : "them", text: m.body, time: m.time || "",
        })),
      }));

      activity = (actRes.data || []).map((a: any) => ({
        icon: a.icon, text: a.text, time: a.time || timeAgo(a.created_at), tone: a.tone || "muted",
      }));

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
