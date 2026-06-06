import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Record a marketplace view (fire-and-forget from the buyer's detail open).
// Uses the SECURITY DEFINER increment_*_views RPCs so it works for anyone and
// never fails the UI — demo rows and missing RPCs (pre-0007) no-op softly.
export async function POST(req: NextRequest) {
  const { listingId, vehicleId } = await req.json().catch(() => ({}));

  // Demo rows have synthetic ids ("m1", "mv1", "demo-…") — nothing to record.
  if ((listingId && String(listingId).startsWith("m")) || (vehicleId && String(vehicleId).startsWith("m"))) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const db = supabaseAdmin();
  try {
    if (listingId) await db.rpc("increment_listing_views", { p_listing_id: listingId });
    else if (vehicleId) await db.rpc("increment_vehicle_views", { p_vehicle_id: vehicleId });
  } catch {
    // best-effort — view counting must never block the buyer's view
  }
  return NextResponse.json({ ok: true });
}
