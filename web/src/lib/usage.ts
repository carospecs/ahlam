import { limitForKind, type UsageKind } from "./plan-limits";

// Plan-usage metering against the usage_events table (migration 0033). Every
// helper is FAIL-OPEN: if the table doesn't exist yet or a query errors, we
// allow the action rather than break the app. Unlimited plans short-circuit
// before touching the DB.

type AdminDb = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

function windowStartISO(kind: UsageKind): string {
  const now = new Date();
  if (kind === "car_post") {
    // start of today (UTC)
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  }
  // start of the calendar month (UTC)
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export interface UsageCheck {
  allowed: boolean;
  used: number;
  limit: number | null; // null = unlimited
}

/** How much of the plan's limit a shop has used in the current window. */
export async function checkUsage(
  db: AdminDb,
  shopId: string | null | undefined,
  plan: string | null | undefined,
  kind: UsageKind,
  addQty = 1,
): Promise<UsageCheck> {
  const limit = limitForKind(plan, kind);
  if (limit == null || !shopId) return { allowed: true, used: 0, limit };
  try {
    const { data, error } = await db
      .from("usage_events")
      .select("quantity")
      .eq("shop_id", shopId)
      .eq("kind", kind)
      .gte("created_at", windowStartISO(kind));
    if (error) return { allowed: true, used: 0, limit }; // fail-open (e.g. table missing)
    const used = (data ?? []).reduce((s: number, r: { quantity?: number }) => s + (r.quantity ?? 1), 0);
    return { allowed: used + addQty <= limit, used, limit };
  } catch {
    return { allowed: true, used: 0, limit };
  }
}

/** Record one (or more) units of usage. Best-effort; never throws. */
export async function recordUsage(
  db: AdminDb,
  shopId: string | null | undefined,
  kind: UsageKind,
  quantity = 1,
): Promise<void> {
  if (!shopId) return;
  try {
    await db.from("usage_events").insert({ shop_id: shopId, kind, quantity });
  } catch {
    /* fail-open */
  }
}

/** A friendly limit message for an over-quota response. */
export function limitMessage(kind: UsageKind, limit: number): string {
  const label =
    kind === "scan" ? `${limit} AI scan${limit === 1 ? "" : "s"} this month`
    : kind === "car_post" ? `${limit} car post${limit === 1 ? "" : "s"} today`
    : kind === "export_car" ? `${limit} car exports this month`
    : `${limit} part exports this month`;
  return `You've used all ${label} on the Solo plan. Upgrade to Growth for more.`;
}
