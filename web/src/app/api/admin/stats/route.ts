import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { effectivePlan, planLabel } from "@/lib/plan-limits";

export const runtime = "nodejs";

/**
 * GET /api/admin/stats → the founder console's data: every user with their
 * shop, plan, and usage, plus the headline totals. Admin-only (ADMIN_EMAILS),
 * service-role reads.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const db = supabaseAdmin();
  try {
    // All auth users (paged; 2000 is plenty of headroom for now).
    const users: { id: string; email?: string; created_at?: string; last_sign_in_at?: string }[] = [];
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const batch = data?.users ?? [];
      users.push(...batch);
      if (batch.length < 200) break;
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const [profilesR, shopsR, listingsR, vehiclesR, usageR, waitlistR] = await Promise.all([
      db.from("profiles").select("id, shop_id"),
      db.from("shops").select("id, name, plan, trial_ends_at, subscription_status, account_type, created_at"),
      db.from("listings").select("shop_id, status").limit(20000),
      db.from("vehicles").select("shop_id").limit(20000),
      db.from("usage_events").select("shop_id, kind, quantity").gte("created_at", monthStart).limit(20000),
      db.from("waitlist").select("email, notified_at"),
    ]);

    const shopById = new Map((shopsR.data ?? []).map((s) => [s.id, s]));
    const shopIdByUser = new Map((profilesR.data ?? []).map((p) => [p.id, p.shop_id]));

    const listingsByShop = new Map<string, { total: number; active: number }>();
    for (const l of listingsR.data ?? []) {
      const e = listingsByShop.get(l.shop_id) ?? { total: 0, active: 0 };
      e.total++;
      if (l.status === "active") e.active++;
      listingsByShop.set(l.shop_id, e);
    }
    const vehiclesByShop = new Map<string, number>();
    for (const v of vehiclesR.data ?? []) {
      vehiclesByShop.set(v.shop_id, (vehiclesByShop.get(v.shop_id) ?? 0) + 1);
    }
    const usageByShop = new Map<string, { scans: number; posts: number }>();
    for (const u of usageR.data ?? []) {
      const e = usageByShop.get(u.shop_id) ?? { scans: 0, posts: 0 };
      if (u.kind === "scan") e.scans += u.quantity ?? 1;
      if (u.kind === "car_post") e.posts += u.quantity ?? 1;
      usageByShop.set(u.shop_id, e);
    }

    const rows = users
      .map((u) => {
        const shopId = shopIdByUser.get(u.id) ?? null;
        const shop = shopId ? shopById.get(shopId) : null;
        const planId = shop ? effectivePlan(shop.plan, shop.trial_ends_at, shop.subscription_status) : null;
        const trialEnd = shop?.trial_ends_at ? new Date(shop.trial_ends_at) : null;
        const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : null;
        const lst = shopId ? listingsByShop.get(shopId) : null;
        return {
          email: u.email ?? "",
          joined: u.created_at ?? null,
          lastSignIn: u.last_sign_in_at ?? null,
          shopId,
          shopName: shop?.name ?? null,
          accountType: shop?.account_type ?? null,
          plan: shop ? planLabel(shop.plan) : null,
          planId,
          subscriptionStatus: shop?.subscription_status ?? null,
          trialDaysLeft,
          scansThisMonth: shopId ? usageByShop.get(shopId)?.scans ?? 0 : 0,
          carPostsThisMonth: shopId ? usageByShop.get(shopId)?.posts ?? 0 : 0,
          listings: lst?.total ?? 0,
          activeListings: lst?.active ?? 0,
          vehicles: shopId ? vehiclesByShop.get(shopId) ?? 0 : 0,
        };
      })
      .sort((a, b) => (b.joined ?? "").localeCompare(a.joined ?? ""));

    // Plan mix across SHOPS (a team shares one shop/plan).
    const planCounts: Record<string, number> = {};
    for (const s of shopsR.data ?? []) {
      const id = effectivePlan(s.plan, s.trial_ends_at, s.subscription_status);
      planCounts[id] = (planCounts[id] ?? 0) + 1;
    }

    const weekAgo = Date.now() - 7 * 86400000;
    const waitlist = waitlistR.data ?? [];
    return NextResponse.json({
      ok: true,
      totals: {
        users: users.length,
        newUsers7d: users.filter((u) => u.created_at && new Date(u.created_at).getTime() > weekAgo).length,
        shops: (shopsR.data ?? []).length,
        waitlist: waitlist.length,
        waitlistEmailed: waitlist.filter((w) => w.notified_at).length,
        listings: (listingsR.data ?? []).length,
        activeListings: (listingsR.data ?? []).filter((l) => l.status === "active").length,
        vehicles: (vehiclesR.data ?? []).length,
        scansThisMonth: [...usageByShop.values()].reduce((s, e) => s + e.scans, 0),
        carPostsThisMonth: [...usageByShop.values()].reduce((s, e) => s + e.posts, 0),
      },
      planCounts,
      rows,
    });
  } catch (e) {
    console.error("admin stats failed", e);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
