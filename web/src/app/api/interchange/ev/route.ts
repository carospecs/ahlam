import { NextResponse } from "next/server";
import { classifyPowertrain } from "@/lib/powertrain";
import { evFamilyFromPartName, evFitLines, evInterchangeFor } from "@/lib/ev-interchange";

// PUBLIC curated EV interchange — no auth, no AI, no DB. Backs the "Also fits"
// block on public listing pages and is safe to expose because it only reads the
// static hand-checked dataset in lib/ev-interchange. Fail silent by design:
// empty, ICE, or unknown input returns { ok: true, lines: [] } — this endpoint
// must never be wrong, only quiet.
//
//   GET /api/interchange/ev?make=Tesla&model=Model%20Y&year=2021&part=Rear%20Drive%20Unit

export const runtime = "nodejs";

const CACHE_HEADERS = { "Cache-Control": "public, max-age=3600" };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const make = String(url.searchParams.get("make") || "").trim();
  const model = String(url.searchParams.get("model") || "").trim();
  const year = String(url.searchParams.get("year") || "").trim();
  const part = String(url.searchParams.get("part") || "").trim();

  const empty = NextResponse.json({ ok: true, lines: [], cautions: [] }, { headers: CACHE_HEADERS });
  if (!make || !model || !year || !part) return empty;

  try {
    if (classifyPowertrain({ make, model }).type !== "bev") return empty;
    const family = evFamilyFromPartName(part);
    if (!family) return empty;

    const lines = evFitLines({ make, model, year, partName: part });
    if (lines.length === 0) return empty;

    const groups = evInterchangeFor({ make, model, year, family });
    const cautions = Array.from(
      new Set(groups.flatMap((g) => [...(g.constraints || []), ...(g.notes ? [g.notes] : [])]).filter(Boolean)),
    );
    return NextResponse.json({ ok: true, lines, cautions }, { headers: CACHE_HEADERS });
  } catch {
    return empty;
  }
}
