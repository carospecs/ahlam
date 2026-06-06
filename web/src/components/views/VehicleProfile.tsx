"use client";

import React from "react";
import { Car, Wrench, ChevronLeft, Copy, Send, Sparkles, ScanLine, Check, CheckCircle2, Pencil, Lightbulb, LoaderCircle } from "lucide-react";
import { Card, PhotoCell, ConditionBadge, SellModeBadge, StatusBadge } from "../UI";
import { buildVehicleText, partsForVehicle, SELL_MODE } from "../data";
import { csToast, useData } from "../Dashboard";

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

  const [vehDesc, setVehDesc] = React.useState<string>(v.description || "");
  const [savingDesc, setSavingDesc] = React.useState(false);

  const mode = SELL_MODE[sellMode];
  const showCar = sellMode === "whole" || sellMode === "both";
  const showParts = true; // always allow editing parts regardless of sell mode
  const priceOf = (p: any) => (prices[p.id] != null ? prices[p.id] : p.price);
  const partsValue = parts.reduce((s: number, p: any) => s + priceOf(p), 0);
  const selectedCount = parts.filter((p: any) => selected.has(p.id)).length;

  const toggleSel = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

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

  // Toggle the inline edit panel for a part.
  const toggleExpand = (id: string) => setExpanded((prev) => {
    const n = new Set(prev);
    if (n.has(id)) { n.delete(id); setEditForm((ef) => { const copy = { ...ef }; delete copy[id]; return copy; }); }
    else n.add(id);
    return n;
  });

  // Local form state for each open part panel (price + desc).
  const [editForm, setEditForm] = React.useState<Record<string, { price: string; desc: string }>>({});
  const formOf = (p: any) => editForm[p.id] || { price: String(priceOf(p)), desc: p.desc || p.description || "" };

  // Persist price + description for a single part listing.
  async function savePart(id: string) {
    if (savingParts.has(id)) return;
    const f = editForm[id];
    if (!f) return;
    setSavingParts((prev) => new Set(prev).add(id));
    const num = Number(f.price);
    const body: Record<string, any> = { listingId: id };
    if (Number.isFinite(num) && num >= 0) { body.priceUsd = num; setPrices((pr) => ({ ...pr, [id]: num })); }
    if (f.desc != null) { body.description = f.desc; setPartDescs((pd) => ({ ...pd, [id]: f.desc })); }
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

  async function saveDescription() {
    if (savingDesc) return;
    setSavingDesc(true);
    try {
      const r = await fetch("/api/listings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicleId: v.id, description: vehDesc }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't save"); }
      else { csToast("Description saved"); (window as any).csReloadData?.(); }
    } catch { csToast("Couldn't save — check your connection"); }
    setSavingDesc(false);
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
      {/* Header row: back link on the left, Post car on the top-right corner. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "transparent", color: "var(--muted)", fontSize: 13.5, fontWeight: 600, padding: 0, width: "fit-content" }}><ChevronLeft size={16} /> Back to shop vehicles</button>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600 }} onClick={postVehicle}><Send size={15} /> Post car</button>
      </div>

      <Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr" }} className="cs-veh-hero">
          <PhotoCell icon="Car" style={{ height: "100%", minHeight: 220, borderRadius: 0 }} iconSize={56} />
          <div style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SellModeBadge mode={sellMode} />
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{mode.desc}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Sell as:</span>
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
                <Check size={13} /> {savingMode ? "Saving…" : "Submit"}
              </button>
            </div>
            <h2 style={{ margin: "12px 0 0", fontSize: 24, fontWeight: 800 }}>{v.year} {v.make} {v.model} {v.trim}</h2>
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}>{v.body} · {v.color} · {v.mileage}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 12.5, color: "var(--muted)" }}>
              <ScanLine size={14} /> VIN {v.vin}
            </div>
            <div style={{ display: "flex", gap: 28, marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
              {showCar && <Stat label="Asking price" value={`$${v.askingPrice?.toLocaleString()}`} tone="var(--signal)" />}
              <Stat label="Parts identified" value={parts.length} />
              <Stat label="Parts value" value={`$${partsValue.toLocaleString()}`} tone="var(--success)" />
              <Stat label="Sold" value={v.sold} />
            </div>
          </div>
        </div>
      </Card>

      {showCar && (
        <Card pad={18}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Car size={16} color="var(--signal)" /> Whole-car listing</span>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 600 }} onClick={copyCar}><Copy size={14} /> Copy text</button>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>Description buyers will see</div>
          <textarea value={vehDesc} onChange={(e) => setVehDesc(e.target.value)} rows={4} placeholder="Describe the vehicle — condition, history, what's included…" style={{ width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13.5, lineHeight: 1.5, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
          <button onClick={saveDescription} disabled={savingDesc} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, marginTop: 8, opacity: savingDesc ? 0.6 : 1 }}>
            {savingDesc ? "Saving…" : "Save description"}
          </button>
          <pre style={{ margin: "12px 0 0", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: 15, fontSize: 13, lineHeight: 1.6, color: "var(--foreground)", fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap" }}>{buildVehicleText({ ...v, description: vehDesc })}</pre>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}><Lightbulb size={14} color="var(--signal)" /> Suggested to add</div>
            <div style={{ display: "grid", gap: 6 }}>
              {suggestions.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: s.ok ? "var(--muted)" : "var(--foreground)" }}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, display: "grid", placeItems: "center", flexShrink: 0, background: s.ok ? "color-mix(in srgb, var(--success) 18%, transparent)" : "var(--surface2)", border: s.ok ? "none" : "1px solid var(--line)" }}>
                    {s.ok && <Check size={11} color="var(--success)" />}
                  </span>
                  <span style={{ textDecoration: s.ok ? "line-through" : "none", opacity: s.ok ? 0.7 : 1 }}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {showParts && (
        <Card pad={0}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Wrench size={16} color="var(--accent)" /> Parts from this car <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {parts.length}</span></span>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, opacity: selectedCount ? 1 : 0.6 }} disabled={!selectedCount || savingMode} onClick={postSelected}><Sparkles size={14} /> Post {selectedCount} selected</button>
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
                  <PhotoCell icon="Wrench" style={{ width: 46, height: 40, flexShrink: 0 }} iconSize={17} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.part}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{l.category}</div>
                  </div>
                  <ConditionBadge grade={l.grade} size="sm" />
                  <div className="tnum" style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", whiteSpace: "nowrap" }}>${priceOf(l).toLocaleString()}</div>
                  <StatusBadge status={l.status} />
                  <button onClick={() => toggleExpand(l.id)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: "1px solid var(--line)", background: isOpen ? "var(--surface2)" : "transparent", color: "var(--foreground)", fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}><Pencil size={13} /> {isOpen ? "Close" : "Edit"}</button>
                </div>
                {isOpen && (
                  <div style={{ padding: "10px 18px 16px", background: "var(--surface2)", borderBottom: i < parts.length - 1 ? "1px solid var(--line)" : "none" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Price ($)</div>
                        <input type="number" value={f.price} onChange={(e) => setEditForm((ef) => ({ ...ef, [l.id]: { ...(ef[l.id] || f), price: e.target.value } }))} className="tnum" style={{ width: "100%", boxSizing: "border-box", fontSize: 14, fontWeight: 700, padding: "7px 9px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", outline: "none" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Status</div>
                        <StatusBadge status={l.status} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Description for buyers</div>
                      <textarea value={f.desc} onChange={(e) => setEditForm((ef) => ({ ...ef, [l.id]: { ...(ef[l.id] || f), desc: e.target.value } }))} rows={3} placeholder="Describe condition, compatibility, etc…" style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 13, lineHeight: 1.5, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                    </div>
                    <button
                      onClick={() => savePart(l.id)}
                      disabled={isSaving}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, opacity: isSaving ? 0.6 : 1 }}
                    >
                      {isSaving ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} {isSaving ? "Saving…" : "Save"}
                    </button>
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

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div>
      <div className="tnum" style={{ fontSize: 19, fontWeight: 800, color: tone || "var(--foreground)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}
