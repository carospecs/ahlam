export interface VinInfo {
  make: string | null;
  model: string | null;
  year: number | null;
  engine: string | null;
  trim: string | null;
}

export async function decodeVin(vin: string): Promise<VinInfo> {
  const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(vin)}?format=json`);
  const data = await res.json();
  const results: any[] = data.Results || [];
  const find = (key: string) => results.find((r: any) => r.Variable === key)?.Value || null;
  return {
    make: find("Make"),
    model: find("Model"),
    year: find("Model Year") ? Number(find("Model Year")) : null,
    engine: find("Engine Model"),
    trim: find("Trim"),
  };
}
