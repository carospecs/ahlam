"use client";

import React from "react";
import { Car, Wrench, ChevronLeft, Copy, Send, Sparkles, ScanLine, Check, CheckCircle2, Pencil, Lightbulb, LoaderCircle, ChevronDown, ChevronRight, Building, Cpu, Fuel, Gauge, Hash, AlertTriangle, Trash2 } from "lucide-react";
import { Card, PhotoCell, ConditionBadge, SellModeBadge, StatusBadge } from "../UI";
import { buildVehicleText, partsForVehicle, SELL_MODE } from "../data";
import { csToast, useData } from "../Dashboard";
import { PricingToggle } from "../PricingToggle";

export function VehicleProfile({ v, onBack, go }: { v: any; onBack: () => void; go: (id: string) => void }) {
  const { listings } = useData();
  // Prefer the shop's real listings linked to this vehicle; fall back to the
  // demo set so sample/static vehicles still render parts.
  const liveParts = (listings || []).filter((l: any) => l.vehicleId === v.id);
  const parts = liveParts.length ? liveParts : partsForVehicle(v);

  const [sellMode, setSellMode] = React.useState<string>(v.sellMode || "parts");
  const [pendingMode, setPendingMode] = React.useState<string>(v.sellMode || "parts");
  const [savingMode, setSavingMode] = React.useState(false);
  // Which parts are ticked for the bulk "Post" action (selection only — does
  // not change a part's live status). Seeds to all parts.
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(parts.map((p: any) => p.id)));
  // Track which parts have their edit panel open.
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  // Local price overrides so inline edits show immediately before reload.
  const [prices, setPrices] = React.useState<Record<string, number>>({});
  // Local description overrides per part.
  const [partDescs, setPartDescs] = React.useState<Record<string, string>>({});
  // Per-part saving indicator.
  const [savingParts, setSavingParts] = React.useState<Set<string>>(new Set());
  // Active pricing source per part (asking / ebay / ai).
  const [priceSource, setPriceSource] = React.useState<Record<string, string>>({});

  // Whole-car editable fields (title, description, the fill-in suggestion
  // fields, and status) — saved together via "Save changes".
  const [vehTitle, setVehTitle] = React.useState<string>(v.title || "");
  const [vehDesc, setVehDesc] = React.useState<string>(v.description || "");
  const [vehMileage, setVehMileage] = React.useState<string>(v.mileage || "");
  const [vehPrice, setVehPrice] = React.useState<string>(v.askingPrice != null ? String(v.askingPrice) : "");
  // What the yard paid for the car — private, drives the profit dashboard.
  const [vehCost, setVehCost] = React.useState<string>(v.acquisitionCost != null ? String(v.acquisitionCost) : "");
  const [vehStatus, setVehStatus] = React.useState<string>(uiStatus(v.status));
  const [savingVeh, setSavingVeh] = React.useState(false);

  const mode = SELL_MODE[sellMode];
  // parts → parts only · whole → car only · both → both areas in one page.
  const showCar = sellMode === "whole" || sellMode === "both";
  const showParts = sellMode === "parts" || sellMode === "both";
  const priceOf = (p: any) => (prices[p.id] != null ? prices[p.id] : p.price);
  const partsValue = parts.reduce((s: number, p: any) => s + priceOf(p), 0);
  const selectedCount = parts.filter((p: any) => selected.has(p.id)).length;

  const toggleSel = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected((prev) => prev.size === parts.length ? new Set() : new Set(parts.map((p: any) => p.id)));
  const allSelected = selected.size === parts.length;

  // Apply the pending sell-mode change (explicit Submit, not on every click).
  async function submitMode() {
    if (pendingMode === sellMode || savingMode) return;
    const prev = sellMode;
    setSavingMode(true);
    try {
      const r = await fetch("/api/listings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicleId: v.id, sellMode: pendingMode }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't update"); }
      else { setSellMode(pendingMode); csToast(`Now selling as ${SELL_MODE[pendingMode].label}`); (window as any).csReloadData?.(); }
    } catch { csToast("Couldn't update — check your connection"); setPendingMode(prev); }
    setSavingMode(false);
  }

  // Post the whole vehicle to the marketplace.
  async function postVehicle() {
    if (savingMode) return;
    setSavingMode(true);
    try {
      const r = await fetch("/api/listings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicleId: v.id, status: "active" }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't post"); }
      else { csToast("Posted this vehicle to the marketplace"); (window as any).csReloadData?.(); }
    } catch { csToast("Couldn't post — check your connection"); }
    setSavingMode(false);
  }

  // Post selected parts to the marketplace.
  async function postSelected() {
    if (savingMode || !selectedCount) return;
    setSavingMode(true);
    const ids = parts.filter((p: any) => selected.has(p.id)).map((p: any) => p.id);
    try {
      const r = await fetch("/api/listings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingIds: ids, status: "active" }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't post"); }
      else { csToast(`Posted ${ids.length} selected part${ids.length === 1 ? "" : "s"}`); (window as any).csReloadData?.(); }
    } catch { csToast("Couldn't post — check your connection"); }
    setSavingMode(false);
  }

  // Bulk-update status for all selected parts.
  async function bulkStatus(status: string) {
    if (savingMode || !selectedCount) return;
    setSavingMode(true);
    const ids = parts.filter((p: any) => selected.has(p.id)).map((p: any) => p.id);
    try {
      const r = await fetch("/api/listings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingIds: ids, status }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't update"); }
      else { csToast(`Marked ${ids.length} part${ids.length === 1 ? "" : "s"} as ${status}`); (window as any).csReloadData?.(); }
    } catch { csToast("Couldn't update — check your connection"); }
    setSavingMode(false);
  }

  // Soft-delete all selected parts (they leave the market and this list).
  async function bulkDelete() {
    if (savingMode || !selectedCount) return;
    const ids = parts.filter((p: any) => selected.has(p.id)).map((p: any) => p.id);
    if (!window.confirm(`Delete ${ids.length} part${ids.length === 1 ? "" : "s"}? They come off the marketplace and out of your inventory.`)) return;
    setSavingMode(true);
    try {
      const r = await fetch("/api/listings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingIds: ids }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't delete"); }
      else { csToast(`Deleted ${ids.length} part${ids.length === 1 ? "" : "s"}`); setSelected(new Set()); (window as any).csReloadData?.(); }
    } catch { csToast("Couldn't delete — check your connection"); }
    setSavingMode(false);
  }

  // Soft-delete a single part from its edit panel.
  async function deletePart(id: string, p: any) {
    if (savingParts.has(id)) return;
    if (!window.confirm(`Delete "${p.part || "this part"}"? It comes off the marketplace and out of your inventory.`)) return;
    setSavingParts((prev) => new Set(prev).add(id));
    try {
      const r = await fetch("/api/listings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: id }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't delete"); }
      else { csToast("Part deleted"); (window as any).csReloadData?.(); }
    } catch { csToast("Couldn't delete — check your connection"); }
    setSavingParts((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  // Soft-delete the whole vehicle post (its part listings go with it).
  const [deletingVeh, setDeletingVeh] = React.useState(false);
  async function deleteVehicle() {
    if (deletingVeh) return;
    if (!window.confirm(`Delete this ${v.year} ${v.make} ${v.model} and all its parts? Everything comes off the marketplace and out of your inventory.`)) return;
    setDeletingVeh(true);
    try {
      const r = await fetch("/api/listings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicleId: v.id }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't delete"); }
      else { csToast("Vehicle deleted"); (window as any).csReloadData?.(); onBack(); }
    } catch { csToast("Couldn't delete — check your connection"); }
    setDeletingVeh(false);
  }

  // Toggle the inline edit panel for a part.
  const toggleExpand = (id: string) => setExpanded((prev) => {
    const n = new Set(prev);
    if (n.has(id)) { n.delete(id); setEditForm((ef) => { const copy = { ...ef }; delete copy[id]; return copy; }); }
    else n.add(id);
    return n;
  });

  // Local form state for each open part panel.
  const [editForm, setEditForm] = React.useState<Record<string, { name: string; price: string; desc: string; status: string; condition: string; category: string; conditionNotes: string; fitment: string }>>({});
  const formOf = (p: any) => editForm[p.id] || {
    name: p.part || "", price: String(priceOf(p)), desc: p.desc || p.description || "", status: uiStatus(p.status),
    condition: p.grade === "Poor" ? "C" : p.grade === "Good" ? "B" : (["A","B","C"].includes(p.grade) ? p.grade : "B"), category: p.category || "", conditionNotes: p.note || "", fitment: p.fitment || "",
  };
  const setField = (id: string, p: any, patch: Partial<{ name: string; price: string; desc: string; status: string; condition: string; category: string; conditionNotes: string; fitment: string }>) =>
    setEditForm((ef) => ({ ...ef, [id]: { ...(ef[id] || formOf(p)), ...patch } }));

  // Persist all editable fields for a single part listing.
  async function savePart(id: string, p: any) {
    if (savingParts.has(id)) return;
    const f = editForm[id] || formOf(p);
    setSavingParts((prev) => new Set(prev).add(id));
    const num = Number(f.price);
      const body: Record<string, any> = { listingId: id, status: apiStatus(f.status) };
    if (f.name?.trim()) body.partName = f.name.trim();
    if (Number.isFinite(num) && num >= 0) { body.priceUsd = num; setPrices((pr) => ({ ...pr, [id]: num })); }
    if (f.desc != null) { body.description = f.desc; setPartDescs((pd) => ({ ...pd, [id]: f.desc })); }
    if (f.condition) body.condition = f.condition;
    if (f.category) body.category = f.category;
    if (f.conditionNotes != null) body.conditionNotes = f.conditionNotes;
    if (f.fitment != null) body.fitment = f.fitment;
    try {
      const r = await fetch("/api/listings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't save"); }
      else { csToast("Part saved"); toggleExpand(id); (window as any).csReloadData?.(); }
    } catch { csToast("Couldn't save — check your connection"); }
    setSavingParts((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  function copyCar() {
    try { navigator.clipboard && navigator.clipboard.writeText(buildVehicleText(v)); } catch (e) {}
    csToast("Whole-car listing copied");
  }

  async function saveVehicle() {
    if (savingVeh) return;
    setSavingVeh(true);
    try {
      const r = await fetch("/api/listings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: v.id, title: vehTitle, description: vehDesc, mileage: vehMileage, askingPrice: vehPrice, acquisitionCostCents: vehCost.trim() === "" ? "" : Math.round(Number(vehCost) * 100), status: apiStatus(vehStatus) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { csToast(d.error || "Couldn't save"); }
      else { csToast(d.titleSkipped ? "Saved (title needs migration 0015)" : "Changes saved"); (window as any).csReloadData?.(); }
    } catch { csToast("Couldn't save — check your connection"); }
    setSavingVeh(false);
  }

  // ── VIN history ──
  const [vinOpen, setVinOpen] = React.useState(false);
  const [vinData, setVinData] = React.useState<any>(null);
  const [vinLoading, setVinLoading] = React.useState(false);
  async function decodeVin() {
    if (!v.vin || vinData) { setVinOpen((o) => !o); return; }
    setVinLoading(true);
    try {
      const r = await fetch(`/api/vin-decode?vin=${encodeURIComponent(v.vin)}`);
      const d = await r.json();
      setVinData(d.ok ? d.decode : null);
    } catch { setVinData(null); }
    setVinLoading(false);
    setVinOpen(true);
  }

  // Static "what to add" hints for a stronger whole-car listing.
  const suggestions = [
    { ok: !!v.askingPrice, text: "Set an asking price so buyers can filter by budget" },
    { ok: !!v.mileage, text: "Add mileage — it's the first thing buyers ask" },
    { ok: (v.photos || 0) >= 4, text: "Upload at least 4 photos (exterior, interior, engine, damage)" },
    { ok: !!v.vin, text: "Include the VIN so buyers can run a history report" },
    { ok: false, text: "Mention title status (clean / salvage / rebuilt) and whether it runs" },
  ];

  return (
    <div style={{ maxWidth: 1080, display: "grid", gap: 18 }}>
      {/* Header row: keep navigation and the destructive action separate. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "transparent", color: "var(--muted)", fontSize: 13.5, fontWeight: 600, padding: 0, width: "fit-content" }}><ChevronLeft size={16} /> Back to shop vehicles</button>
        <button onClick={deleteVehicle} disabled={deletingVeh} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: "1px solid color-mix(in srgb, var(--signal) 45%, transparent)", background: "transparent", color: "var(--signal)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", opacity: deletingVeh ? 0.6 : 1 }}>
          {deletingVeh ? <LoaderCircle size={14} className="spin" /> : <Trash2 size={14} />} Delete vehicle
        </button>
      </div>

      <Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr" }} className="cs-veh-hero">
          <VehicleGallery v={v} />
          <div style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SellModeBadge mode={sellMode} />
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{mode.desc}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>What are you selling?</span>
              <div style={{ display: "inline-flex", gap: 4, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 10, padding: 3 }}>
                {(["parts", "whole", "both"] as const).map((m) => {
                  const on = pendingMode === m;
                  const IconComp = m === "parts" ? Wrench : m === "whole" ? Car : CheckCircle2;
                  return (
                    <button key={m} onClick={() => setPendingMode(m)} disabled={savingMode} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "none", background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: savingMode ? "default" : "pointer" }}>
                      <IconComp size={13} /> {SELL_MODE[m].short}{on && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={submitMode}
                disabled={savingMode || pendingMode === sellMode}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, border: "none", background: pendingMode === sellMode ? "var(--surface2)" : "var(--accent)", color: pendingMode === sellMode ? "var(--muted)" : "#fff", fontSize: 12.5, fontWeight: 700, cursor: pendingMode === sellMode ? "default" : "pointer", opacity: savingMode ? 0.6 : 1 }}
              >
                <Check size={13} /> {savingMode ? "Saving…" : "Save posting type"}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45, marginTop: 5 }}>
              Parts only shows the individual parts. Whole car shows one vehicle listing. Car + parts keeps both. Your title, description, photos, and VIN stay saved when you switch.
            </div>
            <h2 style={{ margin: "12px 0 0", fontSize: 24, fontWeight: 800 }}>{v.year} {v.make} {v.model} {v.trim}</h2>
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}>{v.body} · {v.color} · {v.mileage}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 12.5, color: "var(--muted)" }}>
              <ScanLine size={14} /> VIN {v.vin}
            </div>
            {v.stock_number && <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4, fontSize: 12.5, color: "var(--muted)" }}><Hash size={14} /> Stock #{v.stock_number}</div>}
            <div style={{ display: "flex", gap: 28, marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
              {showCar && <Stat label="Asking price" value={`$${v.askingPrice?.toLocaleString()}`} tone="var(--signal)" />}
              <Stat label="Parts identified" value={parts.length} />
              <Stat label="Parts value" value={`$${partsValue.toLocaleString()}`} tone="var(--success)" />
              <Stat label="Sold" value={v.sold} />
            </div>
          </div>
        </div>
      </Card>

      {/* VIN history report */}
      {v.vin && (
        <Card pad={0} style={{ overflow: "hidden" }}>
          <button onClick={decodeVin} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", border: "none", background: "transparent", color: "var(--foreground)", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", textAlign: "left" }}>
            <ScanLine size={16} color="var(--accent)" />
            <span style={{ flex: 1 }}>VIN history report</span>
            <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{v.vin}</span>
            {vinLoading ? <LoaderCircle size={16} className="spin" /> : vinOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {vinOpen && (
            <div style={{ padding: "0 18px 16px", display: "grid", gap: 10 }}>
              {vinLoading && <div style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>Decoding VIN…</div>}
              {!vinLoading && !vinData && <div style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>Could not decode this VIN.</div>}
              {vinData && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {vinData.make && <VINField icon={Building} label="Company/Brand" value={vinData.make} />}
                    {vinData.model && <VINField icon={Car} label="Model" value={vinData.model} />}
                    {vinData.year && <VINField icon={Hash} label="Year" value={String(vinData.year)} />}
                    {vinData.trim && <VINField icon={Car} label="Trim" value={vinData.trim} />}
                    {vinData.bodyClass && <VINField icon={Car} label="Body" value={vinData.bodyClass} />}
                    {vinData.engine && <VINField icon={Cpu} label="Engine" value={vinData.engine} />}
                    {vinData.engineCylinders && <VINField icon={Cpu} label="Cylinders" value={vinData.engineCylinders} />}
                    {vinData.displacement && <VINField icon={Gauge} label="Displacement" value={`${vinData.displacement} CC`} />}
                    {vinData.fuelType && <VINField icon={Fuel} label="Fuel" value={vinData.fuelType} />}
                    {vinData.transmission && <VINField icon={Wrench} label="Transmission" value={vinData.transmission} />}
                    {vinData.driveType && <VINField icon={Wrench} label="Drive" value={vinData.driveType} />}
                    {vinData.manufacturer && <VINField icon={Building} label="Manufacturer" value={vinData.manufacturer} />}
                    {vinData.plantCity && <VINField icon={Building} label="Plant" value={[vinData.plantCity, vinData.plantState, vinData.plantCountry].filter(Boolean).join(", ")} />}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 4 }}>
                    Data from NHTSA · may not include accident history or title status
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      )}

      {showCar && (
        <Card pad={18}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Car size={16} color="var(--signal)" /> Whole-car listing</span>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>This is what buyers see when you sell the complete vehicle.</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Listing status</span>
              <StatusPicker value={vehStatus} onChange={setVehStatus} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={fieldLabel}>Title</div>
            <input value={vehTitle} onChange={(e) => setVehTitle(e.target.value)} placeholder={`${v.year} ${v.make} ${v.model} ${v.trim || ""}`.trim()} style={fieldInput} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={fieldLabel}>Description</div>
            <textarea value={vehDesc} onChange={(e) => setVehDesc(e.target.value)} rows={4} placeholder="Describe the vehicle — condition, history, what's included…" style={{ ...fieldInput, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit" }} />
          </div>

          {/* Suggestions: fill in the blanks buyers always ask for. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}><Lightbulb size={14} color="var(--signal)" /> Details buyers want</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }} className="cs-grid-2">
            <div>
              <div style={fieldLabel}>Asking price ($)</div>
              <input type="number" value={vehPrice} onChange={(e) => setVehPrice(e.target.value)} placeholder="e.g. 8500" className="tnum" style={fieldInput} />
            </div>
            <div>
              <div style={fieldLabel}>Mileage</div>
              <input value={vehMileage} onChange={(e) => setVehMileage(e.target.value)} placeholder="e.g. 92,400 mi" style={fieldInput} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={fieldLabel}>What you paid for this car ($) <span style={{ fontWeight: 400, color: "var(--muted)" }}>· private — used only for your profit tracking</span></div>
            <input type="number" value={vehCost} onChange={(e) => setVehCost(e.target.value)} placeholder="e.g. 1200" className="tnum" style={fieldInput} />
          </div>
          {suggestions.filter((s) => !s.ok).length > 0 && (
            <div style={{ display: "grid", gap: 5, marginBottom: 14 }}>
              {suggestions.filter((s) => !s.ok).map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--muted)" }}>
                  <Lightbulb size={12} color="var(--signal)" style={{ flexShrink: 0 }} /> {s.text}
                </div>
              ))}
            </div>
          )}

          <button onClick={saveVehicle} disabled={savingVeh} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, opacity: savingVeh ? 0.6 : 1 }}>
            {savingVeh ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} {savingVeh ? "Saving…" : "Save changes"}
          </button>
        </Card>
      )}

      {showParts && (
        <Card pad={0}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Wrench size={16} color="var(--accent)" /> Parts from this car <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {parts.length}</span></span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BulkAction
                label={selectedCount > 0 ? `${selectedCount} selected` : "Bulk actions"}
                disabled={!selectedCount}
                actions={[
                  { label: "Post", action: postSelected },
                  { label: "Mark as Draft", action: () => bulkStatus("Draft") },
                  { label: "Mark as Sold", action: () => bulkStatus("Sold") },
                  { label: "Delete", action: bulkDelete },
                ]}
              />
              {selectedCount > 0 && (
                <button onClick={() => setSelected(new Set())} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>
                  Clear
                </button>
              )}
              <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12.5, fontWeight: 600, opacity: selectedCount ? 1 : 0.5 }} disabled={!selectedCount || savingMode} onClick={postSelected}><Sparkles size={13} /> Post</button>
            </div>
          </div>
          {parts.map((l: any, i: number) => {
            const on = selected.has(l.id);
            const isOpen = expanded.has(l.id);
            const isSaving = savingParts.has(l.id);
            const f = formOf(l);
            return (
              <React.Fragment key={l.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderBottom: i < parts.length - 1 && !isOpen ? "1px solid var(--line)" : i < parts.length - 1 ? "none" : "none" }}>
                  <input type="checkbox" checked={on} onChange={() => toggleSel(l.id)} style={{ width: 17, height: 17, accentColor: "var(--accent)", cursor: "pointer", flexShrink: 0 }} aria-label={`Select ${l.part}`} />
                  <PhotoCell icon="Wrench" url={l.image} style={{ width: 46, height: 40, flexShrink: 0 }} iconSize={17} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.part}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{l.category}</div>
                    {l.compliance && (
                      <div title={l.compliance.reason} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4, padding: "2px 8px", borderRadius: 6, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)", color: "#f59e0b", fontSize: 11, fontWeight: 700 }}>
                        <AlertTriangle size={12} /> {l.compliance.label}
                      </div>
                    )}
                  </div>
                  <ConditionBadge grade={l.grade} size="sm" />
                  <PricingToggle
                    askingPrice={priceOf(l)}
                    aiPrice={l.aiPrice ? Number(l.aiPrice) : null}
                    partName={l.part}
                    vehicleText={`${v.year} ${v.make} ${v.model}`}
                    source={(priceSource[l.id] as any) || "asking"}
                    onChange={(s) => setPriceSource((ps) => ({ ...ps, [l.id]: s }))}
                  />
                  <PriceConfidenceChip insight={l.priceInsight} />
                  <StatusBadge status={l.status} />
                  <button onClick={() => toggleExpand(l.id)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: "1px solid var(--line)", background: isOpen ? "var(--surface2)" : "transparent", color: "var(--foreground)", fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}><Pencil size={13} /> {isOpen ? "Close" : "Edit"}</button>
                </div>
                {isOpen && (
                  <div style={{ padding: "10px 18px 16px", background: "var(--surface2)", borderBottom: i < parts.length - 1 ? "1px solid var(--line)" : "none" }}>
                    {l.compliance && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12, padding: "9px 12px", borderRadius: 8, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)" }}>
                        <AlertTriangle size={15} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
                        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--foreground)" }}>
                          <strong style={{ color: "#f59e0b" }}>{l.compliance.label}.</strong> {l.compliance.reason}
                        </div>
                      </div>
                    )}
                    <div style={{ marginBottom: 10 }}>
                      <div style={fieldLabel}>Title (part name)</div>
                      <input value={f.name} onChange={(e) => setField(l.id, l, { name: e.target.value })} placeholder="e.g. OEM Alternator 130A" style={fieldInput} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 10 }}>
                      <div>
                        <div style={fieldLabel}>Price ($)</div>
                        <input type="number" value={f.price} onChange={(e) => setField(l.id, l, { price: e.target.value })} className="tnum" style={{ ...fieldInput, fontWeight: 700 }} />
                      </div>
                      <div>
                        <div style={fieldLabel}>Status</div>
                        <StatusPicker value={f.status} onChange={(s) => setField(l.id, l, { status: s })} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 10 }}>
                      <div>
                        <div style={fieldLabel}>Condition</div>
                        <ConditionPicker value={f.condition} onChange={(s) => setField(l.id, l, { condition: s })} />
                      </div>
                      <div>
                        <div style={fieldLabel}>Category</div>
                        <select value={f.category} onChange={(e) => setField(l.id, l, { category: e.target.value })} style={{ ...fieldInput, appearance: "auto", cursor: "pointer" }}>
                          <option value="">Uncategorized</option>
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={fieldLabel}>Fitment (compatible vehicles)</div>
                      <input value={f.fitment} onChange={(e) => setField(l.id, l, { fitment: e.target.value })} placeholder="e.g. 2013–2017 Honda Accord" style={fieldInput} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={fieldLabel}>Condition notes</div>
                      <input value={f.conditionNotes} onChange={(e) => setField(l.id, l, { conditionNotes: e.target.value })} placeholder="e.g. Minor scuffs, no cracks" style={fieldInput} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={fieldLabel}>Description</div>
                      <textarea value={f.desc} onChange={(e) => setField(l.id, l, { desc: e.target.value })} rows={3} placeholder="Describe condition, compatibility, etc…" style={{ ...fieldInput, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => savePart(l.id, l)}
                        disabled={isSaving}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, opacity: isSaving ? 0.6 : 1 }}
                      >
                        {isSaving ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} {isSaving ? "Saving…" : "Save changes"}
                      </button>
                      <button
                        onClick={() => deletePart(l.id, l)}
                        disabled={isSaving}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "1px solid color-mix(in srgb, var(--signal) 45%, transparent)", background: "transparent", color: "var(--signal)", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: isSaving ? 0.6 : 1 }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function VINField({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "var(--surface2)", fontSize: 13 }}>
      <Icon size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
      <span style={{ color: "var(--muted)", minWidth: 80, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const fieldLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 5 };
const fieldInput: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 13.5, outline: "none" };

const CONDITION_OPTS = ["A", "B", "C"] as const;
const CONDITION_COLORS: Record<string, string> = { A: "#22C55E", B: "#F59E0B", C: "#EF4444" };

const CATEGORIES = [
  "Body / Exterior", "Engine / Mechanical", "Transmission / Drivetrain",
  "Electrical / Sensors", "Suspension / Steering", "Brakes",
  "Interior", "Lighting", "Glass / Windows",
  "Wheels / Tires", "HVAC", "Exhaust", "Fuel System",
  "Truck Bed / Cargo", "Miscellaneous",
];

const STATUS_OPTS = ["Draft", "Posted", "Sold"] as const;
const STATUS_COLOR: Record<string, string> = { Draft: "var(--muted)", Posted: "var(--success)", Sold: "var(--signal)" };
function apiStatus(value: string): "draft" | "active" | "sold" {
  return value === "Posted" || value === "active" ? "active" : value === "Sold" || value === "sold" ? "sold" : "draft";
}
function uiStatus(value: unknown): "Draft" | "Posted" | "Sold" {
  return value === "active" || value === "Posted" ? "Posted" : value === "sold" || value === "Sold" ? "Sold" : "Draft";
}

// Segmented A / B / C grade picker (ARA-style).
function ConditionPicker({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const norm = value === "Good" ? "B" : value === "Poor" ? "C" : value;
  return (
    <div style={{ display: "inline-flex", gap: 3, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 9, padding: 3 }}>
      {CONDITION_OPTS.map((s) => {
        const on = norm === s;
        const c = CONDITION_COLORS[s];
        return (
          <button key={s} type="button" onClick={() => onChange(s)} title={`Grade ${s}`}
            style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: on ? c : "transparent", color: on ? "#fff" : "var(--muted)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: on ? 1 : 0.7 }}>
            {s}
          </button>
        );
      })}
    </div>
  );
}

// Segmented Draft / Posted / Sold picker.
function StatusPicker({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <div style={{ display: "inline-flex", gap: 3, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 9, padding: 3 }}>
      {STATUS_OPTS.map((s) => {
        const on = value === s;
        return (
          <button key={s} type="button" onClick={() => onChange(s)}
            style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: on ? "var(--surface)" : "transparent", color: on ? STATUS_COLOR[s] : "var(--muted)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", boxShadow: on ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}>
            {s}
          </button>
        );
      })}
    </div>
  );
}

// Dropdown button that reveals a list of bulk actions.
function BulkAction({ label, actions, disabled }: { label: string; actions: { label: string; action: () => void }[]; disabled?: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} disabled={disabled} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface2)", color: disabled ? "var(--muted)" : "var(--foreground)", fontSize: 12.5, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
        <ChevronDown size={13} /> {label}
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 100, marginTop: 4, minWidth: 170, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.3)", padding: 4 }}>
            {actions.map((a) => (
              <button key={a.label} onClick={() => { a.action(); setOpen(false); }} style={{ display: "block", width: "100%", padding: "9px 12px", borderRadius: 7, border: "none", background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left" }}>
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div>
      <div className="tnum" style={{ fontSize: 19, fontWeight: 800, color: tone || "var(--foreground)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// Vehicle photo gallery — big selected photo + thumbnail strip. Each photo opens
// the full-screen viewer on click (PhotoCell portals it to the body). Falls back
// to a single photo when only one was uploaded.
function VehicleGallery({ v }: { v: any }) {
  const gallery: string[] = (Array.isArray(v.images) ? v.images : (v.image ? [v.image] : [])).filter(Boolean);
  const [hero, setHero] = React.useState(0);
  if (gallery.length <= 1) {
    return <PhotoCell icon="Car" url={gallery[0] || v.image} style={{ height: "100%", minHeight: 220, borderRadius: 0 }} iconSize={56} />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10 }}>
      <PhotoCell key={hero} icon="Car" url={gallery[hero]} label="Tap to enlarge" style={{ aspectRatio: "4 / 3", borderRadius: 10 }} iconSize={48} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {gallery.slice(0, 8).map((u, i) => (
          <button key={i} onClick={() => setHero(i)} aria-label={`Photo ${i + 1}`} style={{ padding: 0, border: i === hero ? "2px solid var(--accent)" : "1px solid var(--line)", borderRadius: 8, overflow: "hidden", aspectRatio: "1", cursor: "pointer", background: "var(--surface2)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// Pricing provenance chip (AHLAM-53): shows which ladder rung set the price and
// how trustworthy it is, so the seller knows whether a number is backed by real
// sold comps or is just an AI estimate. Hidden when there's no insight.
function PriceConfidenceChip({ insight }: { insight: any }) {
  if (!insight) return null;
  const LABEL: Record<string, string> = {
    shop: "Your sold comps",
    grounded: "Market sold data",
    ebay: "eBay listings",
    asking: "Active asking",
    model: "AI estimate",
  };
  const label = LABEL[insight.source as string] || "AI estimate";
  const conf: "high" | "medium" | "low" = insight.confidence || "low";
  const color = conf === "high" ? "#16a34a" : conf === "medium" ? "#f59e0b" : "var(--muted)";
  const n = Number(insight.similarCount) || 0;
  const em = Number(insight.ebayMedian) || 0;
  const tip = em
    ? `Selling on eBay for ~$${em.toLocaleString()} across ${n} listing${n === 1 ? "" : "s"} · ${conf} confidence`
    : `${label}${n ? ` · ${n} comp${n === 1 ? "" : "s"}` : ""} · ${conf} confidence`;
  return (
    <div title={tip} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 7, border: "1px solid var(--line)", background: "var(--surface2)", fontSize: 11, fontWeight: 600, color: "var(--muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
    </div>
  );
}
