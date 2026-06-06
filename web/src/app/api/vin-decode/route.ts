import { NextResponse } from "next/server";

// NHTSA VPIC API — free, no key required
// https://vpic.nhtsa.dot.gov/api/
const NHTSA_LOOKUP = (vin: string) =>
  `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vin = searchParams.get("vin")?.toUpperCase().trim();

  if (!vin || vin.length < 11) {
    return NextResponse.json({ error: "VIN must be at least 11 characters" }, { status: 400 });
  }

  try {
    const res = await fetch(NHTSA_LOOKUP(vin), { next: { revalidate: 86400 } });
    if (!res.ok) {
      return NextResponse.json({ error: "NHTSA API error" }, { status: 502 });
    }
    const data = await res.json();

    // Extract meaningful fields from the NHTSA response
    const results = data.Results || [];
    const fields: Record<string, string> = {};
    for (const r of results) {
      if (r.Value && r.Value !== "" && r.Value !== "Not Applicable") {
        fields[r.Variable] = r.Value;
      }
    }

    const decode = {
      vin,
      make: fields["Make"] || null,
      model: fields["Model"] || null,
      year: fields["Model Year"] ? parseInt(fields["Model Year"]) : null,
      trim: fields["Trim"] || null,
      bodyClass: fields["Body Class"] || null,
      engine: fields["Engine Model"] || fields["Engine Configuration"] || null,
      engineCylinders: fields["Engine Number of Cylinders"] || null,
      displacement: fields["Displacement (CC)"] || null,
      fuelType: fields["Fuel Type - Primary"] || null,
      transmission: fields["Transmission Style"] || null,
      driveType: fields["Drive Type"] || fields["Drive System"] || null,
      doors: fields["Number of Doors"] || null,
      seatingCapacity: fields["Seating Capacity"] || null,
      manufacturer: fields["Manufacturer Name"] || null,
      plantCity: fields["Plant City"] || null,
      plantState: fields["Plant State"] || null,
      plantCountry: fields["Plant Country"] || null,
      raw: fields,
    };

    return NextResponse.json({ ok: true, decode });
  } catch (err) {
    return NextResponse.json({ error: "Failed to decode VIN" }, { status: 500 });
  }
}
