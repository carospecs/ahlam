import { NextResponse } from "next/server";

// NHTSA VPIC — free, no key. Returns the model list for a make (optionally a
// model year) so the interchange form can offer a real "pick your model" list.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const make = searchParams.get("make")?.trim();
  const year = searchParams.get("year")?.trim();
  if (!make) return NextResponse.json({ ok: true, models: [] });

  const url = year
    ? `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${encodeURIComponent(year)}?format=json`
    : `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(make)}?format=json`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return NextResponse.json({ ok: true, models: [] });
    const data = await res.json();
    const models = Array.from(
      new Set(((data.Results || []) as any[]).map((r) => String(r.Model_Name || "").trim()).filter(Boolean))
    ).sort();
    return NextResponse.json({ ok: true, models });
  } catch {
    return NextResponse.json({ ok: true, models: [] });
  }
}
