// Shared VIN helpers — validation + NHTSA VPIC decode (free, no key).
// Used by the /api/vin-decode endpoint and the scanner (/api/identify), so a VIN
// read off a photo gets decoded into an exact make/model/year/engine.
// https://vpic.nhtsa.dot.gov/api/

export interface VinDecode {
  vin: string;
  make: string | null;
  model: string | null;
  year: number | null;
  trim: string | null;
  bodyClass: string | null;
  engine: string | null;
  engineCylinders: string | null;
  displacement: string | null;
  fuelType: string | null;
  transmission: string | null;
  driveType: string | null;
  doors: string | null;
  seatingCapacity: string | null;
  manufacturer: string | null;
  plantCity: string | null;
  plantState: string | null;
  plantCountry: string | null;
  raw: Record<string, string>;
}

// A real VIN is 17 chars, capital letters + digits, never I/O/Q. Normalize and
// validate so we never decode (or trust) garbage the model misread off a photo.
export function normalizeVin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const vin = raw.toUpperCase().replace(/[\s-]/g, "").trim();
  if (vin.length !== 17) return null;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return null; // excludes I, O, Q
  return vin;
}

const NHTSA_LOOKUP = (vin: string) =>
  `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`;

// Decode a VIN via NHTSA. Returns null on any failure (bad VIN, network, etc.)
// so callers can fall back gracefully. Deterministic for a given VIN — which is
// exactly what makes repeat scans of the same car return the same vehicle.
export async function decodeVin(rawVin: string): Promise<VinDecode | null> {
  const vin = normalizeVin(rawVin);
  if (!vin) return null;
  try {
    // Cap the decode so a slow/unreachable NHTSA never stalls the scan — on
    // timeout we just skip the VIN lock and keep the model's visual estimate.
    const res = await fetch(NHTSA_LOOKUP(vin), {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.Results || [];
    const fields: Record<string, string> = {};
    for (const r of results) {
      if (r.Value && r.Value !== "" && r.Value !== "Not Applicable") fields[r.Variable] = r.Value;
    }
    // NHTSA returns a make/model only for a valid, in-database VIN; bail if absent.
    if (!fields["Make"] && !fields["Model"]) return null;
    return {
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
  } catch {
    return null;
  }
}
