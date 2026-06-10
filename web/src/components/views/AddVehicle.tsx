"use client";

import React from "react";
import { ImageUp, Upload, ScanLine, Sparkles, Check, Info, CircleCheck, Car, Wrench, Plus, X, TriangleAlert, CheckCircle2, ArrowLeft, FileText, RotateCcw, Lock, Camera, ChevronUp, ChevronDown, Tag } from "lucide-react";
import { Card, PhotoCell, ConditionBadge } from "../UI";
import { SELL_MODE } from "../data";
import { csToast } from "../Dashboard";
import { looksLikeImage, normalizeImageFile, fileToJpegDataUrl } from "@/lib/image";
import { ManualListing } from "./ManualListing";

interface UploadedPhoto { url: string; name: string; file: File }

interface VehicleFit { make: string; model: string; yearStart: number; yearEnd: number; notes?: string }
interface AIPart {
  partName: string; partCategory: string; fitment: VehicleFit[];
  condition: "Good" | "Poor"; conditionNotes: string; description: string;
  suggestedPriceUsd: number | null; confidence: "high" | "medium" | "low";
  lowConfidenceFields?: string[];
  photoUrl?: string; // the photo this part was scanned from — used as its thumbnail
  _id?: string;       // stable client id so edit/reorder/add survive list changes
  _aiPrice?: number | null; // the AI's original suggestion, kept for batch "% of suggested"
}

const MAX_PHOTOS = 8;
interface VehicleEstimate {
  make: string | null; model: string | null; yearStart: number | null; yearEnd: number | null;
  bodyStyle: string | null; mileage: string | null; suggestedWholeCarPriceUsd: number | null; confidence: "high" | "medium" | "low";
}
type AIResult = { ok: true; data: AIPart[]; vehicle?: VehicleEstimate | null; vehicleFront?: string } | { ok: false; userMessage: string; internalError: string };

const PROVIDERS = [
  { id: "gemini", name: "Gemini 2.5 Flash", brand: "Google", tone: "var(--signal)", desc: "Fast pass with strong part ID, fitment, and pricing.", speed: "~15–20s" },
  { id: "sonnet", name: "Claude Sonnet 4.6", brand: "Anthropic", tone: "#d4a574", desc: "Top-tier vision reasoning for the most accurate part identification.", speed: "~15–20s" },
  { id: "haiku", name: "Claude Haiku 4.5", brand: "Anthropic", tone: "#d4a574", desc: "Fast, lightweight Claude for quick scans with solid accuracy.", speed: "~8–12s" },
];

// Pick the single best whole-car price + label from per-photo AI estimates.
function aggregateVehicle(estimates: (VehicleEstimate | null | undefined)[]): { label: string; sub: string; suggestedPrice: number | null; mileage: string | null; make: string; model: string; year: string; body: string } | null {
  const valid = estimates.filter((e): e is VehicleEstimate => !!e && !!e.make && !!e.model);
  if (!valid.length) return null;
  // Most-named make+model wins the label.
  const tally = new Map<string, { e: VehicleEstimate; n: number; lo: number; hi: number }>();
  for (const e of valid) {
    const key = `${e.make} ${e.model}`.toLowerCase();
    const cur = tally.get(key);
    if (cur) { cur.n++; if (e.yearStart) cur.lo = Math.min(cur.lo, e.yearStart); if (e.yearEnd) cur.hi = Math.max(cur.hi, e.yearEnd); }
    else tally.set(key, { e, n: 1, lo: e.yearStart || 0, hi: e.yearEnd || 0 });
  }
  const top = [...tally.values()].sort((a, b) => b.n - a.n)[0];
  const years = top.lo && top.hi ? (top.lo === top.hi ? `${top.lo}` : `${top.lo}–${top.hi}`) : "";
  // Median of all suggested prices the model returned.
  const prices = valid.map((e) => e.suggestedWholeCarPriceUsd).filter((p): p is number => typeof p === "number" && p > 0).sort((a, b) => a - b);
  const suggestedPrice = prices.length ? prices[Math.floor(prices.length / 2)] : null;
  const mileage = valid.map((e) => e.mileage).find((m): m is string => !!m) ?? null;
  return {
    label: `${top.e.make} ${top.e.model}`,
    sub: [years, top.e.bodyStyle].filter(Boolean).join(" · "),
    suggestedPrice,
    mileage,
    make: top.e.make || "",
    model: top.e.model || "",
    year: years,
    body: top.e.bodyStyle || "",
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

export function AddVehicle({ go }: { go: (id: string) => void; onVehicle?: (v: any) => void }) {
  const [phase, setPhase] = React.useState("upload");
  const [parts, setParts] = React.useState<AIPart[]>([]);
  const [vehicle, setVehicle] = React.useState<{ label: string; sub: string; make?: string; model?: string; year?: string; body?: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [mainPhoto, setMainPhoto] = React.useState<string | null>(null);
  const [sellMode, setSellMode] = React.useState("parts");
  const [mode, setMode] = React.useState<null | "ai" | "manualCar" | "manualPart">(null);
  const [provider, setProvider] = React.useState<string>("gemini");
  const [photos, setPhotos] = React.useState<UploadedPhoto[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [carPrice, setCarPrice] = React.useState<string>("");
  const [suggestedCarPrice, setSuggestedCarPrice] = React.useState<number | null>(null);
  const [mileage, setMileage] = React.useState<string | null>(null);
  const [vin, setVin] = React.useState("");
  const [vehicleTrim, setVehicleTrim] = React.useState("");
  const [vehicleColor, setVehicleColor] = React.useState("");
  const [vehicleTitle, setVehicleTitle] = React.useState("");
  const [vehicleDesc, setVehicleDesc] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [camOpen, setCamOpen] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const partSeq = React.useRef(0);
  const newId = () => String(++partSeq.current);

  const partsTotal = parts.reduce((s, p) => s + (p.suggestedPriceUsd || 0), 0);
  const sellable = parts.filter((p) => (p.suggestedPriceUsd || 0) > 0).length;
  const flagged = parts.filter((p) => p.confidence === "low");
  const goodCount = parts.filter((p) => p.condition === "Good").length;
  const chosen = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];
  const photoCount = photos.length;

  // One box — drop everything in (HEIC, JPG, PNG, anything). The AI figures out
  // what each photo is; HEIC is converted to JPEG so it previews & uploads fine.
  async function addFiles(list: FileList | null) {
    if (!list) return;
    const imgs = Array.from(list).filter(looksLikeImage);
    if (!imgs.length) { csToast("Those files weren't images — add JPG, PNG or HEIC photos"); return; }
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { csToast(`You can add up to ${MAX_PHOTOS} photos`); return; }
    const take = imgs.slice(0, room);
    if (take.length < imgs.length) csToast(`Added ${take.length} — ${MAX_PHOTOS}-photo limit reached`);
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
  async function runAnalysis() {
    setPhase("analyzing"); setError(null);
    const prov = provider;
    try {
      const results = await Promise.all(
        photos.map(async (photo) => {
          const dataUrl = await fileToJpegDataUrl(photo.file);
          const res = await fetch("/api/identify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: dataUrl, provider: prov }),
          });
          return { result: (await res.json()) as AIResult, photo };
        })
      );

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

      // Dedupe parts seen across multiple photos by name (keep the priced one).
      const byName = new Map<string, AIPart>();
      for (const p of collected) {
        const key = p.partName.toLowerCase().trim();
        const existing = byName.get(key);
        if (!existing || ((p.suggestedPriceUsd || 0) > (existing.suggestedPriceUsd || 0))) byName.set(key, p);
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
        setVehicle({ label: agg.label, sub: agg.sub || "identified by AI", make: agg.make, model: agg.model, year: agg.year, body: agg.body });
        setSuggestedCarPrice(agg.suggestedPrice);
        setCarPrice(agg.suggestedPrice ? String(agg.suggestedPrice) : "");
        setMileage(agg.mileage);
      } else {
        setVehicle(deriveVehicle(deduped));
        setSuggestedCarPrice(null);
        setCarPrice("");
        setMileage(null);
      }
      setParts(deduped);
      setPhase("results");
    } catch (e) {
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

  const [stockNumber, setStockNumber] = React.useState("");
  const [savingKind, setSavingKind] = React.useState<"post" | "draft" | null>(null);
  // Persist the reviewed vehicle + parts, then reload data and jump to the list.
  // draft=true keeps everything private (status 'draft'), nothing posted to the market.
  async function save(draft = false) {
    setSaving(true);
    setSavingKind(draft ? "draft" : "post");
    try {
      // Encode every uploaded photo to a JPEG data URL so the server can persist
      // them — this is what makes each post carry a real picture.
      const images = await Promise.all(photos.map((p) => fileToJpegDataUrl(p.file)));
      const idxOf = new Map(photos.map((p, i) => [p.url, i]));
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
      if (!res.ok) { csToast(d.error || "Couldn't save — try again"); setSaving(false); setSavingKind(null); return; }
      const dest = sellMode === "whole" ? "vehicles" : "parts";
      csToast(draft
        ? "Saved as draft — not posted yet"
        : sellMode === "whole" ? "Vehicle saved & posted to the market" : `Saved — ${d.listings} part${d.listings === 1 ? "" : "s"} posted`);
      (window as any).csReloadData?.();
      go(dest);
    } catch {
      csToast("Couldn't save — check your connection");
      setSaving(false);
      setSavingKind(null);
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
      <button onClick={() => setMode(null)} style={{ ...navBtn, justifySelf: "start" }}><ArrowLeft size={15} /> Back to options</button>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Step n={1} label="Photos" on={phase === "upload"} done={phase !== "upload"} />
        <span style={{ flex: 1, height: 2, background: "var(--line)", borderRadius: 2, maxWidth: 80 }} />
        <Step n={2} label="AI analysis" on={phase === "analyzing" || phase === "error"} done={phase === "results"} />
        <span style={{ flex: 1, height: 2, background: "var(--line)", borderRadius: 2, maxWidth: 80 }} />
        <Step n={3} label="Review & save" on={phase === "results"} />
      </div>

      {phase === "upload" && (
        <Card pad={22} style={{ display: "grid", gap: 18 }}>
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

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
              <li>📸 Clear, well-lit, slightly <strong style={{ color: "var(--foreground)" }}>angled</strong> shots of <strong style={{ color: "var(--foreground)" }}>every side</strong> — front, rear, both sides, engine bay, interior, dashboard.</li>
              <li>⚠️ Only photographing one side? The AI prices just that side — show the <strong style={{ color: "var(--foreground)" }}>whole car</strong> for full value.</li>
              <li>🔢 Include the <strong style={{ color: "var(--foreground)" }}>VIN plate</strong> if you can — it locks in exact fitment and better prices.</li>
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(7,11,22,0.7)", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={13} color="#fff" /></button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 0" }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>AI model:</span>
            {PROVIDERS.map((p) => {
              const on = provider === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 999, border: `1.5px solid ${on ? p.tone : "var(--line)"}`,
                    background: on ? `color-mix(in srgb, ${p.tone} 14%, transparent)` : "transparent",
                    color: "var(--foreground)", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  }}
                  title={p.desc}
                >
                  {on && <Check size={13} />}
                  {p.name}
                  <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 500 }}>{p.brand}</span>
                </button>
              );
            })}
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
            <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: "3px solid var(--surface2)", borderTopColor: chosen.tone, animation: "spin 0.9s linear infinite" }} />
            <div style={{ position: "absolute", inset: 8, borderRadius: 999, border: "2px solid var(--surface2)", borderBottomColor: "var(--accent)", animation: "spin 1.4s linear infinite reverse" }} />
            <ScanLine size={26} color={chosen.tone} style={{ position: "absolute", inset: 0, margin: "auto" }} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Scanning your car…</div>
            <div style={{ fontSize: 13.5, color: "var(--muted)", maxWidth: 420, marginTop: 6, lineHeight: 1.5 }}>Reading your photos to identify the vehicle and every sellable part — including the VIN or stock number if they show in a picture.</div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "var(--signal)", background: "var(--signal-bg)", border: "1px solid color-mix(in srgb, var(--signal) 35%, transparent)", borderRadius: 999, padding: "7px 14px" }}>
            <Info size={14} /> This might take up to 30 seconds — hang tight.
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
          <Card pad={18} style={{ display: "grid", gap: 14, borderColor: `color-mix(in srgb, ${chosen.tone} 35%, var(--line))` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${chosen.tone} 16%, transparent)` }}><FileText size={17} color={chosen.tone} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>AI analysis report</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Generated by {chosen.name} · {chosen.brand} · {photoCount} photo{photoCount === 1 ? "" : "s"}</div>
              </div>
              <button onClick={() => setPhase("upload")} style={{ ...navBtn, padding: "7px 12px", fontSize: 12.5 }}><ArrowLeft size={14} /> Re-run / edit photos</button>
            </div>

            <div style={{ fontSize: 13.5, color: "var(--foreground)", lineHeight: 1.6, background: "var(--surface2)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
              {vehicle
                ? <>Source vehicle identified as a <strong>{vehicle.sub.split(" · ")[0] ? `${vehicle.sub.split(" · ")[0]} ` : ""}{vehicle.label}</strong>. </>
                : <>Couldn't confidently identify the source vehicle from these photos. </>}
              Cataloged <strong>{parts.length} part{parts.length === 1 ? "" : "s"}</strong> — {goodCount} graded Good, {sellable} with a suggested price, {flagged.length} flagged low-confidence.
            </div>

            <div style={{ display: "grid", gap: 7 }}>
              {vehicle && <ReportLine icon={<Car size={14} color="var(--success)" />} text={`Identified ${vehicle.label} — ${vehicle.sub}.`} />}
              {suggestedCarPrice && <ReportLine icon={<Sparkles size={14} color="var(--signal)" />} text={`AI estimates a whole-car market value around $${suggestedCarPrice.toLocaleString()} (standalone — not the sum of parts).`} />}
              <ReportLine icon={<Wrench size={14} color="var(--success)" />} text={`${sellable} of ${parts.length} part${parts.length === 1 ? "" : "s"} returned a suggested price${partsTotal > 0 ? ` (total $${partsTotal.toLocaleString()})` : ""}.`} />
              {flagged.length > 0
                ? <ReportLine icon={<TriangleAlert size={14} color="var(--signal)" />} text={`${flagged.length} part${flagged.length > 1 ? "s" : ""} flagged for review: ${flagged.map((f) => f.partName).join(", ")}.`} />
                : <ReportLine icon={<CircleCheck size={14} color="var(--success)" />} text="No low-confidence parts — every item came back clean." />}
              {mileage && <ReportLine icon={<Lock size={14} color="var(--muted)" />} text={`Mileage read from dashboard: ${mileage} — kept private, never shown on listings. You can share it in chat if a buyer asks.`} />}
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
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Identified by AI — confirm before posting.</div>
              </div>
              <div style={{ display: "grid", gap: 5, minWidth: 240 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}><ScanLine size={13} color="var(--accent)" /> VIN / plate <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500, opacity: 0.8 }}>· optional</span></label>
                <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} placeholder="Read from your photos — confirm or add" maxLength={17} style={{ border: "1px solid var(--line)", outline: "none", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13.5, padding: "9px 12px", borderRadius: 10, letterSpacing: "0.04em", fontFamily: "var(--font-sans)" }} />
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Kept private — never shown on public listings.</span>
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
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>AI's estimate from the make, model, year, body style, and visible condition in your photos — a typical-market ballpark, not live local comps. Standalone value, separate from the parts below. Check against comparable listings and edit freely.</div>
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
                    The AI couldn't estimate a whole-car price from these photos — set your asking price against comparable local listings.
                  </div>
                )}
              </div>
              {sellMode === "both" && (
                <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--muted)", lineHeight: 1.5, background: "var(--surface2)", borderRadius: 10, padding: "10px 12px" }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>This is your asking price for the whole car. Inside the post, the parts below appear as <strong style={{ color: "var(--foreground)" }}>suggested</strong> prices — buyers can take the car or pick parts. The two prices are independent.</span>
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
                {parts.map((p, idx) => {
                  const warn = p.confidence === "low";
                  const price = p.suggestedPriceUsd || 0;
                  return (
                    <div key={p._id} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: "var(--radius-md)", flexWrap: "wrap", background: warn ? "var(--signal-bg)" : "var(--surface)", border: `1px solid ${warn ? "color-mix(in srgb, var(--signal) 40%, transparent)" : "var(--line)"}` }}>
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
                        <textarea value={p.description || ""} placeholder="Description — AI fills this in; tap to edit" rows={2} onChange={(e) => setPartDesc(p._id!, e.target.value)} style={{ width: "100%", marginTop: 4, fontSize: 12.5, color: "var(--muted)", border: "1px solid transparent", outline: "none", background: "transparent", resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.45, borderRadius: 8, padding: "4px 6px" }} onFocus={(e) => { e.target.style.borderColor = "var(--line)"; e.target.style.color = "var(--foreground)"; }} onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.color = "var(--muted)"; }} />
                      </div>
                      <ConditionBadge grade={p.condition} size="sm" />
                      <div style={{ width: 110, display: "grid", gap: 2, justifyItems: "end" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 3, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 9, padding: "6px 11px" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: price > 0 ? "var(--success)" : "var(--muted)" }}>$</span>
                          <input type="number" min={0} value={p.suggestedPriceUsd ?? ""} placeholder="0" onChange={(e) => setPartPrice(p._id!, e.target.value)} className="tnum" style={{ width: 72, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 15, fontWeight: 700, textAlign: "right" }} />
                        </div>
                        {sellMode === "both" && <span style={{ fontSize: 10, color: "var(--muted)" }}>suggested</span>}
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
                  <div className="tnum" style={{ fontSize: 22, fontWeight: 800, color: carPriceNum > 0 ? "var(--success)" : "var(--muted)" }}>{carPriceNum > 0 ? `$${carPriceNum.toLocaleString()}` : "—"}</div>
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
    { id: "ai", icon: Sparkles, title: "Scan with AI", desc: "Upload photos — AI finds the car, every part, condition, and prices.", fast: true },
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
