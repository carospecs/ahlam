import { NextResponse } from "next/server";
import { decodeVin, normalizeVin } from "@/lib/vin";

// NHTSA VPIC decode — free, no key required. Shared logic lives in @/lib/vin so
// the scanner (/api/identify) can decode a VIN it reads off a photo too.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("vin") || "";

  if (!normalizeVin(raw)) {
    return NextResponse.json({ error: "VIN must be 17 valid characters" }, { status: 400 });
  }

  const decode = await decodeVin(raw);
  if (!decode) return NextResponse.json({ error: "Failed to decode VIN" }, { status: 502 });
  return NextResponse.json({ ok: true, decode });
}
