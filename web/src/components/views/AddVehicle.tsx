"use client";

import React from "react";
import { ImageUp, Upload, ScanLine, Sparkles, Check, Info, CircleCheck, Car, Wrench, Plus, X, TriangleAlert, CheckCircle2, ArrowLeft, FileText, RotateCcw, Lock, Camera, ChevronUp, ChevronDown, Tag } from "lucide-react";
import { Card, PhotoCell, ConditionBadge } from "../UI";
import { SELL_MODE } from "../data";
import { csToast } from "../Dashboard";
import { looksLikeScannable, isPdf, normalizeImageFile, fileToJpegDataUrl, fileToAIDataUrl } from "@/lib/image";
import { playSonarPing } from "@/lib/sound";
import { ManualListing } from "./ManualListing";
import { useScanSession, setScanSession, getScanSession, resetScanSession, beginScanRun, isScanRun, type ScanSession } from "@/lib/scanSession";
import type { VinInfo } from "@/lib/vin";

interface UploadedPhoto { url: string; name: string; file: File }

interface VehicleFit { make: string; model: string; yearStart: number; yearEnd: number; notes?: string }
interface AIPart {
  partName: string; partCategory: string; fitment: VehicleFit[];
  condition: "Good" | "Poor"; conditionNotes: string; description: string;
  suggestedPriceUsd: number | null; confidence: "high" | "medium" | "low";
  lowConfidenceFields?: string[];
  // Pricing provenance from the ladder (AHLAM-53): which rung set the price + how
  // trustworthy it is. Spread through from the identify response.
  pricingInsight?: { source?: "shop" | "grounded" | "ebay" | "asking" | "model"; confidence?: "high" | "medium" | "low"; similarCount?: number; ebayMedian?: number; ebayRange?: { min: number; max: number } };
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
  trim?: string | null; engine?: string | null; drivetrain?: string | null; vinInfo?: VinInfo | null;
}
type AIResult = { ok: true; data: AIPart[]; vehicle?: VehicleEstimate | null; vehicleFront?: string } | { ok: false; userMessage: string; internalError: string };

// Accent color used across the scan flow (spinner, report card). The scan engine
// is fixed and never surfaced to the seller.
const SCAN_TONE = "var(--signal)";

// Pick the single best whole-car price + label from per-photo AI estimates.
function aggregateVehicle(estimates: (VehicleEstimate | null | undefined)[]): { label: string; sub: string; suggestedPrice: number | null; mileage: string | null; make: string; model: string; year: string; body: string; vin: string | null; trim: string | null; engine: string | null; drivetrain: string | null; vinInfo: VinInfo | null } | null {
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

  return {
    label: `${make} ${model}`,
    sub: [year, trim, body].filter(Boolean).join(" · "),
    suggestedPrice, mileage, make, model, year, body, vin, trim, engine, drivetrain, vinInfo,
  };
}

// When a VIN was decoded, its engine/drivetrain are GROUND TRUTH (NHTSA), so the
// Engine part is labelled FROM THE VIN — not the per-photo visual guess. The VIN
// usually sits on a different photo (windshield) than the engine (engine bay), so
// the server can't reconcile them per-photo; they're only ever together here, at
// merge. Without this, the Engine description keeps the model's guess and can
// contradict the VIN-confirmed engine shown on the vehicle card. The model's wear
// notes (conditionNotes) are preserved; only the engine spec is made authoritative.
function applyVinSpecsToParts(
  parts: AIPart[],
  agg: { make: string; model: string; year: string; engine: string | null; drivetrain: string | null },
): AIPart[] {
  if (!agg.engine && !agg.drivetrain) return parts;
  const idLabel = [agg.year, agg.make, agg.model].filter(Boolean).join(" ");
  return parts.map((p) => {
    const base = p.partName.replace(/\s*—.*$/, "").trim(); // strip any prior "Engine — …"
    if (agg.engine && /^engine$/i.test(base)) {
      const notes = (p.conditionNotes || "").trim();
      return {
        ...p,
        partName: `Engine — ${agg.engine}`,
        description: `${idLabel} engine — VIN-confirmed ${agg.engine}.${notes ? ` ${notes}` : ""}`.trim(),
      };
    }
    if (agg.drivetrain && /^transmission$/i.test(base)
        && !p.description.toLowerCase().includes(agg.drivetrain.toLowerCase())) {
      return { ...p, description: [p.description, `Drivetrain: ${agg.drivetrain}.`].filter(Boolean).join(" ") };
    }
    return p;
  });
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
  const fileRef = React.useRef<HTMLInputElement>(null);
  const partSeq = React.useRef(0);
  // After a remount (e.g. returning to a restored session), continue ids above the
  // highest existing one so new rows never collide with restored parts.
  if (partSeq.current === 0) partSeq.current = parts.reduce((m, p) => Math.max(m, Number(p._id) || 0), 0);
  const newId = () => String(++partSeq.current);

  const partsTotal = parts.reduce((s, p) => s + (p.suggestedPriceUsd || 0), 0);
  const sellable = parts.filter((p) => (p.suggestedPriceUsd || 0) > 0).length;
  const flagged = parts.filter((p) => p.confidence === "low");
  const goodCount = parts.filter((p) => p.condition === "Good").length;
  // Pre-submit review checks (AHLAM-66): aggregate everything the seller should
  // eyeball before posting — restricted parts, missing high-value categories,
  // and wildly mismatched left/right prices.
  const restricted = parts.filter((p) => p.compliance);                       // AHLAM-54
  const missingHighValue = missingHighValueCategories(parts);                  // AHLAM-55
  const priceMismatches = pairedPriceMismatches(parts);                        // AHLAM-69
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
    setPhase("analyzing"); setError(null);
    try {
      const results = await Promise.all(
        photos.map(async (photo) => {
          const dataUrl = await fileToAIDataUrl(photo.file);
          const res = await fetch("/api/identify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: dataUrl }),
          });
          return { result: (await res.json()) as AIResult, photo };
        })
      );

      if (!isScanRun(myToken)) return; // cancelled / superseded while scanning

      const collected: AIPart[] = [];
      const estimates: (VehicleEstimate | null | undefined)[] = [];
      let firstError: string | null = null;
      let frontPhoto: string | null = null;
      for (const { result: r, photo } of results) {
        if (r.ok) {
          // Tag every part with the photo it was scanned from (its thumbnail).
          collected.push(...r.data.map((p) => ({ ...p, photoUrl: photo.url })));
          estimates.push(r.vehicle);
          // Main post pic = the photo the AI says shows the front ("toward-camera").
          if (r.vehicleFront === "toward-camera" && !frontPhoto) frontPhoto = photo.url;
        } else if (!firstError) firstError = r.userMessage;
      }

      // Dedupe parts seen across multiple photos by name. Prefer the instance the AI
      // was most confident about (the photo that actually shows the part — e.g. the
      // engine-bay shot for "Engine", not a side-profile that hallucinated it), then
      // break ties by the higher price. This keeps each part's thumbnail correct.
      const confRank = (p: AIPart) => (p.confidence === "high" ? 2 : p.confidence === "low" ? 0 : 1);
      const byName = new Map<string, AIPart>();
      for (const p of collected) {
        const key = p.partName.toLowerCase().trim();
        const existing = byName.get(key);
        if (!existing
          || confRank(p) > confRank(existing)
          || (confRank(p) === confRank(existing) && (p.suggestedPriceUsd || 0) > (existing.suggestedPriceUsd || 0))) {
          byName.set(key, p);
        }
      }
      const deduped = [...byName.values()]
        .sort(comparePartsForDisplay)
        .map((p) => ({ ...p, _id: newId(), _aiPrice: p.suggestedPriceUsd ?? null }));

      // Front shot for the main post image; fall back to the first uploaded photo.
      setMainPhoto(frontPhoto || photos[0]?.url || null);

      if (!deduped.length) {
        setError(firstError || "No sellable parts were detected in these photos. Try clearer, closer shots.");
        setPhase("error");
        return;
      }

      // Prefer the AI's explicit vehicle estimate (incl. whole-car price + mileage);
      // fall back to fitment-derived identity if the model didn't return one.
      const agg = aggregateVehicle(estimates);
      if (agg) {
        setVehicle({ label: agg.label, sub: agg.sub || "identified by AI", make: agg.make, model: agg.model, year: agg.year, body: agg.body, trim: agg.trim, engine: agg.engine, drivetrain: agg.drivetrain, vinInfo: agg.vinInfo });
        setSuggestedCarPrice(agg.suggestedPrice);
        setCarPrice(agg.suggestedPrice ? String(agg.suggestedPrice) : "");
        setMileage(agg.mileage);
        if (agg.trim) setVehicleTrim(agg.trim); // prefill trim from the VIN
        if (agg.vin) { setVin(agg.vin); setVinStatus("confirmed"); } // VIN read + decoded server-side
      } else {
        setVehicle(deriveVehicle(deduped));
        setSuggestedCarPrice(null);
        setCarPrice("");
        setMileage(null);
      }
      setParts(agg ? applyVinSpecsToParts(deduped, agg) : deduped);
      setPhase("results");
      playSonarPing(); // sonar ring: the scan is done, results are ready
    } catch (e) {
      if (!isScanRun(myToken)) return; // cancelled / superseded
      setError("We couldn't reach the analysis server. Check your connection and try again.");
      setPhase("error");
    }
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
    setParts((prev) => [...prev, { partName: "", partCategory: "", fitment: [], condition: "Good", conditionNotes: "", description: "", suggestedPriceUsd: null, confidence: "high", _id: newId(), _aiPrice: null }]);
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
      const images = await Promise.all(imagePhotos.map((p) => fileToJpegDataUrl(p.file)));
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
            <div style={{ fontSize: 17, fontWeight: 700 }}>Scanning your car…</div>
            <div style={{ fontSize: 13.5, color: "var(--muted)", maxWidth: 420, marginTop: 6, lineHeight: 1.5 }}>Reading your photos to identify the vehicle and every sellable part, including the VIN or stock number if they show in a picture.</div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "var(--signal)", background: "var(--signal-bg)", border: "1px solid color-mix(in srgb, var(--signal) 35%, transparent)", borderRadius: 999, padding: "7px 14px" }}>
            <Info size={14} /> This might take up to 30 seconds. Hang tight.
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

            <div style={{ fontSize: 13.5, color: "var(--foreground)", lineHeight: 1.6, background: "var(--surface2)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
              {vehicle
                ? <>Source vehicle identified as a <strong>{vehicle.sub.split(" · ")[0] ? `${vehicle.sub.split(" · ")[0]} ` : ""}{vehicle.label}</strong>. </>
                : <>Couldn't confidently identify the source vehicle from these photos. </>}
              Cataloged <strong>{parts.length} part{parts.length === 1 ? "" : "s"}</strong>: {goodCount} graded Good, {sellable} with a suggested price, {flagged.length} flagged low-confidence.
            </div>

            <div style={{ display: "grid", gap: 7 }}>
              {vehicle && <ReportLine icon={<Car size={14} color="var(--success)" />} text={`Identified ${vehicle.label}, ${vehicle.sub}.`} />}
              {suggestedCarPrice && <ReportLine icon={<Sparkles size={14} color="var(--signal)" />} text={`AI estimates a whole-car market value around $${suggestedCarPrice.toLocaleString()} (standalone, not the sum of parts).`} />}
              <ReportLine icon={<Wrench size={14} color="var(--success)" />} text={`${sellable} of ${parts.length} part${parts.length === 1 ? "" : "s"} returned a suggested price${partsTotal > 0 ? ` (total $${partsTotal.toLocaleString()})` : ""}.`} />
              {flagged.length > 0
                ? <ReportLine icon={<TriangleAlert size={14} color="var(--signal)" />} text={`${flagged.length} part${flagged.length > 1 ? "s" : ""} flagged for review: ${flagged.map((f) => f.partName).join(", ")}.`} />
                : <ReportLine icon={<CircleCheck size={14} color="var(--success)" />} text="No low-confidence parts. Every item came back clean." />}
              {restricted.length > 0 && (
                <ReportLine icon={<TriangleAlert size={14} color="#f59e0b" />} text={`${restricted.length} restricted part${restricted.length > 1 ? "s" : ""} — verify resale rules before listing: ${restricted.map((p) => p.partName).join(", ")}.`} />
              )}
              {missingHighValue.length > 0 && (
                <ReportLine icon={<Info size={14} color="var(--signal)" />} text={`No ${missingHighValue.join(", ")} detected. If you're parting out the whole car, add engine-bay photos — these are usually the highest-value parts and you're leaving money on the table without them.`} />
              )}
              {priceMismatches.length > 0 && (
                <ReportLine icon={<TriangleAlert size={14} color="var(--signal)" />} text={`Check left/right pricing — ${priceMismatches.map((m) => m.base).join(", ")} ${priceMismatches.length > 1 ? "have" : "has"} sides priced very differently. Paired parts usually sell within ~20% of each other.`} />
              )}
              {vin && <ReportLine icon={<ScanLine size={14} color="var(--accent)" />} text={`VIN read from your photos: ${vin}. Used to lock the exact year, make, model, and engine for accurate fitment and pricing. Confirm it below.`} />}
              {mileage && <ReportLine icon={<Lock size={14} color="var(--muted)" />} text={`Mileage read from dashboard: ${mileage}. Kept private, never shown on listings. You can share it in chat if a buyer asks.`} />}
            </div>
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
              ["VIN", vi.vin], ["Year", vi.year ? String(vi.year) : null], ["Make", vi.make], ["Model", vi.model],
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 10, padding: "4px 6px 4px 11px" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>Price all:</span>
                      {[50, 75, 90, 100].map((pct) => (
                        <button key={pct} onClick={() => setAllPctOfSuggested(pct)} title={pct === 100 ? "Reset to AI-suggested" : `${pct}% of AI-suggested`} style={{ padding: "5px 9px", borderRadius: 7, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 12, fontWeight: 600 }}>
                          {pct === 100 ? "Reset" : `${pct}%`}
                        </button>
                      ))}
                    </div>
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
                        </div>
                        <textarea value={p.description || ""} placeholder="Description (AI fills this in; tap to edit)" rows={2} onChange={(e) => setPartDesc(p._id!, e.target.value)} style={{ width: "100%", marginTop: 4, fontSize: 12.5, color: "var(--muted)", border: "1px solid transparent", outline: "none", background: "transparent", resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.45, borderRadius: 8, padding: "4px 6px" }} onFocus={(e) => { e.target.style.borderColor = "var(--line)"; e.target.style.color = "var(--foreground)"; }} onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.color = "var(--muted)"; }} />
                      </div>
                      <ConditionBadge grade={p.condition} size="sm" />
                      <div style={{ width: 110, display: "grid", gap: 2, justifyItems: "end" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 3, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 9, padding: "6px 11px" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: price > 0 ? "var(--success)" : "var(--muted)" }}>$</span>
                          <input type="number" min={0} value={p.suggestedPriceUsd ?? ""} placeholder="0" onChange={(e) => setPartPrice(p._id!, e.target.value)} className="tnum" style={{ width: 72, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 15, fontWeight: 700, textAlign: "right" }} />
                        </div>
                        {sellMode === "both" && <span style={{ fontSize: 10, color: "var(--muted)" }}>suggested</span>}
                        {p.pricingInsight && (() => {
                          const ins = p.pricingInsight!;
                          const LBL: Record<string, string> = { shop: "Sold comps", grounded: "Market data", ebay: "eBay listings", asking: "Active asking", model: "AI estimate" };
                          const label = LBL[ins.source || "model"] || "AI estimate";
                          const dot = ins.confidence === "high" ? "#16a34a" : ins.confidence === "medium" ? "#f59e0b" : "var(--muted)";
                          const em = Number(ins.ebayMedian) || 0;
                          const n = Number(ins.similarCount) || 0;
                          return (
                            <>
                              <span title={`${label} · ${ins.confidence || "low"} confidence`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />{label}
                              </span>
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

function ReportLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12.5, color: "var(--foreground)", lineHeight: 1.5 }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span>{text}</span>
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
