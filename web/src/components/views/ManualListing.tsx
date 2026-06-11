"use client";

import React from "react";
import { ArrowLeft, Upload, Camera, X, Sparkles, ScanLine, Check, Car, Wrench, Info, ChevronDown, ScanSearch, LoaderCircle } from "lucide-react";
import { Card } from "../UI";
import { csToast } from "../Dashboard";
import { looksLikeImage, normalizeImageFile, fileToJpegDataUrl } from "@/lib/image";

interface Photo { url: string; name: string; file: File }
const MAX_PHOTOS = 8;

// Standard salvage parts catalog — used for the VIN "what's on this car" checklist
// and the manual part-type picker. NHTSA decode gives specs, not parts, so this is
// the canonical list a seller picks from.
const CATALOG: { cat: string; parts: string[] }[] = [
  { cat: "Body", parts: ["Hood", "Front Bumper Cover", "Rear Bumper Cover", "Grille", "Front Fender", "Rear Quarter Panel", "Front Door", "Rear Door", "Trunk Lid", "Tailgate", "Roof Panel", "Side Mirror"] },
  { cat: "Glass", parts: ["Windshield", "Back Glass", "Front Door Window", "Rear Door Window"] },
  { cat: "Lighting", parts: ["Headlight Assembly", "Tail Light Assembly", "Fog Light"] },
  { cat: "Mechanical", parts: ["Engine", "Transmission", "Radiator", "Alternator", "Starter", "AC Compressor", "Battery"] },
  { cat: "Wheels & Tires", parts: ["Wheel (set of 4)", "Tire"] },
  { cat: "Interior", parts: ["Front Seat", "Rear Seat", "Steering Wheel", "Center Console", "Dashboard", "Instrument Cluster", "Airbag", "Door Panel"] },
];
const ALL_PARTS = CATALOG.flatMap((c) => c.parts);
function catOf(part: string): string {
  return CATALOG.find((c) => c.parts.includes(part))?.cat || "Uncategorized";
}

const field: React.CSSProperties = { border: "1px solid var(--line)", outline: "none", background: "var(--surface2)", color: "var(--foreground)", fontSize: 14, padding: "10px 12px", borderRadius: 10, fontFamily: "var(--font-sans)", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5, display: "block" };
const navBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 11, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 14, fontWeight: 600, cursor: "pointer" };

export function ManualListing({ kind, onBack, go }: { kind: "car" | "part"; onBack: () => void; go: (id: string) => void }) {
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  // AI pricing guidance (PRC-1/PRC-2): range, trim prompt, volatile-commodity flag.
  const [priceRange, setPriceRange] = React.useState<{ min: number; max: number } | null>(null);
  const [variantPrompt, setVariantPrompt] = React.useState("");
  const [priceVolatile, setPriceVolatile] = React.useState(false);
  // Vehicle / fitment
  const [year, setYear] = React.useState("");
  const [make, setMake] = React.useState("");
  const [model, setModel] = React.useState("");
  const [trim, setTrim] = React.useState("");
  const [body, setBody] = React.useState("");
  const [vin, setVin] = React.useState("");
  const [mileage, setMileage] = React.useState("");
  // Part-only
  const [partName, setPartName] = React.useState("");
  const [condition, setCondition] = React.useState<"A" | "B" | "C">("B");
  // VIN parts checklist (car)
  const [vinParts, setVinParts] = React.useState<string[] | null>(null);
  const [selParts, setSelParts] = React.useState<Set<string>>(new Set());
  // busy
  const [busy, setBusy] = React.useState<null | "scan" | "write" | "vin" | "save">(null);

  const fileRef = React.useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const imgs = Array.from(list).filter(looksLikeImage);
    if (!imgs.length) { csToast("Add JPG, PNG or HEIC photos"); return; }
    const room = MAX_PHOTOS - photos.length;
    const take = imgs.slice(0, Math.max(0, room));
    const mapped = await Promise.all(take.map(async (f) => { const file = await normalizeImageFile(f); return { url: URL.createObjectURL(file), name: f.name, file }; }));
    setPhotos((p) => [...p, ...mapped].slice(0, MAX_PHOTOS));
  }
  function removePhoto(i: number) { setPhotos((p) => { const n = [...p]; const [g] = n.splice(i, 1); if (g) URL.revokeObjectURL(g.url); return n; }); }

  const vehicleObj = () => ({ year, make, model, trim, body });
  const vehStr = [year, make, model].filter(Boolean).join(" ");

  // Groq vision (no Gemini) autofills fields from the first photo + drafts copy.
  async function scanPhoto() {
    if (!photos.length || busy) return;
    setBusy("scan");
    try {
      const imageBase64 = await fileToJpegDataUrl(photos[0].file);
      const r = await fetch("/api/assistant/listing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, imageBase64, partName, vehicle: vehicleObj(), condition }) });
      const d = await r.json();
      if (!d.ok) { csToast(d.error || "Couldn't read that photo"); setBusy(null); return; }
      const v = d.vehicle;
      if (v) { if (v.make) setMake(v.make); if (v.model) setModel(v.model); if (v.year) setYear(String(v.year)); if (v.body) setBody(v.body); if (v.mileage && kind === "car") setMileage(v.mileage); }
      if (kind === "part" && d.partName) setPartName(d.partName);
      if (["A", "B", "C"].includes(d.condition)) setCondition(d.condition);
      if (d.title) setTitle(d.title);
      if (d.description) setDescription(d.description);
      if (d.suggestedPriceUsd != null && !price) setPrice(String(d.suggestedPriceUsd));
      csToast("Filled from your photo — edit anything");
    } catch { csToast("Scan failed — try again"); }
    setBusy(null);
  }

  // Groq draft of title + description + suggested price.
  async function writeWithAI() {
    if (busy) return;
    if (kind === "part" && !partName.trim()) { csToast("Pick or type the part first"); return; }
    if (kind === "car" && !make && !model) { csToast("Add the make/model (or scan/decode) first"); return; }
    setBusy("write");
    try {
      const r = await fetch("/api/assistant/listing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, partName, vehicle: vehicleObj(), condition, mileage, notes: description }) });
      const d = await r.json();
      if (!d.ok) { csToast(d.error || "AI assist failed"); setBusy(null); return; }
      if (d.title) setTitle(d.title);
      if (d.description) setDescription(d.description);
      if (d.suggestedPriceUsd != null && !price) setPrice(String(d.suggestedPriceUsd));
      setPriceRange(d.priceRange || null);
      setVariantPrompt(d.needsVariant && d.variantPrompt ? d.variantPrompt : "");
      setPriceVolatile(!!d.volatile);
      csToast(d.needsVariant ? "Drafted — tell me the variant for a tighter price" : "Drafted with AI — edit before posting");
    } catch { csToast("AI assist failed"); }
    setBusy(null);
  }

  async function decodeVin() {
    if (busy || vin.trim().length < 11) { if (vin.trim().length < 11) csToast("Enter the full VIN (17 chars)"); return; }
    setBusy("vin");
    try {
      const r = await fetch("/api/vin-decode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vin: vin.trim() }) });
      const d = await r.json();
      if (!d.ok) { csToast(d.error || "Couldn't decode that VIN"); setBusy(null); return; }
      const dec = d.decode || {};
      if (dec.make) setMake(dec.make); if (dec.model) setModel(dec.model);
      if (dec.year) setYear(String(dec.year)); if (dec.bodyClass || dec.body) setBody(dec.bodyClass || dec.body);
      if (dec.trim) setTrim(dec.trim);
      // Show the standard parts checklist for this car; seller keeps what they have.
      setVinParts(ALL_PARTS);
      setSelParts(new Set());
      csToast(`Decoded ${[dec.year, dec.make, dec.model].filter(Boolean).join(" ")} — pick the parts you have`);
    } catch { csToast("VIN decode failed"); }
    setBusy(null);
  }

  function toggleSel(p: string) { setSelParts((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; }); }

  async function save(draft: boolean) {
    if (busy) return;
    if (kind === "car" && !make && !model && !title.trim()) { csToast("Add at least the make/model or a title"); return; }
    if (kind === "part" && !partName.trim()) { csToast("Pick or type the part"); return; }
    setBusy("save");
    try {
      const images = photos.length ? await Promise.all(photos.map((p) => fileToJpegDataUrl(p.file))) : [];
      const priceNum = price === "" ? null : Number(price);
      let payload: any;
      if (kind === "car") {
        const extraParts = [...selParts].map((name) => ({ partName: name, partCategory: catOf(name), fitment: make ? [{ make, model, yearStart: Number(year) || 0, yearEnd: Number(year) || 0 }] : [], condition: "B", conditionNotes: "", description: "", suggestedPriceUsd: null, confidence: "high", photoIndex: 0 }));
        payload = {
          sellMode: selParts.size ? "both" : "whole",
          carPrice: priceNum, mileage: mileage || null, draft, images, heroIndex: 0,
          vehicle: { make, model, year, trim, body, vin: vin.trim() || undefined, title: title.trim() || undefined, description: description.trim() || undefined, photos: photos.length },
          parts: extraParts,
        };
      } else {
        payload = {
          sellMode: "parts", draft, images, heroIndex: 0,
          vehicle: { make, model, year, photos: photos.length },
          parts: [{ partName: partName.trim(), partCategory: catOf(partName.trim()) || "Uncategorized", fitment: make ? [{ make, model, yearStart: Number(year) || 0, yearEnd: Number(year) || 0 }] : [], condition, conditionNotes: "", description: description.trim(), suggestedPriceUsd: priceNum, confidence: "high", photoIndex: 0 }],
        };
      }
      const res = await fetch("/api/listings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json();
      if (!res.ok) { csToast(d.error || "Couldn't save — try again"); setBusy(null); return; }
      csToast(draft ? "Saved as draft" : kind === "car" ? "Car posted to the market" : "Part posted to the market");
      (window as any).csReloadData?.();
      go(kind === "car" ? "vehicles" : "parts");
    } catch { csToast("Couldn't save — check your connection"); setBusy(null); }
  }

  const isCar = kind === "car";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 18 }}>
      <button onClick={onBack} style={{ ...navBtn, justifySelf: "start" }}><ArrowLeft size={15} /> Back</button>

      <Card style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 42, height: 42, borderRadius: 11, background: "var(--accent-tint)", display: "grid", placeItems: "center" }}>{isCar ? <Car size={20} color="var(--accent)" /> : <Wrench size={20} color="var(--accent)" />}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{isCar ? "List a car manually" : "List a part manually"}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Fill it in yourself — photos optional. Use AI to help write & price.</div>
          </div>
        </div>

        {/* Photos (optional) */}
        <div>
          <span style={lbl}>Photos · optional</span>
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => fileRef.current?.click()} style={navBtn}><Upload size={15} /> Add photos</button>
            {photos.length > 0 && (
              <button onClick={scanPhoto} disabled={!!busy} style={{ ...navBtn, borderColor: "var(--accent)", color: "var(--accent)" }}>{busy === "scan" ? <LoaderCircle size={15} className="spin" /> : <ScanSearch size={15} />} Scan photo to fill</button>
            )}
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{photos.length}/{MAX_PHOTOS}</span>
          </div>
          {photos.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8, marginTop: 10 }}>
              {photos.map((f, i) => (
                <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 9, overflow: "hidden", border: "1px solid var(--line)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: 999, border: "none", background: "rgba(7,11,22,0.7)", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={12} color="#fff" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Part type (part only) */}
        {!isCar && (
          <div>
            <span style={lbl}>Part</span>
            <input list="cs-parts" value={partName} onChange={(e) => setPartName(e.target.value)} placeholder="e.g. Engine, Headlight Assembly, Front Door" style={field} />
            <datalist id="cs-parts">{ALL_PARTS.map((p) => <option key={p} value={p} />)}</datalist>
          </div>
        )}

        {/* Vehicle / fitment */}
        <div>
          <span style={lbl}>{isCar ? "Vehicle" : "Fits (vehicle)"}</span>
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 1fr", gap: 8 }}>
            <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" style={field} />
            <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Make" style={field} />
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" style={field} />
          </div>
          {isCar && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <input value={trim} onChange={(e) => setTrim(e.target.value)} placeholder="Trim (optional)" style={field} />
              <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body style (optional)" style={field} />
            </div>
          )}
        </div>

        {/* VIN (car) → parts checklist */}
        {isCar && (
          <div>
            <span style={lbl}>VIN · optional</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} maxLength={17} placeholder="Decode to auto-fill + list the car's parts" style={{ ...field, letterSpacing: "0.04em" }} />
              <button onClick={decodeVin} disabled={!!busy} style={{ ...navBtn, flexShrink: 0 }}>{busy === "vin" ? <LoaderCircle size={15} className="spin" /> : <ScanLine size={15} />} Decode</button>
            </div>
            {vinParts && (
              <div style={{ marginTop: 12, border: "1px solid var(--line)", borderRadius: 10, padding: 12, background: "var(--surface2)" }}>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>Parts commonly on this car — <strong style={{ color: "var(--foreground)" }}>check the ones you actually have</strong> to post them too ({selParts.size} selected).</div>
                {CATALOG.map((c) => (
                  <div key={c.cat} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>{c.cat}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {c.parts.map((p) => { const on = selParts.has(p); return (
                        <button key={p} onClick={() => toggleSel(p)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`, background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--foreground)" }}>{on && <Check size={12} />}{p}</button>
                      ); })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Condition (part) */}
        {!isCar && (
          <div>
            <span style={lbl}>Grade</span>
            <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
              {([["A", "#22C55E"], ["B", "#F59E0B"], ["C", "#EF4444"]] as const).map(([g, col]) => (
                <button key={g} onClick={() => setCondition(g)} title={`Grade ${g}`} style={{ padding: "9px 20px", border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, background: condition === g ? col : "transparent", color: condition === g ? "#fff" : "var(--muted)" }}>{g}</button>
              ))}
            </div>
          </div>
        )}

        {/* Title + description + price with AI assist */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <span style={{ ...lbl, marginBottom: 0 }}>Listing details</span>
            <button onClick={writeWithAI} disabled={!!busy} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>{busy === "write" ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />} Write with AI</button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={{ ...field, fontWeight: 600 }} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description — what it is, condition, fitment" rows={4} style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />
            {isCar && <input value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="Mileage (optional, e.g. 112,480 mi)" style={field} />}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Price</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 9, padding: "8px 12px", flex: 1, maxWidth: 200 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: Number(price) > 0 ? "var(--success)" : "var(--muted)" }}>$</span>
                <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="tnum" style={{ border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 16, fontWeight: 700, width: "100%" }} />
              </div>
              {priceRange && (
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  AI range: <b style={{ color: "var(--foreground)" }}>${priceRange.min.toLocaleString()}–${priceRange.max.toLocaleString()}</b>
                </span>
              )}
            </div>
            {variantPrompt && (
              <div style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--foreground)", lineHeight: 1.5, background: "color-mix(in srgb, var(--signal) 12%, transparent)", border: "1px solid var(--signal)", borderRadius: 10, padding: "9px 12px" }}>
                <Info size={14} color="var(--signal)" style={{ flexShrink: 0, marginTop: 1 }} />
                <span><b>This part is priced by variant.</b> {variantPrompt} Add it to the title/description and adjust the price — the range above spans the options.</span>
              </div>
            )}
            {priceVolatile && (
              <div style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--foreground)", lineHeight: 1.5, background: "color-mix(in srgb, var(--signal) 12%, transparent)", border: "1px solid var(--signal)", borderRadius: 10, padding: "9px 12px" }}>
                <Info size={14} color="var(--signal)" style={{ flexShrink: 0, marginTop: 1 }} />
                <span><b>Volatile commodity.</b> This price moves with metal/core markets — verify with a current core buyer before quoting.</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--muted)", lineHeight: 1.5, background: "var(--surface2)", borderRadius: 10, padding: "10px 12px" }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} /><span>Everything here is editable. AI helpers just give you a starting point — nothing posts until you hit save.</span>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={() => save(true)} disabled={!!busy} style={navBtn}>{busy === "save" ? <LoaderCircle size={15} className="spin" /> : null} Save as draft</button>
          <button onClick={() => save(false)} disabled={!!busy} className="cs-raise" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>{busy === "save" ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />} {isCar ? "Post car" : "Post part"}</button>
        </div>
      </Card>
    </div>
  );
}
