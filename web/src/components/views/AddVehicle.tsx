"use client";

import React from "react";
import { ImageUp, Upload, ScanLine, Sparkles, Check, Info, CircleCheck, Car, Wrench, Plus, Minus, X, TriangleAlert, CheckCircle2, ArrowLeft, FileText, RotateCcw, Lock, Camera, ChevronUp, ChevronDown, Tag } from "lucide-react";
import { Card, PhotoCell, ConditionBadge } from "../UI";
import { SELL_MODE } from "../data";
import { csToast } from "../Dashboard";
import { looksLikeScannable, isPdf, normalizeImageFile, fileToJpegDataUrl, fileToAIDataUrl } from "@/lib/image";
import { playSonarPing } from "@/lib/sound";
import { ManualListing } from "./ManualListing";
import { useScanSession, setScanSession, getScanSession, resetScanSession, beginScanRun, isScanRun, type ScanSession } from "@/lib/scanSession";
import type { VinInfo } from "@/lib/vin";
import { applyVinEngine, reconcilePairPrices, dropGenericWhenSided, dropGenericWhenPositioned } from "@/lib/part-enrich";
import { instanceScore, type PhotoFront } from "@/lib/photo-select";
import { runScanQa } from "@/lib/scan-qa";
import { bandFor, bandFraction, priceAtFraction, roundYardPrice } from "@/lib/price-band";
import { runQaAgent, hasWarnCases, applyQaEdit, type QaAgentResolution } from "@/lib/qa-agent";
import { classifyPowertrain, ensurePowertrainParts } from "@/lib/powertrain";
import { redactImage, redactImageToDataUrl, type PiiBox } from "@/lib/redact";
import { groundDescriptions } from "@/lib/describe-ground";
import { propagateImpactDamage } from "@/lib/damage-zones";

interface UploadedPhoto { url: string; name: string; file: File; piiRegions?: PiiBox[] }

interface VehicleFit { make: string; model: string; yearStart: number; yearEnd: number; notes?: string }
interface AIPart {
  partName: string; partCategory: string; fitment: VehicleFit[];
  box?: [number, number, number, number]; // detection bbox [x0,y0,x1,y1] (0–1); largest wins the clearest-photo pick
  condition: "A" | "B" | "C"; conditionNotes: string; description: string; // ARA grade (was mistyped Good/Poor)
  usedPartPriceUsd?: number | null; // used-market Grade-B anchor from the scan; base for L/R parity + downgrades
  suggestedPriceUsd: number | null; confidence: "high" | "medium" | "low";
  // The model's used-market band (grade-adjusted server-side). Renders as the draggable
  // confidence band under the price field; when absent the band falls back to a
  // confidence-derived spread (lib/price-band).
  suggestedPriceLowUsd?: number | null; suggestedPriceHighUsd?: number | null;
  inferred?: boolean; // not directly seen → "Inferred — verify"; PRICED (hidden parts can be the most valuable)
  photoFront?: PhotoFront; // orientation of the photo this instance came from (best-shot pick)
  lowConfidenceFields?: string[];
  // Pricing provenance from the ladder (AHLAM-53): which rung set the price + how
  // trustworthy it is. Spread through from the identify response.
  pricingInsight?: { source?: "shop" | "grounded" | "ebay" | "asking" | "model" | "formula" | "market"; confidence?: "high" | "medium" | "low"; similarCount?: number; ebayMedian?: number; ebayRange?: { min: number; max: number }; pricedBy?: "claude-market" | "claude" | "gemini" | "vision"; sources?: string[] };
  // Restricted-resale flag from the scan (AHLAM-54), surfaced in the review summary.
  compliance?: { label: string; reason: string };
  photoUrl?: string; // the photo this part was scanned from — used as its thumbnail
  _id?: string;       // stable client id so edit/reorder/add survive list changes
  _aiPrice?: number | null; // the AI's original suggestion, kept for batch "% of suggested"
}

// More photos = more parts found and a truer price. We accept up to 15 (the AI
// cost is slightly higher, but accuracy matters more than a few cents per scan).
const MAX_PHOTOS = 15;
interface VehicleEstimate {
  vin: string | null; make: string | null; model: string | null; yearStart: number | null; yearEnd: number | null;
  bodyStyle: string | null; mileage: string | null; suggestedWholeCarPriceUsd: number | null; confidence: "high" | "medium" | "low";
  trim?: string | null; engine?: string | null; drivetrain?: string | null; vinInfo?: VinInfo | null; color?: string | null;
}
type AIResult = { ok: true; data: AIPart[]; vehicle?: VehicleEstimate | null; vehicleFront?: string; piiRegions?: PiiBox[] } | { ok: false; userMessage: string; internalError: string };

// Map a scan-QA flag message to the agent case kind that can settle it (A1).
function qaKindOf(message: string): "side" | "color" | "zone" | null {
  if (message.startsWith("Description names the opposite side")) return "side";
  if (message.startsWith("Photos disagree on body color")) return "color";
  if (message.startsWith("Grade A but in a damage zone")) return "zone";
  return null;
}

// Accent color used across the scan flow (spinner, report card). The scan engine
// is fixed and never surfaced to the seller.
const SCAN_TONE = "var(--signal)";

// Pick the single best whole-car price + label from per-photo AI estimates.
function aggregateVehicle(estimates: (VehicleEstimate | null | undefined)[]): { label: string; sub: string; suggestedPrice: number | null; mileage: string | null; make: string; model: string; year: string; body: string; vin: string | null; trim: string | null; engine: string | null; drivetrain: string | null; vinInfo: VinInfo | null; color: string | null } | null {
  const valid = estimates.filter((e): e is VehicleEstimate => !!e && !!e.make && !!e.model);
  if (!valid.length) return null;

  // A VIN read off any photo is GROUND TRUTH — it was decoded by NHTSA, so it wins
  // outright over the per-photo visual guesses (which otherwise average out to the
  // wrong year, e.g. 2024 instead of the VIN's 2025). Use the VIN estimate's exact
  // make/model/year/engine and ignore the visual dilution.
  const vinEst = valid.find((e) => e.vin && e.make && e.model);

  // Otherwise: most-named make+model wins, collapsed to a SINGLE median year (never
  // a range) so sellers see "2019 Honda Accord", not "2016–2025".
  const tally = new Map<string, { e: VehicleEstimate; n: number; years: number[] }>();
  for (const e of valid) {
    const key = `${e.make} ${e.model}`.toLowerCase();
    const yr = e.yearStart && e.yearEnd ? Math.round((e.yearStart + e.yearEnd) / 2) : (e.yearStart || e.yearEnd || 0);
    const cur = tally.get(key);
    if (cur) { cur.n++; if (yr) cur.years.push(yr); }
    else tally.set(key, { e, n: 1, years: yr ? [yr] : [] });
  }
  const top = [...tally.values()].sort((a, b) => b.n - a.n)[0];
  const ys = top.years.sort((a, b) => a - b);

  const src = vinEst || top.e;
  const make = src.make || "";
  const model = src.model || "";
  const year = vinEst?.yearStart ? String(vinEst.yearStart) : (ys.length ? String(ys[Math.floor(ys.length / 2)]) : "");
  const body = src.bodyStyle || top.e.bodyStyle || "";
  const trim = vinEst?.trim || null;
  const engine = vinEst?.engine || null;
  const drivetrain = vinEst?.drivetrain || null;
  const vinInfo = vinEst?.vinInfo || null;

  const prices = valid.map((e) => e.suggestedWholeCarPriceUsd).filter((p): p is number => typeof p === "number" && p > 0).sort((a, b) => a - b);
  const suggestedPrice = prices.length ? prices[Math.floor(prices.length / 2)] : null;
  const mileage = valid.map((e) => e.mileage).find((m): m is string => !!m) ?? null;
  const vin = vinEst?.vin || valid.map((e) => e.vin).find((v): v is string => !!v) || null;
  // One body color for the whole car — first non-empty across photos (best-lit panel).
  const color = valid.map((e) => e.color).find((c): c is string => !!c) || null;

  return {
    label: `${make} ${model}`,
    sub: [year, trim, body].filter(Boolean).join(" · "),
    suggestedPrice, mileage, make, model, year, body, vin, trim, engine, drivetrain, vinInfo, color,
  };
}

// Photo intake/encoding (incl. HEIC→JPEG) lives in @/lib/image.

// Roll the AI's per-part fitment up into a single most-likely source vehicle.
// Purely derived from what the model returned — never fabricated.
function deriveVehicle(parts: AIPart[]): { label: string; sub: string } | null {
  const tally = new Map<string, { make: string; model: string; lo: number; hi: number; n: number }>();
  for (const p of parts) {
    for (const f of p.fitment || []) {
      if (!f.make || !f.model) continue;
      const key = `${f.make} ${f.model}`.toLowerCase();
      const cur = tally.get(key);
      if (cur) { cur.n++; cur.lo = Math.min(cur.lo, f.yearStart || cur.lo); cur.hi = Math.max(cur.hi, f.yearEnd || cur.hi); }
      else tally.set(key, { make: f.make, model: f.model, lo: f.yearStart || 0, hi: f.yearEnd || 0, n: 1 });
    }
  }
  if (!tally.size) return null;
  const best = [...tally.values()].sort((a, b) => b.n - a.n)[0];
  const years = best.lo && best.hi ? (best.lo === best.hi ? `${best.lo}` : `${best.lo}–${best.hi}`) : "";
  return { label: `${best.make} ${best.model}`, sub: [years, `matched on ${best.n} part${best.n > 1 ? "s" : ""}`].filter(Boolean).join(" · ") };
}

// Group parts logically and keep Left/Right pairs adjacent so the review list is
// scannable (front → sides → rear → glass → lighting → wheels → mechanical → interior).
const AREA_ORDER: RegExp[] = [
  /hood|grille|front bumper/i,
  /\bfender\b/i,
  /door panel/i,
  /\bdoor\b|mirror|rocker/i,
  /quarter|rear bumper|trunk|tailgate|liftgate/i,
  /windshield|back glass|window|glass/i,
  /headlight|head light|tail ?light|fog|lamp|light/i,
  /wheel|rim|tire|tyre/i,
  /engine|transmission|radiator|alternator|starter|battery|compressor|abs|strut|shock|control arm|driveshaft|catalytic|fuel pump|pump/i,
  /seat|steering|airbag|console|dash|cluster|glove|visor|shifter/i,
];
function areaRank(name: string): number {
  for (let i = 0; i < AREA_ORDER.length; i++) if (AREA_ORDER[i].test(name)) return i;
  return AREA_ORDER.length;
}
function basePartName(name: string): string {
  return name.replace(/\b(left|right)\b/gi, "").replace(/\s+/g, " ").trim().toLowerCase();
}
function sideRank(name: string): number {
  return /\bleft\b/i.test(name) ? 0 : /\bright\b/i.test(name) ? 1 : 2;
}
function comparePartsForDisplay(a: AIPart, b: AIPart): number {
  const ar = areaRank(a.partName), br = areaRank(b.partName);
  if (ar !== br) return ar - br;
  const an = basePartName(a.partName), bn = basePartName(b.partName);
  if (an !== bn) return an < bn ? -1 : 1;
  return sideRank(a.partName) - sideRank(b.partName);
}

// High-value, high-margin parts that only appear with engine-bay/underbody
// photos. If a scan has none, the seller likely shot only the exterior and is
// leaving the most profitable parts uncaptured (AHLAM-55).
const HIGH_VALUE_CATEGORIES: { re: RegExp; label: string }[] = [
  { re: /\bengine\b/i, label: "engine" },
  { re: /\b(transmission|gearbox)\b/i, label: "transmission" },
  { re: /\balternator\b/i, label: "alternator" },
  { re: /\bstarter\b/i, label: "starter" },
  { re: /\b(a\/?c )?compressor\b/i, label: "A/C compressor" },
  { re: /\bcataly(tic|st)\b/i, label: "catalytic converter" },
];
function missingHighValueCategories(parts: AIPart[]): string[] {
  const hay = parts.map((p) => p.partName).join(" | ");
  return HIGH_VALUE_CATEGORIES.filter((c) => !c.re.test(hay)).map((c) => c.label);
}

// Condition multipliers — MUST match the server (lib/pricing.ts). A=+25% (like-new),
// B=market median, C=40% of median (damaged core).

// A door + its glass + its panel (+ handle) belong to one physical door. Group them
// so the seller sees the COMPLETE door total while each piece keeps its own price.
// Keyed by position+side (e.g. "front left") so front and rear doors stay separate.
function doorGroupKey(name: string): string | null {
  const n = name.toLowerCase();
  if (!/\bdoor\b/.test(n)) return null;
  const side = /\bleft\b/.test(n) ? "left" : /\bright\b/.test(n) ? "right" : "";
  if (!side) return null;                               // need a side to group safely
  const pos = /\bfront\b/.test(n) ? "front" : /\brear\b/.test(n) ? "rear" : "";
  return `${pos} ${side}`.trim();
}
function titleCaseWords(s: string): string { return s.replace(/\b\w/g, (c) => c.toUpperCase()); }

// One render row: either a complete-door group header, or a single part.
type RenderRow = { type: "header"; key: string; label: string; total: number } | { type: "part"; part: AIPart };
function buildRenderRows(parts: AIPart[]): RenderRow[] {
  const groups = new Map<string, AIPart[]>();
  for (const p of parts) { const k = doorGroupKey(p.partName); if (k) { const g = groups.get(k); if (g) g.push(p); else groups.set(k, [p]); } }
  const rows: RenderRow[] = [];
  const emitted = new Set<string>();
  for (const p of parts) {
    const k = doorGroupKey(p.partName);
    if (k && (groups.get(k)?.length ?? 0) >= 2) {
      if (!emitted.has(k)) {
        emitted.add(k);
        const members = groups.get(k)!;
        const total = members.reduce((s, m) => s + (m.suggestedPriceUsd || 0), 0);
        rows.push({ type: "header", key: k, label: `${titleCaseWords(k)} Door — complete`, total });
        for (const m of members) rows.push({ type: "part", part: m });
      }
    } else {
      rows.push({ type: "part", part: p });
    }
  }
  return rows;
}


// Flag left/right pairs of the same part priced very differently (>2.5×) — a
// likely AI pricing slip the seller should eyeball before posting (AHLAM-69).
function pairedPriceMismatches(parts: AIPart[]): { base: string }[] {
  const groups = new Map<string, number[]>();
  for (const p of parts) {
    const price = p.suggestedPriceUsd || 0;
    if (price <= 0 || !/\b(left|right)\b/i.test(p.partName)) continue;
    const base = basePartName(p.partName);
    groups.set(base, [...(groups.get(base) || []), price]);
  }
  const out: { base: string }[] = [];
  for (const [base, prices] of groups) {
    if (prices.length < 2) continue;
    const min = Math.min(...prices), max = Math.max(...prices);
    if (min > 0 && max / min > 2.5) out.push({ base: base.replace(/\b\w/g, (c) => c.toUpperCase()) });
  }
  return out;
}

export function AddVehicle({ go }: { go: (id: string) => void; onVehicle?: (v: any) => void }) {
  // Session state lives in a module store (lib/scanSession) so an in-progress scan
  // and its results survive switching sections and coming back. Each field below
  // reads from the store and writes through a useState-compatible setter, so all
  // the handler code stays unchanged.
  const s = useScanSession();
  function up<K extends keyof ScanSession>(key: K) {
    return (v: ScanSession[K] | ((prev: ScanSession[K]) => ScanSession[K])) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setScanSession({ [key]: typeof v === "function" ? (v as any)(getScanSession()[key]) : v } as Partial<ScanSession>);
  }
  type Dispatch<T> = (v: T | ((prev: T) => T)) => void;

  const phase = s.phase;                              const setPhase = up("phase") as Dispatch<string>;
  const parts = s.parts as AIPart[];                  const setParts = up("parts") as Dispatch<AIPart[]>;
  const vehicle = s.vehicle;                          const setVehicle = up("vehicle") as Dispatch<typeof s.vehicle>;
  const photoColors = s.photoColors;                  const setPhotoColors = up("photoColors") as Dispatch<string[]>;
  const mainPhoto = s.mainPhoto;                      const setMainPhoto = up("mainPhoto") as Dispatch<string | null>;
  const sellMode = s.sellMode;                        const setSellMode = up("sellMode") as Dispatch<string>;
  const mode = s.mode;                                const setMode = up("mode") as Dispatch<typeof s.mode>;
  const photos = s.photos as UploadedPhoto[];         const setPhotos = up("photos") as Dispatch<UploadedPhoto[]>;
  const carPrice = s.carPrice;                        const setCarPrice = up("carPrice") as Dispatch<string>;
  const suggestedCarPrice = s.suggestedCarPrice;      const setSuggestedCarPrice = up("suggestedCarPrice") as Dispatch<number | null>;
  const mileage = s.mileage;                          const setMileage = up("mileage") as Dispatch<string | null>;
  const vin = s.vin;                                  const setVin = up("vin") as Dispatch<string>;
  const vinStatus = s.vinStatus;                      const setVinStatus = up("vinStatus") as Dispatch<typeof s.vinStatus>;
  const vehicleTrim = s.vehicleTrim;                  const setVehicleTrim = up("vehicleTrim") as Dispatch<string>;
  const vehicleColor = s.vehicleColor;                const setVehicleColor = up("vehicleColor") as Dispatch<string>;
  const vehicleTitle = s.vehicleTitle;               const setVehicleTitle = up("vehicleTitle") as Dispatch<string>;
  const vehicleDesc = s.vehicleDesc;                  const setVehicleDesc = up("vehicleDesc") as Dispatch<string>;
  const error = s.error;                              const setError = up("error") as Dispatch<string | null>;
  const stockNumber = s.stockNumber;                  const setStockNumber = up("stockNumber") as Dispatch<string>;

  // Transient UI state — fine to lose on navigation.
  const [saving, setSaving] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [camOpen, setCamOpen] = React.useState(false);
  // Which stage of the analyzing card to narrate: vision catalog vs the blocking
  // Claude pricing pass that follows it (pricing runs before results render).
  const [scanStage, setScanStage] = React.useState<"scanning" | "pricing">("scanning");
  // Agent state (docs/agent-layer-blueprint.md) — transient advisory results; a new
  // scan resets it. A1 = QA resolver (settles warn flags).
  const [qaAgent, setQaAgent] = React.useState<{ running: boolean; resolutions: QaAgentResolution[] }>({ running: false, resolutions: [] });
  const fileRef = React.useRef<HTMLInputElement>(null);
  const partSeq = React.useRef(0);
  // After a remount (e.g. returning to a restored session), continue ids above the
  // highest existing one so new rows never collide with restored parts.
  if (partSeq.current === 0) partSeq.current = parts.reduce((m, p) => Math.max(m, Number(p._id) || 0), 0);
  const newId = () => String(++partSeq.current);

  const partsTotal = parts.reduce((s, p) => s + (p.suggestedPriceUsd || 0), 0);
  const sellable = parts.filter((p) => (p.suggestedPriceUsd || 0) > 0).length;
  const flagged = parts.filter((p) => p.confidence === "low");
  const goodCount = parts.filter((p) => p.condition === "A").length;
  // Pre-submit review checks (AHLAM-66): aggregate everything the seller should
  // eyeball before posting — restricted parts, missing high-value categories,
  // and wildly mismatched left/right prices.
  const restricted = parts.filter((p) => p.compliance);                       // AHLAM-54
  const missingHighValue = missingHighValueCategories(parts);                  // AHLAM-55
  const priceMismatches = pairedPriceMismatches(parts);                        // AHLAM-69
  // Stage-7 consistency guardrail. Drop "Restricted" (already surfaced above) so the QA
  // block only adds its NEW checks: side conflicts, Grade-A-in-a-damage-zone, inferred
  // parts, and the headline-vs-whole-car sanity check.
  const qaFlags = runScanQa(parts, suggestedCarPrice, photoColors).filter((f) => !f.message.startsWith("Restricted"));
  const photoCount = photos.length;

  // One box — drop everything in (HEIC, JPG, PNG, anything). The AI figures out
  // what each photo is; HEIC is converted to JPEG so it previews & uploads fine.
  async function addFiles(list: FileList | null) {
    if (!list) return;
    const imgs = Array.from(list).filter(looksLikeScannable);
    if (!imgs.length) { csToast("Those files weren't supported. Add JPG, PNG, HEIC, or PDF files"); return; }
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { csToast(`You can add up to ${MAX_PHOTOS} photos`); return; }
    const take = imgs.slice(0, room);
    if (take.length < imgs.length) csToast(`Added ${take.length}. ${MAX_PHOTOS}-photo limit reached`);
    const mapped = await Promise.all(take.map(async (f) => {
      const file = await normalizeImageFile(f); // HEIC → JPEG; others pass through
      return { url: URL.createObjectURL(file), name: f.name, file };
    }));
    setPhotos((prev) => [...prev, ...mapped].slice(0, MAX_PHOTOS));
  }
  const atPhotoLimit = photos.length >= MAX_PHOTOS;
  function removePhoto(i: number) {
    setPhotos((prev) => { const next = [...prev]; const [gone] = next.splice(i, 1); if (gone) URL.revokeObjectURL(gone.url); return next; });
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  // Send every photo to /api/identify; the AI defines what it can pull from each.
  // Writes go through the module store (setPhase/setParts/… are store-backed), so
  // the scan keeps running and lands its results even if the user navigates away
  // mid-scan. The run token lets a cancel (resetScanSession) discard a stale run.
  async function runAnalysis() {
    const myToken = beginScanRun();
    setPhase("analyzing"); setError(null); setScanStage("scanning");
    setQaAgent({ running: false, resolutions: [] });
    // VIN-FIRST: resolve the VIN BEFORE cataloging, so every photo is classified AND
    // priced for the exact vehicle on the first pass (no blind classification, no
    // after-the-fact reprice). A typed VIN wins; otherwise read it from the photos in
    // one cheap pass. If none is found, the catalog still reads it per-photo as a
    // backstop and the reprice fallback below covers pricing.
    const typedVin = (vin || "").trim().toUpperCase();
    let resolvedVin: string | null = /^[A-HJ-NPR-Z0-9]{17}$/.test(typedVin) ? typedVin : null;
    try {
      // Encode each photo once; reused by the VIN-read pass and the catalog pass.
      const dataUrls = await Promise.all(photos.map((p) => fileToAIDataUrl(p.file)));
      if (!isScanRun(myToken)) return;

      if (!resolvedVin) {
        try {
          const r = await fetch("/api/read-vin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: dataUrls }),
          });
          const j = await r.json();
          if (!isScanRun(myToken)) return;
          if (j?.ok && j.vin) { resolvedVin = j.vin as string; setVin(resolvedVin); setVinStatus("confirmed"); }
        } catch { /* VIN read failed — proceed; the catalog reads VINs per-photo too */ }
      }

      // All photos of this analyze run share one scanBatch id, so the whole car
      // counts as a single AI scan against the plan quota (not one per photo).
      const scanBatch =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const results = await Promise.all(
        dataUrls.map(async (dataUrl, i) => {
          const res = await fetch("/api/identify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: dataUrl,
              scanBatch,
              scanFirst: i === 0,
              ...(resolvedVin ? { vin: { vin: resolvedVin } } : {}),
            }),
          });
          return { result: (await res.json()) as AIResult, photo: photos[i] };
        })
      );

      if (!isScanRun(myToken)) return; // cancelled / superseded while scanning

      // PII (Stage 0): mask the license plate + windshield VIN before any image is shown
      // or saved. Redact the DISPLAY copies now; stash the regions on each photo so the
      // SAVE path redacts the uploaded originals too. (The VIN was already read internally.)
      const redactedDisplay = new Map<string, string>();
      await Promise.all(results.map(async ({ result: r, photo }) => {
        const regions = r.ok ? r.piiRegions : undefined;
        photo.piiRegions = regions && regions.length ? regions : undefined;
        if (regions && regions.length) {
          const red = await redactImage(photo.url, regions);
          if (red !== photo.url) redactedDisplay.set(photo.url, red);
        }
      }));
      if (!isScanRun(myToken)) return;
      setPhotos([...photos]); // persist photo.piiRegions into the store for the save path
      const display = (u: string) => redactedDisplay.get(u) ?? u;

      const collected: AIPart[] = [];
      const estimates: (VehicleEstimate | null | undefined)[] = [];
      let firstError: string | null = null;
      let frontPhoto: string | null = null;
      for (const { result: r, photo } of results) {
        if (r.ok) {
          // Tag every part with the (redacted) photo it was scanned from (its thumbnail).
          collected.push(...r.data.map((p) => ({ ...p, photoUrl: display(photo.url), photoFront: r.vehicleFront as PhotoFront })));
          estimates.push(r.vehicle);
          // Main post pic = the photo the AI says shows the front ("toward-camera").
          if (r.vehicleFront === "toward-camera" && !frontPhoto) frontPhoto = display(photo.url);
        } else if (!firstError) firstError = r.userMessage;
      }

      // The VIN decode is ground truth for the vehicle, so resolve the aggregate
      // identity NOW — the VIN may have been legible in a different photo than the
      // engine bay — and push the VIN-confirmed engine down onto the engine PART
      // BEFORE dedupe. That way a bare "Engine" from a VIN-less engine shot and an
      // already-enriched "Engine — …" collapse into one entry.
      const agg = aggregateVehicle(estimates);
      // Stash the distinct body color each photo reported, so QA can flag a gray-vs-gold
      // mismatch (a misread — or photos of different vehicles).
      const distinctColors = [...new Set(estimates.map((e) => e?.color).filter((c): c is string => !!c).map((c) => c.trim()))];
      setPhotoColors(distinctColors);
      const enrichedCollected = agg?.engine
        ? collected.map((p) => applyVinEngine(p, agg.engine, agg.drivetrain))
        : collected;

      // Dedupe parts seen across multiple photos by name. Prefer the instance the AI
      // was most confident about, keeping the instance from the photo that shows the part
      // BEST (lib/photo-select: a front part from the front shot beats one glimpsed in a
      // side-profile), with confidence and price as tiebreakers. Keeps each part's thumbnail
      // and condition read from its clearest photo.
      // Prominence-first: the detection with the LARGEST bounding box is the photo that
      // shows the part biggest/clearest (Phase B). Orientation-fit (instanceScore) and a
      // price nudge break ties, and everything still works if a box is missing (area 0).
      const boxArea = (p: AIPart) => { const b = p.box; return b && b.length === 4 ? Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]) : 0; };
      const score = (p: AIPart) => boxArea(p) * 1000 + instanceScore(p) + (p.suggestedPriceUsd ? 0.5 : 0);
      const byName = new Map<string, AIPart>();
      for (const p of enrichedCollected) {
        const key = p.partName.toLowerCase().trim();
        const existing = byName.get(key);
        if (!existing || score(p) > score(existing)) {
          byName.set(key, p);
        }
      }
      // Enforce left/right price parity (one shared new price → each side's own grade)
      // before snapshotting _aiPrice, so paired parts of the same grade match.
      // Merge a generic part with its sided sibling (e.g. "Front Seat" + "Driver Side
      // Front Seat") across photos, enforce L/R price parity, then sort — keeping
      // inferred (not-directly-seen) parts grouped at the very bottom, separate from
      // observed detections.
      // CROSS-PHOTO damage propagation: the server runs damage per-photo, so a crushed
      // front door in one shot never reached the rear door detected in another. Re-run the
      // adjacency pass here on the fully merged list so a Grade-C panel drags its same-side
      // neighbors (rear door, glass, mirror, rocker) off Grade A + unprices them.
      // Then ground descriptions (Stage 5): lock the one body color + hedge barely-seen parts.
      const deduped = groundDescriptions(
        propagateImpactDamage(
          reconcilePairPrices(dropGenericWhenPositioned(dropGenericWhenSided([...byName.values()])).sort(comparePartsForDisplay)),
        ).sort((a, b) => (a.inferred ? 1 : 0) - (b.inferred ? 1 : 0)),
        { bodyColor: agg?.color },
      ).map((p) => ({ ...p, _id: newId(), _aiPrice: p.suggestedPriceUsd ?? null }));

      // Front shot for the main post image; fall back to the first uploaded photo.
      setMainPhoto(frontPhoto || (photos[0] ? display(photos[0].url) : null));

      if (!deduped.length) {
        setError(firstError || "No sellable parts were detected in these photos. Try clearer, closer shots.");
        setPhase("error");
        return;
      }

      // POWERTRAIN REALITY (lib/powertrain): classify gas/hybrid/BEV, drop parts that
      // can't exist for it, and APPEND the expected high-value powertrain parts the
      // photos never showed (a BEV's battery pack + drive units, a sedan's engine) —
      // flagged "inferred — verify" and priced by the reprice pass below, never
      // silently absent. Only runs with some vehicle identity to hang them on.
      const powertrain = classifyPowertrain(agg?.vinInfo ?? { make: agg?.make, model: agg?.model, trim: agg?.trim });
      const awd = /\b(awd|4wd|4x4|all.?wheel)\b/i.test(`${agg?.vinInfo?.driveType ?? ""} ${agg?.drivetrain ?? ""}`);
      const finalParts = agg
        ? ensurePowertrainParts(deduped, powertrain.type, (e) => ({
            partName: e.partName, partCategory: e.partCategory, fitment: [] as VehicleFit[],
            condition: "B" as const,
            conditionNotes: "Inferred from the vehicle's powertrain type — not visible in the photos; verify it is present and intact before listing.",
            description: e.description, suggestedPriceUsd: null, confidence: "low" as const,
            inferred: true, _id: newId(), _aiPrice: null,
          }), { awd }).parts
        : deduped;

      // Prefer the AI's explicit vehicle estimate (incl. whole-car price + mileage);
      // fall back to fitment-derived identity if the model didn't return one. (agg was
      // resolved above so the engine part could be enriched before dedupe.)
      if (agg) {
        setVehicle({ label: agg.label, sub: agg.sub || "identified by AI", make: agg.make, model: agg.model, year: agg.year, body: agg.body, trim: agg.trim, engine: agg.engine, drivetrain: agg.drivetrain, vinInfo: agg.vinInfo });
        setSuggestedCarPrice(agg.suggestedPrice);
        setCarPrice(agg.suggestedPrice ? String(agg.suggestedPrice) : "");
        setMileage(agg.mileage);
        if (agg.trim) setVehicleTrim(agg.trim); // prefill trim from the VIN
        if (agg.vin) { setVin(agg.vin); setVinStatus("confirmed"); } // VIN read + decoded server-side
      } else {
        setVehicle(deriveVehicle(finalParts));
        setSuggestedCarPrice(null);
        setCarPrice("");
        setMileage(null);
      }
      // ── BLOCKING PRICE PASS — Claude prices every scan (falls back to Gemini
      // server-side). The first prices the seller sees come from here; the vision
      // prices already on finalParts render only if this fails or times out. Also
      // the pass that gives code-generated inferred powertrain parts their first
      // price, so they land priced at first render — never blank.
      setScanStage("pricing");
      const priced = agg
        ? await repriceForVin(
            myToken,
            resolvedVin || agg.vin || null,
            finalParts,
            { year: agg.year, make: agg.make, model: agg.model, trim: agg.trim, engine: agg.engine },
          )
        : null;
      if (!isScanRun(myToken)) return; // cancelled / superseded while pricing
      const shownParts = priced ?? finalParts;
      setParts(shownParts);
      setPhase("results");
      playSonarPing(); // sonar ring: the scan is done, results are ready

      // ── AGENTS (docs/agent-layer-blueprint.md) — advisory, off the scan path ──
      // A1 QA Resolver: if the QA guardrail raised warn flags, spend a few focused
      // calls settling them with evidence. Proposals only — seller applies each fix.
      if (hasWarnCases(shownParts, distinctColors)) {
        setQaAgent({ running: true, resolutions: [] });
        void runQaAgent(shownParts, photos.map((p) => display(p.url)), distinctColors)
          .then((resolutions) => { if (isScanRun(myToken)) setQaAgent({ running: false, resolutions }); });
      }

    } catch (e) {
      if (!isScanRun(myToken)) return; // cancelled / superseded
      setError("We couldn't reach the analysis server. Check your connection and try again.");
      setPhase("error");
    }
  }

  // The blocking pricing call (/api/reprice): Claude estimates each part's USED-market
  // price for the exact vehicle (decoded VIN preferred, passed identity otherwise); the
  // server applies the same class curve + grade factor as the scan and reports which
  // engine priced the list (pricedBy). Returns the merged part list for the caller to
  // render — it runs BEFORE results are shown. Returns null on any failure/timeout so
  // the caller falls back to the vision-derived prices already on the parts.
  async function repriceForVin(
    token: number,
    vin: string | null,
    current: AIPart[],
    vehicleId?: { year?: string; make?: string; model?: string; trim?: string | null; engine?: string | null },
  ): Promise<AIPart[] | null> {
    try {
      const res = await fetch("/api/reprice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Client-side cap: comps-first pricing is parallel retrieval + one fast
        // judgment call (~10–30s); only zero-comp stragglers hit the slower
        // grounded fallback. Past 150s the vision prices render instead.
        signal: AbortSignal.timeout(150_000),
        body: JSON.stringify({ vin: vin || undefined, vehicle: vehicleId, parts: current.map((p) => ({ name: p.partName, grade: p.condition, inferred: p.inferred || undefined })) }),
      });
      const j = await res.json();
      if (!isScanRun(token)) return null; // a newer scan superseded this one
      if (!j?.ok || !Array.isArray(j.parts)) return null;
      const pricedBy: "claude-market" | "claude" | "gemini" | undefined =
        j.pricedBy === "claude-market" || j.pricedBy === "claude" || j.pricedBy === "gemini" ? j.pricedBy : undefined;
      const byName = new Map<string, { suggestedPriceUsd: number | null; usedPartPriceUsd: number | null; suggestedPriceLowUsd?: number | null; suggestedPriceHighUsd?: number | null; confidence?: "high" | "medium" | "low"; compCount?: number; sources?: string[] }>();
      for (const r of j.parts) if (r && typeof r.name === "string") byName.set(r.name.toLowerCase().trim(), r);
      return reconcilePairPrices(current.map((p) => {
        const r = byName.get(p.partName.toLowerCase().trim());
        if (!r || typeof r.usedPartPriceUsd !== "number" || r.usedPartPriceUsd <= 0) return p;
        // Market-priced parts carry evidence: source "market", the researched
        // confidence, real comp count, and the domains the comps came from.
        const market = !!r.confidence;
        return {
          ...p, usedPartPriceUsd: r.usedPartPriceUsd, suggestedPriceUsd: r.suggestedPriceUsd, _aiPrice: r.suggestedPriceUsd ?? p._aiPrice,
          suggestedPriceLowUsd: r.suggestedPriceLowUsd ?? p.suggestedPriceLowUsd, suggestedPriceHighUsd: r.suggestedPriceHighUsd ?? p.suggestedPriceHighUsd,
          pricingInsight: market
            ? { source: "market" as const, confidence: r.confidence, similarCount: r.compCount ?? 0, pricedBy, sources: r.sources ?? [] }
            : { ...p.pricingInsight, source: p.pricingInsight?.source ?? "model", confidence: p.pricingInsight?.confidence ?? p.confidence, pricedBy },
        };
      }));
    } catch {
      return null; // network/parse error or timeout — vision prices render
    }
  }

  // One QA flag row for the report card: short headline (count instead of the part
  // list), full message in the disclosure, and the A1 agent's verdicts grouped +
  // deduped — near-identical "Photo check" paragraphs collapse into one line whose
  // button fixes every affected part.
  function renderQaRow(f: { level: "warn" | "info"; message: string }, i: number) {
    const kind = qaKindOf(f.message);
    const rs = kind ? qaAgent.resolutions.filter((r) => r.kind === kind) : [];
    const allClear = rs.length > 0 && rs.every((r) => r.verdict === "resolved");
    if (allClear) {
      return (
        <ReportRow key={`qa${i}`} tone="ok" icon={<CircleCheck size={14} color="var(--success)" />}
          text={kind === "color" ? "Body color re-checked — it's the same vehicle in every photo" : "Re-checked by the AI agent — no issue found"}
          detail={[...new Set(rs.map((r) => r.evidence))].join(" ")} />
      );
    }
    // Headline: first clause + a part count instead of the comma list.
    const base = f.message.split(" — ")[0];
    const tail = /:\s(.+?)\.?$/.exec(f.message)?.[1];
    const listCount = tail ? tail.split(",").length : 0;
    const headline = listCount > 0 ? `${base} — ${listCount} part${listCount > 1 ? "s" : ""}` : base;
    // Group fixable verdicts by the field they fix; dedupe escalations by evidence.
    const fixable = rs.filter((r) => r.edit && r.partId);
    const byField = new Map<string, QaAgentResolution[]>();
    for (const r of fixable) byField.set(r.edit!.field, [...(byField.get(r.edit!.field) || []), r]);
    const escalations = [...new Map(rs.filter((r) => !r.edit || !r.partId).map((r) => [r.evidence, r])).values()];
    const detailText = [f.message, ...new Set(fixable.map((r) => r.evidence).filter(Boolean))].join("\n");
    return (
      <ReportRow key={`qa${i}`} tone={f.level === "warn" ? "warn" : "info"}
        icon={f.level === "warn" ? <TriangleAlert size={14} color="var(--signal)" /> : <Info size={14} color="var(--muted)" />}
        text={headline}
        detail={<span style={{ whiteSpace: "pre-line" }}>{detailText}</span>}>
        {kind && qaAgent.running && rs.length === 0 && (
          <div style={{ marginLeft: 23, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent)" }}>
            <Sparkles size={12} /> AI agent is double-checking this…
          </div>
        )}
        {[...byField.entries()].map(([field, group]) => (
          <div key={field} style={{ marginLeft: 23, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
            <Sparkles size={12} color="var(--accent)" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 160, overflowWrap: "anywhere" }}>
              Photo check: fix the {field === "condition" ? "grade" : field === "partName" ? "part name" : "description"} on{" "}
              {group.length === 1 ? <strong>{group[0].partName}</strong> : <strong>{group.length} parts</strong>}
            </span>
            <button onClick={() => group.forEach(applyQaResolution)} style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid var(--line)", background: "var(--accent-tint)", color: "var(--accent)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              {field === "condition" ? "Set Grade B" : group.length > 1 ? `Fix all ${group.length}` : "Fix"}
            </button>
          </div>
        ))}
        {escalations.map((r, k) => (
          <div key={`e${k}`} style={{ marginLeft: 23, display: "flex", gap: 8, fontSize: 12, color: "var(--muted)" }}>
            <Sparkles size={12} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ overflowWrap: "anywhere" }}>{r.evidence}</span>
          </div>
        ))}
      </ReportRow>
    );
  }

  // Apply an agent-proposed QA fix (A1) — seller-accepted, never automatic.
  function applyQaResolution(r: QaAgentResolution) {
    if (!r.edit || !r.partId) return;
    setParts((prev) => prev.map((p) => (p._id === r.partId ? { ...p, ...applyQaEdit(p, r.edit!) } : p)));
    csToast(r.edit.field === "condition" ? "Downgraded to Grade B and repriced" : r.edit.field === "partName" ? "Part name corrected" : "Description corrected");
  }

  // Relative nudge: ±pct% of the CURRENT price, so sellers adjust without retyping.
  function nudgePart(p: AIPart, pct: number) {
    const cur = p.suggestedPriceUsd || 0;
    if (!cur) return;
    setPartPrice(p._id!, String(Math.max(1, Math.round(cur * (1 + pct / 100)))));
  }

  function removePart(id: string) { setParts((prev) => prev.filter((p) => p._id !== id)); }
  // Let the seller adjust any part's price/name before saving.
  function setPartPrice(id: string, val: string) {
    const n = val === "" ? null : Math.max(0, Number(val) || 0);
    setParts((prev) => prev.map((p) => (p._id === id ? { ...p, suggestedPriceUsd: n } : p)));
  }
  function setPartName(id: string, val: string) {
    setParts((prev) => prev.map((p) => (p._id === id ? { ...p, partName: val } : p)));
  }
  function setPartDesc(id: string, val: string) {
    setParts((prev) => prev.map((p) => (p._id === id ? { ...p, description: val } : p)));
  }
  // Add a blank, fully-editable part row (e.g. something the AI missed).
  function addBlankPart() {
    setParts((prev) => [...prev, { partName: "", partCategory: "", fitment: [], condition: "B", conditionNotes: "", description: "", suggestedPriceUsd: null, confidence: "high", _id: newId(), _aiPrice: null }]);
  }
  // Move a part up/down so sellers control the order buyers see.
  function movePart(id: string, dir: -1 | 1) {
    setParts((prev) => {
      const i = prev.findIndex((p) => p._id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  // Batch-set every priced part to a % of the AI's original suggestion.
  function setAllPctOfSuggested(pct: number) {
    setParts((prev) => prev.map((p) => {
      const base = p._aiPrice;
      if (!base || base <= 0) return p;
      return { ...p, suggestedPriceUsd: Math.max(0, Math.round((base * pct) / 100)) };
    }));
    csToast(pct === 100 ? "Reset all to AI-suggested prices" : `Set all parts to ${pct}% of suggested`);
  }
  const anyAiPriced = parts.some((p) => (p._aiPrice || 0) > 0);

  const [savingKind, setSavingKind] = React.useState<"post" | "draft" | null>(null);
  // Persist the reviewed vehicle + parts, then reload data and jump to the list.
  // draft=true keeps everything private (status 'draft'), nothing posted to the market.
  async function save(draft = false) {
    setSaving(true);
    setSavingKind(draft ? "draft" : "post");
    try {
      // Encode every uploaded PHOTO to a JPEG data URL so the server can persist
      // them — this is what makes each post carry a real picture. PDFs are scanned
      // for identification but are never stored as listing images.
      const imagePhotos = photos.filter((p) => !isPdf(p.file));
      // Upload REDACTED images for any photo with PII (plate/VIN) so the saved, customer-
      // facing listing never carries them; fall back to the normal encode otherwise.
      const images = await Promise.all(imagePhotos.map(async (p) =>
        p.piiRegions && p.piiRegions.length
          ? (await redactImageToDataUrl(p.url, p.piiRegions)) ?? (await fileToJpegDataUrl(p.file))
          : fileToJpegDataUrl(p.file),
      ));
      const idxOf = new Map(imagePhotos.map((p, i) => [p.url, i]));
      const heroIndex = mainPhoto && idxOf.has(mainPhoto) ? idxOf.get(mainPhoto)! : 0;

      const payload = {
        sellMode,
        carPrice,
        mileage,
        draft,
        images,
        heroIndex,
        vehicle: { make: vehicle?.make, model: vehicle?.model, year: vehicle?.year, body: vehicle?.body, trim: vehicleTrim.trim() || undefined, color: vehicleColor.trim() || undefined, vin: vin.trim() || undefined, stockNumber: stockNumber.trim() || undefined, title: vehicleTitle.trim() || undefined, description: vehicleDesc.trim() || undefined, photos: photos.length },
        // Strip client-only fields (blob URL + local ids); keep a photoIndex so
        // each part links to the photo it was scanned from.
        parts: parts
          .filter((p) => p.partName.trim())
          .map(({ photoUrl, _id, _aiPrice, ...rest }) => ({ ...rest, photoIndex: photoUrl && idxOf.has(photoUrl) ? idxOf.get(photoUrl)! : heroIndex })),
      };
      const res = await fetch("/api/listings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json();
      if (!res.ok) { csToast(d.error || "Couldn't save. Try again"); setSaving(false); setSavingKind(null); return; }
      const dest = sellMode === "whole" ? "vehicles" : "parts";
      csToast(draft
        ? "Saved as draft, not posted yet"
        : sellMode === "whole" ? "Vehicle saved and posted to the market" : `Saved. ${d.listings} part${d.listings === 1 ? "" : "s"} posted`);
      (window as any).csReloadData?.();
      resetScanSession(); // posted/saved — clear the session so it doesn't linger
      go(dest);
    } catch {
      csToast("Couldn't save. Check your connection");
      setSaving(false);
      setSavingKind(null);
    }
  }

  // Decode the VIN and make it AUTHORITATIVE for the vehicle's identity. The photo
  // model can guess the wrong model; the VIN can't. When a full 17-char VIN is
  // present (read from a photo or typed), decode it via NHTSA and overwrite the
  // make/model/year with the confirmed values.
  async function confirmVinModel() {
    const raw = vin.replace(/[\s-]/g, "").toUpperCase();
    if (!raw) { setVinStatus("idle"); return; }
    if (raw.length !== 17 || /[IOQ]/.test(raw)) { setVinStatus("bad"); return; }
    setVinStatus("checking");
    try {
      const res = await fetch(`/api/vin-decode?vin=${encodeURIComponent(raw)}`);
      const d = await res.json();
      const dec = d?.decode;
      if (res.ok && dec && (dec.make || dec.model)) {
        const label = [dec.year, dec.make, dec.model].filter(Boolean).join(" ");
        const trim = dec.trim || null; // series is a platform code, not the trim
        const dispL = dec.displacementL || (dec.displacement ? (Number(dec.displacement) / 1000).toFixed(1) : null);
        const engine = [dispL ? `${dispL}L` : null, dec.engineCylinders ? `${dec.engineCylinders}-cyl` : null, dec.engine].filter(Boolean).join(" ") || null;
        const drivetrain = dec.driveType || null;
        setVehicle((v) => ({
          label: label || v?.label || "Vehicle",
          sub: [dec.year, trim, dec.bodyClass || v?.body].filter(Boolean).join(" · ") || v?.sub || "Confirmed by VIN",
          make: dec.make || v?.make,
          model: dec.model || v?.model,
          year: dec.year ? String(dec.year) : v?.year,
          body: dec.bodyClass || v?.body,
          trim, engine, drivetrain,
          vinInfo: (() => { const { raw, ...info } = dec; return info; })(),
        }));
        if (trim && !vehicleTrim) setVehicleTrim(trim);
        setVinStatus("confirmed");
        csToast(`Model confirmed from VIN: ${label}`);
      } else {
        setVinStatus("bad");
        csToast("Couldn't decode that VIN — double-check the 17 characters");
      }
    } catch {
      setVinStatus("bad");
    }
  }

  const showParts = sellMode === "parts" || sellMode === "both";
  const showCar = sellMode === "whole" || sellMode === "both";
  const carPriceNum = Number(carPrice) || 0;

  if (mode === "manualCar") return <ManualListing kind="car" onBack={() => setMode(null)} go={go} />;
  if (mode === "manualPart") return <ManualListing kind="part" onBack={() => setMode(null)} go={go} />;
  if (!mode) return <ModePicker onPick={setMode} />;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gap: 20 }}>
      <button onClick={() => resetScanSession()} style={{ ...navBtn, justifySelf: "start" }}><ArrowLeft size={15} /> Back to options</button>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Step n={1} label="Photos" on={phase === "upload"} done={phase !== "upload"} />
        <span style={{ flex: 1, height: 2, background: "var(--line)", borderRadius: 2, maxWidth: 80 }} />
        <Step n={2} label="AI analysis" on={phase === "analyzing" || phase === "error"} done={phase === "results"} />
        <span style={{ flex: 1, height: 2, background: "var(--line)", borderRadius: 2, maxWidth: 80 }} />
        <Step n={3} label="Review & save" on={phase === "results"} />
      </div>

      {phase === "upload" && (
        <Card pad={22} style={{ display: "grid", gap: 18 }}>
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif,application/pdf,.pdf" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

          {/* VIN reminder — the single highest-leverage shot for fitment + pricing */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 11, background: "var(--accent-tint)", border: "1px solid color-mix(in srgb, var(--accent) 26%, transparent)", fontSize: 13, lineHeight: 1.5 }}>
            <ScanLine size={17} color="var(--accent)" style={{ flexShrink: 0 }} />
            <span><strong style={{ color: "var(--foreground)" }}>Don&apos;t forget the VIN.</strong> Take a clear picture of the VIN plate on the front windshield (driver&apos;s-side base). It locks in exact fitment and noticeably better pricing.</span>
          </div>

          {/* Optional up-front VIN — when provided, the FIRST scan already prices each
              part for the exact trim/engine (no scan → confirm → re-run round trip). */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.02em" }}>
              VIN <span style={{ fontWeight: 500, textTransform: "none" }}>· optional — type it now for exact-trim pricing on the first scan, or skip and we&apos;ll read it from your photos</span>
            </label>
            <input
              value={vin}
              onChange={(e) => { setVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17)); setVinStatus("idle"); }}
              placeholder="17-character VIN (optional)"
              maxLength={17}
              style={{ border: "1px solid var(--line)", outline: "none", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13.5, padding: "10px 13px", borderRadius: 10, letterSpacing: "0.04em", fontFamily: "var(--font-sans)" }}
            />
            {vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin) && (
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{vin.length}/17 characters</span>
            )}
          </div>

          {/* One box — drop every photo in; the AI defines what each one is */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDrop={onDrop}
            style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "34px 20px", border: `1.5px dashed ${dragging ? "var(--accent)" : "var(--line)"}`, borderRadius: "var(--radius-md)", background: dragging ? "var(--accent-soft)" : "var(--surface2)", transition: "border-color 0.15s, background 0.15s" }}
          >
            <div style={{ width: 50, height: 50, borderRadius: 14, background: "var(--accent-tint)", display: "grid", placeItems: "center" }}>
              <ImageUp size={24} color="var(--accent)" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{dragging ? "Drop your photos here" : "Drag & drop all your photos, or click to upload"}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 480, textAlign: "center", lineHeight: 1.55 }}>Add up to {MAX_PHOTOS} photos. <strong style={{ color: "var(--foreground)" }}>More angles = more parts found and a truer market price.</strong> The AI reads each photo and pulls the vehicle, parts, and mileage.</div>
            <ul style={{ margin: "2px 0 0", padding: 0, listStyle: "none", maxWidth: 480, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, display: "grid", gap: 3 }}>
              <li>📸 Clear, well-lit, slightly <strong style={{ color: "var(--foreground)" }}>angled</strong> shots of <strong style={{ color: "var(--foreground)" }}>every side</strong>: front, rear, both sides, engine bay, interior, dashboard.</li>
              <li>⚠️ Only photographing one side? The AI prices just that side, so show the <strong style={{ color: "var(--foreground)" }}>whole car</strong> for full value.</li>
              <li>🔢 Include the <strong style={{ color: "var(--foreground)" }}>VIN plate</strong> if you can. It locks in exact fitment and better prices.</li>
            </ul>
            <div style={{ display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="cs-raise" disabled={atPhotoLimit} onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, opacity: atPhotoLimit ? 0.5 : 1, cursor: atPhotoLimit ? "not-allowed" : "pointer" }}><Upload size={16} /> Upload photos</button>
              <button className="cs-raise" disabled={atPhotoLimit} onClick={(e) => { e.stopPropagation(); setCamOpen(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 14, fontWeight: 600, opacity: atPhotoLimit ? 0.5 : 1, cursor: atPhotoLimit ? "not-allowed" : "pointer" }}><Camera size={16} /> Take photo</button>
            </div>
          </div>

          {/* Thumbnails of everything dropped in */}
          {photos.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10 }}>
              {photos.map((f, i) => (
                <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: "1px solid var(--line)" }}>
                  {isPdf(f.file) ? (
                    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", gap: 4, background: "var(--surface2)", padding: 6, textAlign: "center" }}>
                      <FileText size={22} color="var(--accent)" />
                      <span style={{ fontSize: 9.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{f.name}</span>
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={f.url} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                  <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(7,11,22,0.7)", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={13} color="#fff" /></button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
            <Info size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>Add clear photos of the car and the parts you want to sell. Cover each angle, open the hood for engine-bay parts, and include the dashboard if you want the mileage read. More angles mean a more accurate listing.</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: 12.5, color: atPhotoLimit ? "var(--signal)" : "var(--muted)" }}><Info size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />{photoCount} / {MAX_PHOTOS} photo{photoCount === 1 ? "" : "s"} added{atPhotoLimit ? " · limit reached" : ""}</span>
            <button className="cs-raise" disabled={photoCount === 0} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, opacity: photoCount === 0 ? 0.5 : 1, cursor: photoCount === 0 ? "not-allowed" : "pointer" }} onClick={runAnalysis}><Sparkles size={16} /> Run AI analysis</button>
          </div>
        </Card>
      )}

      {phase === "analyzing" && (
        <Card pad={44} style={{ display: "grid", placeItems: "center", gap: 18, textAlign: "center" }}>
          <div style={{ position: "relative", width: 72, height: 72 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: "3px solid var(--surface2)", borderTopColor: SCAN_TONE, animation: "spin 0.9s linear infinite" }} />
            <div style={{ position: "absolute", inset: 8, borderRadius: 999, border: "2px solid var(--surface2)", borderBottomColor: "var(--accent)", animation: "spin 1.4s linear infinite reverse" }} />
            <ScanLine size={26} color={SCAN_TONE} style={{ position: "absolute", inset: 0, margin: "auto" }} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{scanStage === "pricing" ? "Checking live market prices…" : "Scanning your car…"}</div>
            <div style={{ fontSize: 13.5, color: "var(--muted)", maxWidth: 420, marginTop: 6, lineHeight: 1.5 }}>
              {scanStage === "pricing"
                ? "Parts identified. Now researching what each one actually lists for on the used-parts market — real comps, not guesses."
                : "Reading your photos to identify the vehicle and every sellable part, including the VIN or stock number if they show in a picture."}
            </div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "var(--signal)", background: "var(--signal-bg)", border: "1px solid color-mix(in srgb, var(--signal) 35%, transparent)", borderRadius: 999, padding: "7px 14px" }}>
            <Info size={14} /> {scanStage === "pricing" ? "Checking real listings — usually under a minute. Hang tight." : "This usually takes under a minute. Hang tight."}
          </div>
        </Card>
      )}

      {phase === "error" && (
        <Card pad={36} style={{ display: "grid", placeItems: "center", gap: 16, textAlign: "center" }}>
          <span style={{ width: 52, height: 52, borderRadius: 14, display: "grid", placeItems: "center", background: "color-mix(in srgb, var(--danger) 16%, transparent)" }}><TriangleAlert size={24} color="var(--danger)" /></span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Analysis didn't finish</div>
            <div style={{ fontSize: 13.5, color: "var(--muted)", maxWidth: 440, marginTop: 6, lineHeight: 1.5 }}>{error}</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setPhase("upload")} style={navBtn}><ArrowLeft size={15} /> Edit photos</button>
            <button className="cs-raise" onClick={runAnalysis} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600 }}><RotateCcw size={15} /> Try again</button>
          </div>
        </Card>
      )}

      {phase === "results" && (
        <>
          {/* AI analysis report — built entirely from the model's actual output */}
          <Card pad={18} style={{ display: "grid", gap: 14, borderColor: `color-mix(in srgb, ${SCAN_TONE} 35%, var(--line))` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${SCAN_TONE} 16%, transparent)` }}><FileText size={17} color={SCAN_TONE} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>AI analysis report</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Analyzed from {photoCount} photo{photoCount === 1 ? "" : "s"}</div>
              </div>
              <button onClick={() => setPhase("upload")} style={{ ...navBtn, padding: "7px 12px", fontSize: 12.5 }}><ArrowLeft size={14} /> Re-run / edit photos</button>
            </div>

            {/* At-a-glance strip — the key numbers as chips, no sentence parsing. */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <StatChip value={String(parts.length)} label={parts.length === 1 ? "part" : "parts"} />
              <StatChip value={String(goodCount)} label="Grade A" tone="ok" />
              <StatChip value={String(sellable)} label="priced" />
              <StatChip value={String(flagged.length)} label="flagged" tone={flagged.length ? "warn" : "ok"} />
              {partsTotal > 0 && <StatChip value={`$${partsTotal.toLocaleString()}`} label="total" tone="accent" />}
            </div>

            {/* Vehicle & value — neutral facts about what was identified. */}
            <ReportGroup title="Vehicle & value">
              {vehicle
                ? <ReportRow tone="ok" icon={<Car size={14} color="var(--success)" />} text={<>Identified <strong>{vehicle.label}</strong> · {vehicle.sub}</>} />
                : <ReportRow tone="info" icon={<Info size={14} color="var(--muted)" />} text="Couldn't confidently identify the source vehicle from these photos." />}
              {suggestedCarPrice && (
                <ReportRow tone="info" icon={<Sparkles size={14} color="var(--signal)" />}
                  text={<>Whole-car value ≈ <strong className="tnum">${suggestedCarPrice.toLocaleString()}</strong> · standalone estimate</>}
                  detail="The AI's market value for the entire vehicle sold whole. It's independent of the per-part prices below — parting out usually totals more." />
              )}
              <ReportRow tone="info" icon={<Wrench size={14} color="var(--success)" />}
                text={<>{sellable} of {parts.length} part{parts.length === 1 ? "" : "s"} priced{partsTotal > 0 ? <> · gross potential <strong className="tnum">${partsTotal.toLocaleString()}</strong></> : null}</>}
                detail="Used-market prices at the part's grade. The total is GROSS retail potential — not every part sells, and pulling, storage, and selling costs come out of it. It is not the net you'll recover." />
              {vin && (
                <ReportRow tone="info" icon={<ScanLine size={14} color="var(--accent)" />}
                  text={<>VIN <span className="tnum">{vin}</span> read from photos</>}
                  detail="The decoded VIN locks the exact year, make, model, and engine for fitment and pricing. Confirm it in the vehicle card below." />
              )}
              {mileage && (
                <ReportRow tone="info" icon={<Lock size={14} color="var(--muted)" />}
                  text={`Mileage ${mileage} · kept private`}
                  detail="Read from the dashboard photo. Never shown on listings — you can share it in chat if a buyer asks." />
              )}
            </ReportGroup>

            {/* Needs review — everything that wants a human decision, warn-styled. */}
            {(() => {
              // The conservative-pricing note is a tip, not a review item — split it out.
              const reviewQa = qaFlags.filter((f) => !f.message.startsWith("Clean-parts total"));
              const tipQa = qaFlags.filter((f) => f.message.startsWith("Clean-parts total"));
              const hasReview = flagged.length > 0 || restricted.length > 0 || priceMismatches.length > 0 || reviewQa.length > 0;
              return (
                <>
                  <ReportGroup title="Needs review">
                    {!hasReview && <ReportRow tone="ok" icon={<CircleCheck size={14} color="var(--success)" />} text="Nothing needs review — every item came back clean." />}
                    {flagged.length > 0 && (
                      <ReportRow tone="warn" icon={<TriangleAlert size={14} color="var(--signal)" />}
                        text={<><strong>{flagged.length} part{flagged.length > 1 ? "s" : ""}</strong> flagged low-confidence — check name, side, and price</>}
                        detail={flagged.map((f) => f.partName).join(", ")} />
                    )}
                    {restricted.length > 0 && (
                      <ReportRow tone="warn" icon={<TriangleAlert size={14} color="#f59e0b" />}
                        text={<><strong>{restricted.length} restricted part{restricted.length > 1 ? "s" : ""}</strong> — confirm resale rules before listing</>}
                        detail={restricted.map((p) => p.partName).join(", ")} />
                    )}
                    {priceMismatches.length > 0 && (
                      <ReportRow tone="warn" icon={<TriangleAlert size={14} color="var(--signal)" />}
                        text={<>Left/right prices differ a lot: <strong>{priceMismatches.map((m) => m.base).join(", ")}</strong></>}
                        detail="Paired parts usually sell within ~20% of each other — check whether one side's price or condition is off." />
                    )}
                    {reviewQa.map((f, i) => renderQaRow(f, i))}
                  </ReportGroup>
                  {(missingHighValue.length > 0 || tipQa.length > 0) && (
                    <ReportGroup title="Tips">
                      {missingHighValue.length > 0 && (
                        <ReportRow tone="tip" icon={<Info size={14} color="var(--accent)" />}
                          text={<>No <strong>{missingHighValue.slice(0, 2).join(", ")}{missingHighValue.length > 2 ? ` +${missingHighValue.length - 2} more` : ""}</strong> detected — add engine-bay photos</>}
                          detail={`Missing high-value categories: ${missingHighValue.join(", ")}. If you're parting out the whole car, these are usually the highest-value parts — without photos of them you're leaving money on the table.`} />
                      )}
                      {tipQa.map((f, i) => (
                        <ReportRow key={`tqa${i}`} tone="tip" icon={<Info size={14} color="var(--accent)" />}
                          text="Pricing may be conservative — clean-parts total is below the whole-car estimate"
                          detail={f.message} />
                      ))}
                    </ReportGroup>
                  )}
                </>
              );
            })()}
          </Card>

          {/* Source vehicle (only if the model could infer one) */}
          {vehicle && (
            <Card pad={18} style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <Thumb url={mainPhoto} w={88} h={66} icon="Car" iconSize={28} />
                <span style={{ fontSize: 10.5, color: "var(--muted)", textAlign: "center" }}>Main photo · front</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{vehicle.label}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>{vehicle.sub}</div>
                {(vehicle.engine || vehicle.drivetrain) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {[vehicle.engine, vehicle.drivetrain].filter(Boolean).map((t, i) => (
                      <span key={i} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--foreground)", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 7, padding: "3px 9px" }}>{t}</span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                  {vinStatus === "confirmed" ? "✓ Confirmed from VIN. " : "Identified by AI. "}Confirm before posting.
                </div>
              </div>
              <div style={{ display: "grid", gap: 5, minWidth: 240 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}><ScanLine size={13} color="var(--accent)" /> VIN / plate <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500, opacity: 0.8 }}>· optional</span></label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={vin} onChange={(e) => { setVin(e.target.value.toUpperCase()); setVinStatus("idle"); }} onBlur={confirmVinModel} onKeyDown={(e) => { if (e.key === "Enter") confirmVinModel(); }} placeholder="Read from your photos. Confirm or add" maxLength={17} style={{ flex: 1, minWidth: 0, border: "1px solid var(--line)", outline: "none", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13.5, padding: "9px 12px", borderRadius: 10, letterSpacing: "0.04em", fontFamily: "var(--font-sans)" }} />
                  <button onClick={confirmVinModel} disabled={vinStatus === "checking"} style={{ flexShrink: 0, padding: "0 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--accent)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{vinStatus === "checking" ? "…" : "Confirm"}</button>
                </div>
                {vinStatus === "confirmed" ? (
                  <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 600 }}>✓ Model confirmed from VIN</span>
                ) : vinStatus === "bad" ? (
                  <span style={{ fontSize: 11, color: "var(--danger)" }}>Couldn&apos;t decode — check the 17 characters (no I, O, Q)</span>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Enter the VIN to confirm the exact model. Kept private, never shown publicly.</span>
                )}
                <label style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}><Tag size={13} color="var(--accent)" /> Stock # <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500, opacity: 0.8 }}>· optional</span></label>
                <input value={stockNumber} onChange={(e) => setStockNumber(e.target.value)} placeholder="Your yard inventory code" style={{ border: "1px solid var(--line)", outline: "none", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13.5, padding: "9px 12px", borderRadius: 10, fontFamily: "var(--font-sans)" }} />
                {vehicle && (
                  <>
                    <label style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Trim</label>
                    <input value={vehicleTrim} onChange={(e) => setVehicleTrim(e.target.value)} placeholder="e.g. LX, Sport, Limited" style={{ border: "1px solid var(--line)", outline: "none", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13.5, padding: "9px 12px", borderRadius: 10, fontFamily: "var(--font-sans)" }} />
                    <label style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Color</label>
                    <input value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} placeholder="e.g. Silver, Black, Red" style={{ border: "1px solid var(--line)", outline: "none", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13.5, padding: "9px 12px", borderRadius: 10, fontFamily: "var(--font-sans)" }} />
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Full VIN decode — everything NHTSA returns about this exact vehicle.
              Read before pricing to lock the exact year/model/engine. */}
          {vehicle?.vinInfo && (() => {
            const vi = vehicle.vinInfo as VinInfo;
            const dispL = vi.displacementL || (vi.displacement ? (Number(vi.displacement) / 1000).toFixed(1) : null);
            const engineStr = [dispL ? `${dispL}L` : null, vi.engineCylinders ? `${vi.engineCylinders}-cyl` : null, vi.engine].filter(Boolean).join(" ");
            const rows: [string, string | null][] = [
              ["VIN", vi.vin], ["Year", vi.year ? String(vi.year) : null], ["Company/Brand", vi.make], ["Model", vi.model],
              ["Trim", vi.trim], ["Body", vi.bodyClass], ["Engine", engineStr || null],
              ["Fuel", vi.fuelType], ["Transmission", vi.transmission], ["Drivetrain", vi.driveType],
              ["Doors", vi.doors], ["Seating", vi.seatingCapacity], ["Built in", [vi.plantCity, vi.plantState, vi.plantCountry].filter(Boolean).join(", ") || null],
              ["Manufacturer", vi.manufacturer],
            ];
            const shown = rows.filter(([, v]) => v && String(v).trim());
            return (
              <Card pad={18} style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--accent-tint)" }}><ScanLine size={16} color="var(--accent)" /></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>VIN details</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Decoded from the VIN and used to lock the exact vehicle before pricing.</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "10px 18px" }}>
                  {shown.map(([k, v]) => (
                    <div key={k} style={{ display: "grid", gap: 1 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--foreground)", wordBreak: "break-word" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()}

          <Card pad={18} style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>How do you want to sell this?</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>You can change this anytime.</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }} className="cs-sellmode">
              {["parts", "whole", "both"].map((mode) => {
                const m = SELL_MODE[mode];
                const on = sellMode === mode;
                const IconComp = mode === "parts" ? Wrench : mode === "whole" ? Car : CheckCircle2;
                return (
                  <button key={mode} className="cs-card-btn" onClick={() => setSellMode(mode)} style={{ textAlign: "left", display: "grid", gap: 7, padding: 14, borderRadius: "var(--radius-md)", border: `1.5px solid ${on ? m.color : "var(--line)"}`, background: on ? `color-mix(in srgb, ${m.color} 12%, transparent)` : "transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${m.color} 16%, transparent)` }}>
                        <IconComp size={17} color={m.color} />
                      </span>
                      {on && <Check size={17} color={m.color} />}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--foreground)" }}>{m.label}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Whole-car asking price — shown for "whole" and "both". Independent of the parts total. */}
          {showCar && (
            <Card pad={18} style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "color-mix(in srgb, var(--signal) 16%, transparent)" }}><Car size={16} color="var(--signal)" /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Whole-car price</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>AI's estimate from the make, model, year, body style, and visible condition in your photos. A typical-market ballpark, not live local comps. Standalone value, separate from the parts below. Check against comparable listings and edit freely.</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "8px 12px" }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "var(--success)" }}>$</span>
                  <input type="number" min={0} value={carPrice} placeholder="0" onChange={(e) => setCarPrice(e.target.value)} className="tnum" style={{ width: 120, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 22, fontWeight: 800 }} />
                </div>
                {suggestedCarPrice ? (
                  <div style={{ fontSize: 12.5, color: "var(--muted)", maxWidth: 320 }}>
                    <div><Sparkles size={12} style={{ verticalAlign: "-1px", marginRight: 4, color: "var(--signal)" }} />AI-suggested: <strong style={{ color: "var(--foreground)" }}>${suggestedCarPrice.toLocaleString()}</strong></div>
                    {carPriceNum !== suggestedCarPrice && (
                      <button onClick={() => setCarPrice(String(suggestedCarPrice))} style={{ ...navBtn, padding: "5px 10px", fontSize: 11.5, marginTop: 6 }}>Reset to AI estimate</button>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12.5, color: "var(--muted)", maxWidth: 320 }}>
                    The AI couldn't estimate a whole-car price from these photos. Set your asking price against comparable local listings.
                  </div>
                )}
              </div>
              {sellMode === "both" && (
                <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--muted)", lineHeight: 1.5, background: "var(--surface2)", borderRadius: 10, padding: "10px 12px" }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>This is your asking price for the whole car. Inside the post, the parts below appear as <strong style={{ color: "var(--foreground)" }}>suggested</strong> prices, so buyers can take the car or pick parts. The two prices are independent.</span>
                </div>
              )}
            </Card>
          )}

          {/* Parts list — shown for "parts" and "both". Hidden for "whole". */}
          {showParts && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  {parts.length} part{parts.length === 1 ? "" : "s"} found
                  <span style={{ color: "var(--muted)", fontWeight: 500 }}> · {sellMode === "both" ? "shown as suggested in your post" : "tap any field to fix it"}</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {anyAiPriced && (
                    <button onClick={() => setAllPctOfSuggested(100)} title="Reset every price to the AI's suggestion" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 12, fontWeight: 600 }}>
                      <RotateCcw size={13} /> Reset all to AI
                    </button>
                  )}
                  <button onClick={addBlankPart} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 11, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 14, fontWeight: 600 }}><Plus size={15} /> Add a part</button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {buildRenderRows(parts).map((row) => {
                  if (row.type === "header") {
                    return (
                      <div key={"h:" + row.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 14px", borderRadius: "var(--radius-md)", background: "var(--accent-tint)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)", marginTop: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--foreground)", display: "inline-flex", alignItems: "center", gap: 7 }}><Car size={14} color="var(--accent)" /> {row.label}</span>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--accent)" }} className="tnum">${row.total.toLocaleString()}</span>
                      </div>
                    );
                  }
                  const p = row.part;
                  const idx = parts.findIndex((x) => x._id === p._id);
                  const grouped = !!doorGroupKey(p.partName);
                  const warn = p.confidence === "low";
                  const price = p.suggestedPriceUsd || 0;
                  return (
                    <div key={p._id} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, marginLeft: grouped ? 16 : 0, borderRadius: "var(--radius-md)", flexWrap: "wrap", background: warn ? "var(--signal-bg)" : "var(--surface)", border: `1px solid ${warn ? "color-mix(in srgb, var(--signal) 40%, transparent)" : "var(--line)"}`, borderLeft: grouped ? "3px solid color-mix(in srgb, var(--accent) 45%, transparent)" : undefined }}>
                      <div style={{ display: "grid", gap: 1 }}>
                        <button onClick={() => movePart(p._id!, -1)} disabled={idx === 0} title="Move up" style={{ width: 24, height: 20, borderRadius: 6, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center", opacity: idx === 0 ? 0.35 : 1 }}><ChevronUp size={13} color="var(--muted)" /></button>
                        <button onClick={() => movePart(p._id!, 1)} disabled={idx === parts.length - 1} title="Move down" style={{ width: 24, height: 20, borderRadius: 6, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center", opacity: idx === parts.length - 1 ? 0.35 : 1 }}><ChevronDown size={13} color="var(--muted)" /></button>
                      </div>
                      <Thumb url={p.photoUrl} w={48} h={48} icon="Wrench" iconSize={18} />
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <input value={p.partName} placeholder="Part name" onChange={(e) => setPartName(p._id!, e.target.value)} style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", borderBottom: "1px solid transparent", padding: "1px 0" }} onFocus={(e) => (e.target.style.borderBottomColor = "var(--line)")} onBlur={(e) => (e.target.style.borderBottomColor = "transparent")} />
                          {warn && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "var(--signal)", background: "var(--signal-bg)", borderRadius: 6, padding: "2px 7px", flexShrink: 0 }}><TriangleAlert size={11} /> Review</span>}
                          {p.inferred && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 6, padding: "2px 7px", flexShrink: 0 }}><Info size={11} /> Inferred — verify</span>}
                        </div>
                        <textarea value={p.description || ""} placeholder="Description (AI fills this in; tap to edit)" rows={2} onChange={(e) => setPartDesc(p._id!, e.target.value)} style={{ width: "100%", marginTop: 4, fontSize: 12.5, color: "var(--muted)", border: "1px solid transparent", outline: "none", background: "transparent", resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.45, borderRadius: 8, padding: "4px 6px" }} onFocus={(e) => { e.target.style.borderColor = "var(--line)"; e.target.style.color = "var(--foreground)"; }} onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.color = "var(--muted)"; }} />
                      </div>
                      <ConditionBadge grade={p.condition} size="sm" />
                      <div style={{ width: 158, display: "grid", gap: 4, justifyItems: "end" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button onClick={() => nudgePart(p, -5)} disabled={!price} title="−5%" style={{ width: 22, height: 22, borderRadius: 7, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer", opacity: price ? 1 : 0.35, flexShrink: 0 }}><Minus size={12} color="var(--muted)" /></button>
                          <div style={{ display: "flex", alignItems: "center", gap: 3, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 9, padding: "6px 11px" }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: price > 0 ? "var(--success)" : "var(--muted)" }}>$</span>
                            <input type="number" min={0} value={p.suggestedPriceUsd ?? ""} placeholder="0" onChange={(e) => setPartPrice(p._id!, e.target.value)} className="tnum" style={{ width: 62, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 15, fontWeight: 700, textAlign: "right" }} />
                          </div>
                          <button onClick={() => nudgePart(p, 5)} disabled={!price} title="+5%" style={{ width: 22, height: 22, borderRadius: 7, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer", opacity: price ? 1 : 0.35, flexShrink: 0 }}><Plus size={12} color="var(--muted)" /></button>
                        </div>
                        {(() => {
                          // Confidence band: the AI's own price range (or a confidence-derived
                          // fallback), with a draggable marker two-way synced to the field.
                          const band = bandFor(p);
                          if (!band) return null;
                          return (
                            <PriceBand
                              low={band.low}
                              high={band.high}
                              value={p.suggestedPriceUsd ?? Math.round((band.low + band.high) / 2)}
                              confidence={p.confidence}
                              onChange={(v) => setPartPrice(p._id!, String(v))}
                            />
                          );
                        })()}
                        {(() => {
                          // Editing affordances: ghost AI estimate + reset on edited rows,
                          // and a round-to-yard-figure helper when the price is odd.
                          const edited = p._aiPrice != null && p._aiPrice > 0 && p.suggestedPriceUsd !== p._aiPrice;
                          const rounded = price > 0 ? roundYardPrice(price) : 0;
                          if (!edited && (price === 0 || rounded === price)) return null;
                          return (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              {edited && <span className="tnum" style={{ fontSize: 10, color: "var(--muted)" }}>AI: ${p._aiPrice!.toLocaleString()}</span>}
                              {edited && (
                                <button onClick={() => setPartPrice(p._id!, String(p._aiPrice))} title="Reset to the AI's suggestion" style={{ width: 20, height: 20, borderRadius: 6, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}><RotateCcw size={11} color="var(--muted)" /></button>
                              )}
                              {price > 0 && rounded !== price && (
                                <button onClick={() => setPartPrice(p._id!, String(rounded))} title="Round to a yard-friendly figure" className="tnum" style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 10.5, fontWeight: 600, cursor: "pointer" }}>≈ ${rounded.toLocaleString()}</button>
                              )}
                            </div>
                          );
                        })()}
                        {sellMode === "both" && <span style={{ fontSize: 10, color: "var(--muted)" }}>suggested</span>}
                        {p.pricingInsight && (() => {
                          const ins = p.pricingInsight!;
                          const LBL: Record<string, string> = { shop: "Sold comps", grounded: "Market data", ebay: "eBay listings", asking: "Active asking", model: "AI estimate", formula: "AI estimate", market: "Live market comps" };
                          const label = LBL[ins.source || "model"] || "AI estimate";
                          const dot = ins.confidence === "high" ? "#16a34a" : ins.confidence === "medium" ? "#f59e0b" : "var(--muted)";
                          const em = Number(ins.ebayMedian) || 0;
                          const n = Number(ins.similarCount) || 0;
                          // Provenance in the tooltip only — no vendor names surfaced to sellers.
                          const engine = ins.pricedBy === "claude-market" ? " · researched live" : ins.pricedBy === "claude" ? " · market model" : ins.pricedBy ? " · fallback estimate" : "";
                          return (
                            <>
                              <span title={`${label} · ${ins.confidence || "low"} confidence${engine}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />{label}
                              </span>
                              {ins.source === "market" && n > 0 && (
                                <span title={(ins.sources || []).join(", ")} style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap", textAlign: "right" }}>
                                  {n} comp{n === 1 ? "" : "s"}{ins.sources?.length ? ` · ${ins.sources.slice(0, 2).join(", ")}` : ""}
                                </span>
                              )}
                              {em > 0 && (
                                <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap", textAlign: "right" }}>
                                  Selling on eBay ~${em.toLocaleString()}{n ? ` · ${n} listings` : ""}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <button onClick={() => removePart(p._id!)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center", flexShrink: 0 }}><X size={15} color="var(--muted)" /></button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <Card pad={16} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, position: "sticky", bottom: 0, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
              {showCar && (
                <div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Whole-car asking price</div>
                  <div className="tnum" style={{ fontSize: 22, fontWeight: 800, color: carPriceNum > 0 ? "var(--success)" : "var(--muted)" }}>{carPriceNum > 0 ? `$${carPriceNum.toLocaleString()}` : "Not set"}</div>
                </div>
              )}
              {showParts && (
                <div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{sellMode === "both" ? "Parts value · suggested" : "Suggested parts value"}</div>
                  <div className="tnum" style={{ fontSize: 22, fontWeight: 800, color: showCar ? "var(--foreground)" : "var(--success)" }}>${partsTotal.toLocaleString()}</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>Gross potential — not every part sells</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={navBtn} onClick={() => setPhase("upload")}><ArrowLeft size={15} /> Edit photos</button>
              <button style={{ ...navBtn, opacity: saving ? 0.7 : 1 }} disabled={saving} onClick={() => save(true)}>{savingKind === "draft" ? <ScanLine size={15} className="spin" /> : <FileText size={15} />} {savingKind === "draft" ? "Saving…" : "Save as draft"}</button>
              <button className="cs-raise" disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }} onClick={() => save(false)}>{savingKind === "post" ? <ScanLine size={16} className="spin" /> : <Check size={16} />} {savingKind === "post" ? "Saving…" : sellMode === "whole" ? "Save & post vehicle" : sellMode === "both" ? "Save & post car + parts" : "Save & post parts"}</button>
            </div>
          </Card>
        </>
      )}

      {camOpen && (
        <CameraCapture
          onClose={() => setCamOpen(false)}
          onCapture={(file) => {
            const dt = new DataTransfer();
            dt.items.add(file);
            addFiles(dt.files);
          }}
        />
      )}
    </div>
  );
}

// Live webcam capture — works on desktop and mobile via getUserMedia.
// Falls back with a clear message if the browser blocks camera access.
function CameraCapture({ onClose, onCapture }: { onClose: () => void; onCapture: (file: File) => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
        setReady(true);
      } catch {
        setErr("Camera access was blocked. Allow camera permission in your browser, or use Upload instead.");
      }
    })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const ts = canvas.width + "x" + canvas.height;
      onCapture(new File([blob], `camera-${ts}.jpg`, { type: "image/jpeg" }));
      onClose();
    }, "image/jpeg", 0.9);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 170, background: "rgba(7,11,22,0.82)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24 }} onMouseDown={onClose}>
      <div style={{ width: "min(560px, 100%)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "0 40px 90px -30px rgba(0,0,0,0.8)" }} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}><Camera size={17} color="var(--accent)" /> Take a photo</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center" }}><X size={16} color="var(--muted)" /></button>
        </div>
        {err ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13.5, lineHeight: 1.5 }}>{err}</div>
        ) : (
          <>
            <div style={{ background: "#000", aspectRatio: "4/3", display: "grid", placeItems: "center" }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
              <button className="cs-raise" disabled={!ready} onClick={snap} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14.5, fontWeight: 600, opacity: ready ? 1 : 0.5 }}>
                <Camera size={17} /> Capture
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 11, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 14, fontWeight: 600 };

// Real scanned photo as a thumbnail; falls back to the icon placeholder.
function Thumb({ url, w, h, icon = "Car", iconSize = 28 }: { url?: string | null; w: number; h: number; icon?: string; iconSize?: number }) {
  if (url) {
    return (
      <div style={{ width: w, height: h, borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--line)", flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  return <PhotoCell icon={icon} style={{ width: w, height: h, flexShrink: 0 }} iconSize={iconSize} />;
}

// Draggable price confidence band (low → high). The marker tracks the current price and
// dragging it writes the price back — two-way sync with the numeric field. Green and
// tight when the model was confident, amber and wide when it wasn't (incl. the fallback
// band low-confidence "Review" parts get from lib/price-band).
function PriceBand({ low, high, value, confidence, onChange }: { low: number; high: number; value: number; confidence: "high" | "medium" | "low"; onChange: (price: number) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const frac = bandFraction({ low, high }, value);
  const color = confidence === "high" ? "var(--success)" : "#f59e0b";
  const fromClientX = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return value;
    return priceAtFraction({ low, high }, (clientX - r.left) / r.width);
  };
  return (
    <div style={{ width: "100%", display: "grid", gap: 1 }}>
      <div
        ref={ref}
        onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); setDragging(true); onChange(fromClientX(e.clientX)); }}
        onPointerMove={(e) => { if (dragging) onChange(fromClientX(e.clientX)); }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        title={`AI price range $${low.toLocaleString()}–$${high.toLocaleString()} · drag to set the price`}
        style={{ position: "relative", height: 16, cursor: "ew-resize", touchAction: "none" }}
      >
        <div style={{ position: "absolute", top: 6.5, left: 0, right: 0, height: 3, borderRadius: 2, background: `color-mix(in srgb, ${color} 30%, var(--line))` }} />
        <div style={{ position: "absolute", top: 3, left: `calc(${(frac * 100).toFixed(1)}% - 5px)`, width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: "0 0 0 2px var(--surface)", pointerEvents: "none" }} />
      </div>
      <div className="tnum" style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--muted)", lineHeight: 1 }}>
        <span>${low.toLocaleString()}</span>
        <span>${high.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ── AI analysis report building blocks ───────────────────────────────────────

// Small stat chip for the report's at-a-glance strip (57 parts · 46 Grade A · …).
function StatChip({ value, label, tone = "neutral" }: { value: string; label: string; tone?: "neutral" | "ok" | "warn" | "accent" }) {
  const color = tone === "ok" ? "var(--success)" : tone === "warn" ? "var(--signal)" : tone === "accent" ? "var(--accent)" : "var(--foreground)";
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 9, padding: "5px 10px" }}>
      <span className="tnum" style={{ fontSize: 14, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{label}</span>
    </span>
  );
}

// A titled group of report rows (Vehicle & value / Needs review / Tips).
function ReportGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</div>
      {children}
    </div>
  );
}

// One report row with severity treatment and an optional "Show details" disclosure.
// Tones: warn (amber chip + left border), tip (accent left border), ok/info (quiet
// icon+text). minWidth 0 + overflowWrap keep long content wrapping inside the card
// instead of clipping at its right edge. `children` hosts action sub-rows (agent fixes).
function ReportRow({ tone, icon, text, detail, children }: {
  tone: "ok" | "info" | "warn" | "tip"; icon: React.ReactNode; text: React.ReactNode;
  detail?: React.ReactNode; children?: React.ReactNode;
}) {
  const framed = tone === "warn" || tone === "tip";
  const frame: React.CSSProperties = tone === "warn"
    ? { background: "var(--signal-bg)", borderLeft: "3px solid var(--signal)" }
    : tone === "tip"
      ? { background: "var(--surface2)", borderLeft: "3px solid var(--accent)" }
      : {};
  return (
    <div style={{ ...frame, borderRadius: 9, padding: framed ? "8px 10px" : "1px 0", display: "grid", gap: 5, minWidth: 0 }}>
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12.5, color: "var(--foreground)", lineHeight: 1.5, minWidth: 0 }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{text}</span>
      </div>
      {detail && (
        <details style={{ marginLeft: 23 }}>
          <summary style={{ cursor: "pointer", fontSize: 11.5, fontWeight: 600, color: "var(--accent)", userSelect: "none", width: "fit-content" }}>Show details</summary>
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55, marginTop: 4, overflowWrap: "anywhere" }}>{detail}</div>
        </details>
      )}
      {children}
    </div>
  );
}

function Step({ n, label, on, done }: { n: number; label: string; on: boolean; done?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{ width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, background: done ? "var(--success)" : on ? "var(--accent)" : "var(--surface2)", color: on || done ? "#fff" : "var(--muted)", border: on || done ? "none" : "1px solid var(--line)" }}>
        {done ? <Check size={14} color="#fff" /> : n}
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: on ? "var(--foreground)" : "var(--muted)" }}>{label}</span>
    </div>
  );
}

// Entry choice: AI scan vs. manual car vs. manual part.
function ModePicker({ onPick }: { onPick: (m: "ai" | "manualCar" | "manualPart") => void }) {
  const tiles = [
    { id: "ai", icon: Sparkles, title: "Scan with AI", desc: "Upload photos and AI finds the car, every part, condition, and prices.", fast: true },
    { id: "manualCar", icon: Car, title: "List a car manually", desc: "Type it in yourself. Photos optional. AI can help write & price." },
    { id: "manualPart", icon: Wrench, title: "List a part manually", desc: "Post a single part (e.g. an engine). Photos optional." },
  ] as const;
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gap: 16 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>How do you want to add this?</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>Let AI do it from photos, or enter a car or part yourself.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {tiles.map((t) => (
          <button key={t.id} onClick={() => onPick(t.id)} className="cs-hover-card" style={{ textAlign: "left", cursor: "pointer", border: `1px solid ${t.fast ? "var(--accent)" : "var(--line)"}`, borderRadius: "var(--radius-md)", background: "var(--surface)", padding: 18, display: "grid", gap: 10 }}>
            <span style={{ width: 46, height: 46, borderRadius: 12, background: "var(--accent-tint)", display: "grid", placeItems: "center" }}><t.icon size={22} color="var(--accent)" /></span>
            <div style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>{t.title}{t.fast && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 6, padding: "2px 7px" }}>FASTEST</span>}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{t.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
