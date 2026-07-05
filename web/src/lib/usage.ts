import { effectivePlan, limitForKind, planLabel, type UsageKind } from "./plan-limits";

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
// each photo. The batch id is CLIENT-CHOSEN, so it can't be trusted as a
// standing free pass: we bucket it by a 30-minute window server-side. Photos of
// one analyze run land in the same bucket and dedupe to one usage row; a
// replayed batch id in a later window becomes a NEW row and is metered again.
// Requires usage_events.batch_id + its unique index (migration 0038); both
// helpers degrade gracefully when the column isn't migrated yet.

const SCAN_BATCH_WINDOW_MS = 30 * 60 * 1000;

function scanBatchKeys(batchId: string): { current: string; previous: string } | null {
  // Sanitize: uuid-like ids only, so hostile input can't smuggle odd rows.
  if (!/^[\w.:-]{8,64}$/.test(batchId)) return null;
  const bucket = Math.floor(Date.now() / SCAN_BATCH_WINDOW_MS);
  return { current: `${batchId}@${bucket}`, previous: `${batchId}@${bucket - 1}` };
}

/** Allowed when this batch is already counted in the current window (an
 * in-flight car), else when the shop is under its monthly scan cap. */
export async function checkScanUsage(
  db: AdminDb,
  shopId: string | null | undefined,
  plan: string | null | undefined,
  batchId: string | null,
): Promise<UsageCheck> {
  const limit = limitForKind(plan, "scan");
  if (limit == null || !shopId) return { allowed: true, used: 0, limit };
  const keys = batchId ? scanBatchKeys(batchId) : null;
  try {
    // One query: this month's scan rows, with batch ids so we can spot an
    // in-flight batch without a second round trip.
    const { data, error } = await db
      .from("usage_events")
      .select("quantity, batch_id")
      .eq("shop_id", shopId)
      .eq("kind", "scan")
      .gte("created_at", windowStartISO("scan"));
    if (error) {
      // batch_id column not migrated yet — fall back to the plain count.
      return checkUsage(db, shopId, plan, "scan");
    }
    const rows = data ?? [];
    if (keys && rows.some((r: { batch_id?: string | null }) => r.batch_id === keys.current || r.batch_id === keys.previous)) {
      return { allowed: true, used: 0, limit };
    }
    const used = rows.reduce((s: number, r: { quantity?: number }) => s + (r.quantity ?? 1), 0);
    return { allowed: used + 1 <= limit, used, limit };
  } catch {
    return { allowed: true, used: 0, limit }; // fail-open
  }
}

/** Count a scan batch once per window, no matter how many photos it spans.
 * Best-effort; never throws. */
export async function recordScanUsage(
  db: AdminDb,
  shopId: string | null | undefined,
  batchId: string | null,
  firstPhoto: boolean,
): Promise<void> {
  if (!shopId) return;
  const keys = batchId ? scanBatchKeys(batchId) : null;
  if (keys) {
    try {
      // A car whose photos straddle a window boundary shouldn't count twice:
      // if the previous window already has this batch, we're done.
      const { data: prev, error: prevErr } = await db
        .from("usage_events")
        .select("id")
        .eq("shop_id", shopId)
        .eq("kind", "scan")
        .eq("batch_id", keys.previous)
        .limit(1);
      if (!prevErr && prev?.length) return;
      const { error } = await db
        .from("usage_events")
        .upsert(
          { shop_id: shopId, kind: "scan", quantity: 1, batch_id: keys.current },
          { onConflict: "shop_id,kind,batch_id", ignoreDuplicates: true },
        );
      if (!error) return;
    } catch { /* column not migrated — fall back below */ }
  }
  // No batch dedupe available: trust the client's first-photo flag so a
  // multi-photo car still counts as one scan instead of fifteen.
  if (firstPhoto || !keys) await recordUsage(db, shopId, "scan");
}

/** A user's shop + its effective plan in one query (profiles→shops join).
 * `failed` marks a lookup error so callers can stay fail-open instead of
 * mistaking an infra error for "user has no shop". */
export async function resolveShopPlan(
  db: AdminDb,
  userId: string,
): Promise<{ shopId: string | null; plan: string; failed?: boolean }> {
  try {
    const { data, error } = await db
      .from("profiles")
      .select("shop_id, shops(plan, trial_ends_at, subscription_status)")
      .eq("id", userId)
      .single();
    if (error) return { shopId: null, plan: "pro", failed: true };
    const shopId = (data?.shop_id as string) || null;
    const raw = (data as { shops?: unknown })?.shops;
    const s = (Array.isArray(raw) ? raw[0] : raw) as
      | { plan?: string; trial_ends_at?: string; subscription_status?: string }
      | null;
    return { shopId, plan: effectivePlan(s?.plan, s?.trial_ends_at, s?.subscription_status) };
  } catch {
    return { shopId: null, plan: "pro", failed: true };
  }
}

/** Effective plan for a known shop id. Fail-open to the unlimited legacy plan. */
export async function effectiveShopPlan(db: AdminDb, shopId: string): Promise<string> {
  try {
    const { data } = await db
      .from("shops")
      .select("plan, trial_ends_at, subscription_status")
      .eq("id", shopId)
      .single();
    return effectivePlan(data?.plan, data?.trial_ends_at, data?.subscription_status);
  } catch {
    return "pro";
  }
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
