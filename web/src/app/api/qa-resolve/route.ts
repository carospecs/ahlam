// QA RESOLVER AGENT (A1, docs/agent-layer-blueprint.md) — the exception handler behind
// the Stage-7 scan QA guardrail. When runScanQa raises warn-level flags, the client sends
// each one here as a "case"; this route spends AT MOST ONE focused flash vision call per
// case trying to settle it with evidence, so the seller sees either nothing (false alarm),
// a warning with the answer attached, or a pointed escalation — never a bare "verify this."
//
// Contract (the whole reason this is safe): the agent NEVER mutates parts. It returns a
// Resolution per case; any proposedEdit is applied client-side only when the seller
// accepts it. Bounds: ≤ 6 cases per scan, ≤ 1 model call per case, flash only.
import { NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini";
import { supabaseAdmin } from "@/lib/supabase";
import { colorConflict } from "@/lib/scan-qa";

export const runtime = "nodejs";
export const maxDuration = 60;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const MAX_CASES = 6;

// A "side" case: the part's name and description disagree on driver/passenger side.
// The agent looks at the photo and decides which one is right.
type SideCase = {
  id: string;
  kind: "side";
  partName: string;
  nameSide: "driver" | "passenger";
  descSide: "driver" | "passenger";
  image: string; // downscaled data URL of the photo the part was scanned from
  box?: [number, number, number, number]; // the part's bbox in that photo (0–1)
  photoFront?: string; // the photo's orientation, vehicleFront vocabulary
};

// A "color" case: photos reported body colors with no shared word. The agent re-reads
// the color of each photo carefully; matching families dissolve the flag, a genuine
// mismatch escalates with the exact photos to check.
type ColorCase = {
  id: string;
  kind: "color";
  colors: string[]; // the conflicting labels the scan reported
  photos: { index: number; image: string }[];
};

type QaCase = SideCase | ColorCase;

export type QaResolution = {
  id: string;
  verdict: "resolved" | "confirmed" | "escalate";
  evidence: string;
  proposedEdit?: { field: "partName" | "description"; action: "swap-side" };
};

// data:image/jpeg;base64,... → Gemini inline_data part. Null for anything else.
function inlineImage(dataUrl: string): { inline_data: { mime_type: string; data: string } } | null {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  return m ? { inline_data: { mime_type: m[1], data: m[2] } } : null;
}

// One JSON-mode flash call; returns the parsed object or null on any failure.
async function askJson(parts: unknown[]): Promise<Record<string, unknown> | null> {
  try {
    const res = await geminiGenerate("gemini-2.5-flash", {
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text: string = (j.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text ?? "").join("");
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim());
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

const FRONT_HINT: Record<string, string> = {
  "toward-camera": "The FRONT of the vehicle faces the camera, so the vehicle's driver side (US, left of the driver) appears on the RIGHT of the image.",
  "away-from-camera": "The REAR of the vehicle faces the camera, so the vehicle's driver side appears on the LEFT of the image.",
  "points-left": "Side profile, nose pointing left.",
  "points-right": "Side profile, nose pointing right.",
};

async function resolveSide(c: SideCase): Promise<QaResolution> {
  const img = inlineImage(c.image);
  if (!img) return { id: c.id, verdict: "escalate", evidence: "The part's photo couldn't be re-examined." };
  const boxLine = c.box
    ? `The part in question sits inside the region [x0=${c.box[0].toFixed(2)}, y0=${c.box[1].toFixed(2)}, x1=${c.box[2].toFixed(2)}, y1=${c.box[3].toFixed(2)}] (fractions of the image).`
    : "";
  const hint = (c.photoFront && FRONT_HINT[c.photoFront]) || "";
  const ans = await askJson([
    { text:
      `You are verifying a salvage-yard part listing. This photo shows a vehicle; the part is "${c.partName}". ` +
      `${boxLine} ${hint}\n\n` +
      `Question: is this part on the vehicle's DRIVER side or PASSENGER side (US convention: driver = left side of the vehicle when seated in it)? ` +
      `Use visible cues — which way the vehicle faces, the steering wheel if visible, badge/text direction, the body side shown. ` +
      `If the photo genuinely doesn't show enough to tell, say "unsure" — do not guess.\n\n` +
      `Reply ONLY with JSON: {"side": "driver" | "passenger" | "unsure", "evidence": "<one short sentence citing what you saw>"}` },
    img,
  ]);
  const side = ans?.side;
  const seen = typeof ans?.evidence === "string" ? (ans.evidence as string) : "";
  if (side !== "driver" && side !== "passenger") {
    return { id: c.id, verdict: "escalate", evidence: seen || "The photo doesn't show enough to determine the side — check it by hand." };
  }
  // The flag means name and description disagree; whichever field contradicts what the
  // photo shows is the one to fix.
  const wrongField = side === c.nameSide ? "description" : "partName";
  return {
    id: c.id,
    verdict: "confirmed",
    evidence: `Photo check: this is the ${side}-side part. ${seen}`.trim(),
    proposedEdit: { field: wrongField, action: "swap-side" },
  };
}

async function resolveColor(c: ColorCase): Promise<QaResolution> {
  const imgs = c.photos.slice(0, 15).map((p) => ({ p, img: inlineImage(p.image) })).filter((x) => x.img);
  if (imgs.length < 2) return { id: c.id, verdict: "escalate", evidence: "The conflicting photos couldn't be re-examined." };
  const ans = await askJson([
    { text:
      `These ${imgs.length} photos were uploaded as ONE salvage vehicle, but the first scan reported conflicting body colors (${c.colors.join(" vs ")}). ` +
      `Re-read the EXTERIOR BODY PAINT color of the vehicle in each photo, carefully: ignore shadows, dirt, glare, primer patches, and interior/engine-bay photos (null those). ` +
      `Use simple color words (e.g. "gray", "dark gray", "silver", "gold", "white").\n\n` +
      `Reply ONLY with JSON: {"colors": [<one entry per photo, in order: string or null>], "sameVehicle": true | false | "unsure", "evidence": "<one short sentence>"}` },
    ...imgs.map((x) => x.img!),
  ]);
  const colors = Array.isArray(ans?.colors) ? (ans!.colors as unknown[]).map((v) => (typeof v === "string" ? v : "")) : null;
  const seen = typeof ans?.evidence === "string" ? (ans.evidence as string) : "";
  if (!colors) return { id: c.id, verdict: "escalate", evidence: "Couldn't re-read the photo colors — check the photos by hand." };
  const conflict = colorConflict(colors.filter(Boolean));
  if (!conflict) {
    const distinct = [...new Set(colors.filter(Boolean).map((s) => s.toLowerCase().trim()))];
    return {
      id: c.id,
      verdict: "resolved",
      evidence: `Re-read the body color in every photo: ${distinct.join(", ") || "consistent"} — same color family, the first read was off. ${seen}`.trim(),
    };
  }
  // Still conflicting — name the exact photos so the seller checks the right ones.
  const at = (label: string) => imgs.map((x, i) => ({ n: x.p.index + 1, c: (colors[i] || "").toLowerCase() })).filter((e) => e.c.includes(label.split(/\s+/).pop()!)).map((e) => `#${e.n}`);
  const where = [`${conflict[0]} in photo ${at(conflict[0]).join(", ") || "?"}`, `${conflict[1]} in photo ${at(conflict[1]).join(", ") || "?"}`].join("; ");
  const same = ans?.sameVehicle;
  return {
    id: c.id,
    verdict: same === true ? "confirmed" : "escalate",
    evidence: `The colors really do differ on re-read: ${where}. ${same === true ? "It does look like the same vehicle (lighting/panel variation)." : "Confirm every photo is the SAME vehicle before posting."} ${seen}`.trim(),
  };
}

export async function POST(req: Request) {
  // Auth: web session cookie OR Bearer token (same as /api/reprice).
  const supabase = await (await import("@/lib/supabase-server")).supabaseServer();
  let { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const auth = req.headers.get("authorization") || "";
    if (auth.startsWith("Bearer ")) {
      const { data } = await supabaseAdmin().auth.getUser(auth.slice(7));
      user = data.user;
    }
  }
  if (!user) return NextResponse.json({ ok: false, error: "no auth" }, { status: 401, headers: CORS });

  let body: { cases?: QaCase[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad body" }, { status: 400, headers: CORS }); }

  const cases = (Array.isArray(body.cases) ? body.cases : [])
    .filter((c): c is QaCase => !!c && typeof c.id === "string" && (c.kind === "side" || c.kind === "color"))
    .slice(0, MAX_CASES); // hard cap — over-budget cases simply aren't attempted
  if (!cases.length) return NextResponse.json({ ok: false, error: "no cases" }, { status: 400, headers: CORS });

  const resolutions = await Promise.all(
    cases.map((c) => (c.kind === "side" ? resolveSide(c) : resolveColor(c))),
  );

  return NextResponse.json({ ok: true, resolutions }, { headers: CORS });
}
