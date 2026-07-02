// QA RESOLVER AGENT — client half (A1, docs/agent-layer-blueprint.md).
//
// Builds the "cases" behind each warn-level scan-QA flag, ships the vision-checkable
// ones to /api/qa-resolve (≤ 1 flash call each, server-capped), and settles the
// deterministic one (Grade-A-inside-a-damage-zone) locally for free. Returns
// resolutions the review screen renders under the matching flags.
//
// Contract: nothing here mutates parts. Every fix is a proposal (`edit`) that
// AddVehicle applies only when the seller taps it.

import { sideOf, colorConflict } from "./scan-qa";
import { type ConditionGrade } from "./age-pricing";
import { gradeAdjustUsed } from "./used-pricing";

// The part shape this module needs (structural subset of AddVehicle's AIPart).
export type QaAgentPart = {
  _id?: string;
  partName: string;
  description?: string;
  condition: string;
  conditionNotes?: string;
  usedPartPriceUsd?: number | null;
  box?: [number, number, number, number];
  photoUrl?: string;
  photoFront?: string;
};

export type QaAgentEdit =
  | { field: "partName" | "description"; kind: "swap-side" }
  | { field: "condition"; kind: "downgrade-B" };

export type QaAgentResolution = {
  kind: "side" | "color" | "zone";
  partId?: string;
  partName?: string;
  verdict: "resolved" | "confirmed" | "escalate";
  evidence: string;
  edit?: QaAgentEdit;
};

// ── helpers ─────────────────────────────────────────────────────────────────

// Swap driver↔passenger (and left↔right) words in a name/description, preserving
// leading capitalization ("Driver Side Front Door" → "Passenger Side Front Door").
export function swapSideWords(text: string): string {
  const pairs: [RegExp, string][] = [
    [/\bdriver\b/gi, "passenger"],
    [/\bpassenger\b/gi, "driver"],
    [/\bleft\b/gi, "right"],
    [/\bright\b/gi, "left"],
  ];
  // Single pass with a combined regex so a→b→a double-swaps can't happen.
  return text.replace(/\b(driver|passenger|left|right)\b/gi, (w) => {
    const swap: Record<string, string> = { driver: "passenger", passenger: "driver", left: "right", right: "left" };
    const out = swap[w.toLowerCase()] ?? w;
    return w[0] === w[0].toUpperCase() ? out[0].toUpperCase() + out.slice(1) : out;
  });
}

// Apply an accepted edit to a part, returning the changed fields only. The return type
// is narrow (condition: "B", not string) so spreading it into AIPart doesn't widen it.
export function applyQaEdit(
  p: QaAgentPart,
  edit: QaAgentEdit,
): { partName?: string; description?: string; condition?: ConditionGrade; suggestedPriceUsd?: number | null } {
  if (edit.kind === "swap-side") {
    return edit.field === "partName"
      ? { partName: swapSideWords(p.partName) }
      : { description: swapSideWords(p.description ?? "") };
  }
  // downgrade-B: the safe direction — reprice at the used-market Grade-B base.
  const grade: ConditionGrade = "B";
  return { condition: grade, suggestedPriceUsd: gradeAdjustUsed(p.usedPartPriceUsd, grade) };
}

// Downscale any renderable image URL (object URL or data URL) to a JPEG data URL the
// vision model can take. Small on purpose: side/color checks don't need full res.
async function downscaleToDataUrl(url: string, maxDim = 640, quality = 0.8): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}

// ── the agent run ───────────────────────────────────────────────────────────

// Mirror runScanQa's warn conditions, but as structured cases instead of messages.
export function hasWarnCases(parts: QaAgentPart[], photoColors: string[]): boolean {
  const side = parts.some((p) => {
    const n = sideOf(p.partName);
    const d = sideOf(p.description ?? "");
    return n !== null && d !== null && n !== d;
  });
  const zone = parts.some((p) => p.condition === "A" && /impact zone/i.test(p.conditionNotes ?? ""));
  return side || zone || !!colorConflict(photoColors);
}

// Run the QA-resolver agent over the scan's warn flags. `photoUrls` is the full photo
// set in display order (used by the color case). Never throws; on any failure the
// affected cases just come back as "escalate" so the original flags still stand.
export async function runQaAgent(
  parts: QaAgentPart[],
  photoUrls: string[],
  photoColors: string[],
): Promise<QaAgentResolution[]> {
  const out: QaAgentResolution[] = [];

  // 1 · Grade-A-in-a-damage-zone — deterministic, no model call. The damage pass owns
  //     `condition`; an A grade inside a zone means the pipeline disagrees with itself,
  //     and the safe proposal is always the downgrade.
  for (const p of parts) {
    if (p.condition === "A" && /impact zone/i.test(p.conditionNotes ?? "")) {
      out.push({
        kind: "zone",
        partId: p._id,
        partName: p.partName,
        verdict: "confirmed",
        evidence: `${p.partName} sits inside a located impact zone but kept Grade A — the damage pass says it can't be "like new".`,
        edit: { field: "condition", kind: "downgrade-B" },
      });
    }
  }

  // 2 · Build the vision cases.
  type ServerCase = Record<string, unknown> & { id: string; kind: "side" | "color" };
  const cases: ServerCase[] = [];
  const byCaseId = new Map<string, { kind: "side" | "color"; partId?: string; partName?: string }>();

  const sideParts = parts.filter((p) => {
    const n = sideOf(p.partName);
    const d = sideOf(p.description ?? "");
    return n !== null && d !== null && n !== d;
  });
  for (const p of sideParts) {
    if (!p.photoUrl) continue;
    const image = await downscaleToDataUrl(p.photoUrl);
    if (!image) continue;
    const id = `side:${p._id ?? p.partName}`;
    byCaseId.set(id, { kind: "side", partId: p._id, partName: p.partName });
    cases.push({
      id,
      kind: "side",
      partName: p.partName,
      nameSide: sideOf(p.partName) === "L" ? "driver" : "passenger",
      descSide: sideOf(p.description ?? "") === "L" ? "driver" : "passenger",
      image,
      box: p.box,
      photoFront: p.photoFront,
    });
  }

  const conflict = colorConflict(photoColors);
  if (conflict && photoUrls.length >= 2) {
    const photos = (await Promise.all(
      photoUrls.map(async (url, index) => ({ index, image: await downscaleToDataUrl(url, 480) })),
    )).filter((p): p is { index: number; image: string } => !!p.image);
    if (photos.length >= 2) {
      const id = "color:0";
      byCaseId.set(id, { kind: "color" });
      cases.push({ id, kind: "color", colors: [conflict[0], conflict[1]], photos });
    }
  }

  if (!cases.length) return out;

  // 3 · One round-trip; the server runs ≤ 1 flash call per case.
  try {
    const res = await fetch("/api/qa-resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cases }),
    });
    const j = await res.json();
    if (j?.ok && Array.isArray(j.resolutions)) {
      for (const r of j.resolutions) {
        const meta = byCaseId.get(r?.id);
        if (!meta) continue;
        const verdict = ["resolved", "confirmed", "escalate"].includes(r.verdict) ? r.verdict : "escalate";
        const edit: QaAgentEdit | undefined =
          r.proposedEdit && (r.proposedEdit.field === "partName" || r.proposedEdit.field === "description")
            ? { field: r.proposedEdit.field, kind: "swap-side" }
            : undefined;
        out.push({
          kind: meta.kind,
          partId: meta.partId,
          partName: meta.partName,
          verdict,
          evidence: typeof r.evidence === "string" ? r.evidence : "",
          edit,
        });
      }
      return out;
    }
  } catch { /* fall through to escalations */ }

  // The round-trip failed — surface every attempted case as an escalation so the
  // seller still knows the agent tried and the original flags still stand.
  for (const [id, meta] of byCaseId) {
    void id;
    out.push({
      kind: meta.kind,
      partId: meta.partId,
      partName: meta.partName,
      verdict: "escalate",
      evidence: "The AI double-check couldn't run — verify this one by hand.",
    });
  }
  return out;
}
