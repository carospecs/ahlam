import { limitForKind, planLabel, type UsageKind } from "./plan-limits";

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

// --- Scan batches -----------------------------------------------------------
// One AI "scan" = one whole car, but the client sends /api/identify one request
// PER PHOTO (up to 15 for the same car). The client tags every photo of a run
// with the same batchId; only the batch counts against the monthly quota, not
// each photo. Requires usage_events.batch_id + its unique index (migration
// 0038); both helpers degrade gracefully when the column isn't migrated yet.

/** Allowed when the batch is already counted (an in-flight car), else when the
 * shop is under its monthly scan cap. */
export async function checkScanUsage(
  db: AdminDb,
  shopId: string | null | undefined,
  plan: string | null | undefined,
  batchId: string | null,
): Promise<UsageCheck> {
  const limit = limitForKind(plan, "scan");
  if (limit == null || !shopId) return { allowed: true, used: 0, limit };
  if (batchId) {
    try {
      const { data, error } = await db
        .from("usage_events")
        .select("id")
        .eq("shop_id", shopId)
        .eq("kind", "scan")
        .eq("batch_id", batchId)
        .limit(1);
      if (!error && data?.length) return { allowed: true, used: 0, limit };
    } catch { /* column not migrated — fall through to the plain count */ }
  }
  return checkUsage(db, shopId, plan, "scan");
}

/** Count a scan batch once, no matter how many photos it spans. Best-effort. */
export async function recordScanUsage(
  db: AdminDb,
  shopId: string | null | undefined,
  batchId: string | null,
  firstPhoto: boolean,
): Promise<void> {
  if (!shopId) return;
  if (batchId) {
    try {
      const { error } = await db
        .from("usage_events")
        .upsert(
          { shop_id: shopId, kind: "scan", quantity: 1, batch_id: batchId },
          { onConflict: "shop_id,kind,batch_id", ignoreDuplicates: true },
        );
      if (!error) return;
    } catch { /* column not migrated — fall back below */ }
  }
  // No batch dedupe available: trust the client's first-photo flag so a
  // multi-photo car still counts as one scan instead of eight.
  if (firstPhoto || !batchId) await recordUsage(db, shopId, "scan");
}

/** A friendly limit message for an over-quota response. */
export function limitMessage(kind: UsageKind, limit: number, plan?: string | null): string {
  if (limit <= 0) {
    return "Your free month has ended. Pick a plan under Settings > Billing to keep going.";
  }
  const label =
    kind === "scan" ? `${limit} AI car scan${limit === 1 ? "" : "s"} this month`
    : kind === "car_post" ? `${limit} car post${limit === 1 ? "" : "s"} today`
    : kind === "export_car" ? `${limit} car exports this month`
    : `${limit} part exports this month`;
  const planName = planLabel(plan ?? "Solo");
  return `You've used all ${label} on the ${planName} plan. Upgrade under Settings > Billing for more.`;
}
