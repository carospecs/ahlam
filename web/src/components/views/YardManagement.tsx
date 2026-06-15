"use client";

import React from "react";
import { ScanLine, MapPin, Hash, Search, X, Save, LoaderCircle, Wrench, Car, Check, QrCode, ChevronDown, Pencil, ShieldCheck, FileDown, Info } from "lucide-react";
import { Card, PhotoCell, ConditionBadge, StatusBadge } from "../UI";
import { csToast, useData } from "../Dashboard";

const ROWS = ["A", "B", "C", "D", "E"];
const BAYS = 10;

export function YardManagement() {
  const { listings, vehicles } = useData();
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<Record<string, { location: string; barcode: string }>>({});
  const [saving, setSaving] = React.useState<Set<string>>(new Set());
  const [view, setView] = React.useState<"list" | "grid">("list");
  const [locFilter, setLocFilter] = React.useState("");
  // Bulk location/barcode assignment + label printing (AHLAM-68).
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [bulkLoc, setBulkLoc] = React.useState("");
  const [bulkBusy, setBulkBusy] = React.useState(false);

  const vMap = React.useMemo(() => {
    const m = new Map();
    (vehicles || []).forEach((v: any) => m.set(v.id, v));
    return m;
  }, [vehicles]);

  const qLower = q.toLowerCase();
  const filtered = (listings || []).filter((l: any) => {
    const matchSearch = !qLower || (l.part || "").toLowerCase().includes(qLower) || (l.note || "").toLowerCase().includes(qLower) || (l.stockLocation || "").toLowerCase().includes(qLower) || (l.barcode || "").toLowerCase().includes(qLower);
    const matchLoc = !locFilter || (l.stockLocation || "").startsWith(locFilter);
    return matchSearch && matchLoc;
  });

  const partsWithLocation = filtered.filter((l: any) => l.stockLocation);
  const partsWithoutLocation = filtered.filter((l: any) => !l.stockLocation);
  const sorted = [...partsWithLocation.sort((a: any, b: any) => (a.stockLocation || "").localeCompare(b.stockLocation || "")), ...partsWithoutLocation];

  const startEdit = (l: any) => {
    setEditing((prev) => ({ ...prev, [l.id]: { location: l.stockLocation || "", barcode: l.barcode || "" } }));
  };

  const cancelEdit = (id: string) => {
    setEditing((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
  };

  async function saveEdit(id: string) {
    const f = editing[id];
    if (!f) return;
    setSaving((prev) => new Set(prev).add(id));
    try {
      const r = await fetch("/api/listings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: id, stockLocation: f.location.trim(), barcode: f.barcode.trim() }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't save"); }
      else { csToast("Location saved"); cancelEdit(id); (window as any).csReloadData?.(); }
    } catch { csToast("Couldn't save — check your connection"); }
    setSaving((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  // ── Bulk actions (AHLAM-68) ───────────────────────────────────────────────
  const toggleSel = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selAllVisible = () => setSel((p) => p.size === sorted.length ? new Set() : new Set(sorted.map((l: any) => l.id)));
  const selectedRows = () => sorted.filter((l: any) => sel.has(l.id));

  async function patchOne(id: string, body: Record<string, string>): Promise<boolean> {
    try {
      const r = await fetch("/api/listings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: id, ...body }) });
      return r.ok;
    } catch { return false; }
  }

  // Apply one aisle/bin code (e.g. "A3") to every selected part at once.
  async function bulkApplyLocation() {
    const loc = bulkLoc.trim();
    if (!loc) { csToast("Type a location (e.g. A3) to apply"); return; }
    if (!sel.size) return;
    setBulkBusy(true);
    let ok = 0;
    for (const id of sel) if (await patchOne(id, { stockLocation: loc })) ok++;
    csToast(`Set ${ok} part${ok === 1 ? "" : "s"} to ${loc}`);
    setBulkBusy(false); setSel(new Set()); (window as any).csReloadData?.();
  }

  // Auto-assign unique sequential barcodes to selected parts that lack one.
  async function bulkAutoBarcode() {
    const targets = selectedRows().filter((l: any) => !l.barcode);
    if (!targets.length) { csToast("Selected parts already have barcodes"); return; }
    setBulkBusy(true);
    const base = Date.now().toString().slice(-6);
    let n = 0, ok = 0;
    for (const l of targets) { const code = `AHL-${base}-${String(++n).padStart(3, "0")}`; if (await patchOne(l.id, { barcode: code })) ok++; }
    csToast(`Assigned ${ok} barcode${ok === 1 ? "" : "s"}`);
    setBulkBusy(false); setSel(new Set()); (window as any).csReloadData?.();
  }

  // Open a printable label sheet (scannable Code 39 via web font) for the
  // selected parts — or all visible parts when nothing is selected.
  function printLabels() {
    const items = sel.size ? selectedRows() : sorted;
    if (!items.length) { csToast("No parts to print"); return; }
    const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
    const cards = items.map((l: any) => {
      const v = l.vehicleId ? vMap.get(l.vehicleId) : null;
      const veh = v ? `${v.year} ${v.make} ${v.model}` : "";
      const bc = (l.barcode || "").toUpperCase();
      return `<div class="lbl"><div class="pn">${esc(l.part || "Part")}</div><div class="vh">${esc(veh)}</div><div class="lo">LOC ${esc(l.stockLocation || "—")}</div>${bc ? `<div class="bc">*${esc(bc)}*</div><div class="bn">${esc(bc)}</div>` : `<div class="bn">no barcode</div>`}</div>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ahlam yard labels</title>
      <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet">
      <style>@page{margin:10mm}body{font-family:system-ui,sans-serif;margin:0}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm}
      .lbl{border:1px solid #000;border-radius:6px;padding:8px 10px;height:32mm;display:flex;flex-direction:column;justify-content:space-between;page-break-inside:avoid}
      .pn{font-size:12px;font-weight:700;line-height:1.15;max-height:28px;overflow:hidden}
      .vh{font-size:9px;color:#444}.lo{font-size:13px;font-weight:700}
      .bc{font-family:'Libre Barcode 39',cursive;font-size:30px;line-height:1}
      .bn{font-family:monospace;font-size:9px;letter-spacing:1px;text-align:center}</style></head>
      <body><div class="grid">${cards}</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { csToast("Allow pop-ups to print labels"); return; }
    w.document.write(html); w.document.close();
  }

  function yardCell(l: any) {
    if (!l.stockLocation) return null;
    const match = l.stockLocation.match(/^([A-Z])(\d+)$/i);
    if (!match) return null;
    const row = match[1].toUpperCase();
    const bay = parseInt(match[2], 10);
    const rowIdx = ROWS.indexOf(row);
    if (rowIdx === -1 || bay < 1 || bay > BAYS) return null;
    return { rowIdx, bay: bay - 1 };
  }

  return (
    <div style={{ maxWidth: 1080, display: "grid", gap: 18 }}>
      <NmvtisCard />
      <Card pad={16}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, minWidth: 200 }}>
            <Search size={16} color="var(--muted)" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by part name, barcode, or location…"
              style={{ flex: 1, border: "none", background: "transparent", color: "var(--foreground)", fontSize: 14, outline: "none", fontFamily: "inherit" }}
            />
            {q && <button onClick={() => setQ("")} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}><X size={16} /></button>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>View:</span>
            {(["list", "grid"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--line)", background: view === v ? "var(--surface2)" : "transparent", color: "var(--foreground)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
                {v}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
            {filtered.length} part{filtered.length === 1 ? "" : "s"}
            {partsWithoutLocation.length > 0 && <> · <span style={{ color: "var(--signal)" }}>{partsWithoutLocation.length} unlocated</span></>}
          </div>
        </div>
      </Card>

      {view === "grid" && (
        <Card pad={16}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={16} color="var(--accent)" /> Yard map
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `40px repeat(${BAYS}, 1fr)`, gap: 3 }}>
            <div />
            {Array.from({ length: BAYS }, (_, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: "var(--muted)", padding: "4px 0" }}>Bay {i + 1}</div>
            ))}
            {ROWS.map((row) => (
              <React.Fragment key={row}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>Row {row}</div>
                {Array.from({ length: BAYS }, (_, bay) => {
                  const loc = `${row}${bay + 1}`;
                  const partsHere = sorted.filter((l: any) => l.stockLocation === loc);
                  return (
                    <button key={bay} onClick={() => { setView("list"); setQ(loc); }}
                      style={{ minHeight: 52, borderRadius: 6, border: partsHere.length ? "1px solid var(--accent)" : "1px solid var(--line)", background: partsHere.length ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--surface2)", cursor: partsHere.length ? "pointer" : "default", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, padding: 3 }}>
                      {partsHere.length > 0 && (
                        <>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", lineHeight: 1.2 }}>{partsHere.length}</span>
                          <span style={{ fontSize: 8, color: "var(--muted)", lineHeight: 1.2, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", width: "100%", whiteSpace: "nowrap" }}>{partsHere[0].part}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </Card>
      )}

      {/* Bulk assign + print toolbar (AHLAM-68) */}
      <Card pad={12}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={selAllVisible} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <Check size={14} /> {sel.size === sorted.length && sorted.length > 0 ? "Clear all" : "Select all"}
          </button>
          <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>{sel.size} selected</span>
          <div style={{ flex: 1 }} />
          <input value={bulkLoc} onChange={(e) => setBulkLoc(e.target.value.toUpperCase())} placeholder="e.g. A3" disabled={!sel.size || bulkBusy}
            style={{ width: 80, padding: "7px 9px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 12.5, fontFamily: "monospace", outline: "none", opacity: sel.size ? 1 : 0.5 }} />
          <button onClick={bulkApplyLocation} disabled={!sel.size || bulkBusy} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: sel.size ? "pointer" : "default", opacity: sel.size && !bulkBusy ? 1 : 0.5 }}>
            <MapPin size={14} /> Apply location
          </button>
          <button onClick={bulkAutoBarcode} disabled={!sel.size || bulkBusy} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 12.5, fontWeight: 600, cursor: sel.size ? "pointer" : "default", opacity: sel.size && !bulkBusy ? 1 : 0.5 }}>
            {bulkBusy ? <LoaderCircle size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <QrCode size={14} />} Auto-barcode
          </button>
          <button onClick={printLabels} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <FileDown size={14} /> Print labels{sel.size ? ` (${sel.size})` : " (all)"}
          </button>
        </div>
      </Card>

      <Card pad={0}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 110px 90px 80px", gap: 0, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <span>Part</span>
          <span>Location</span>
          <span>Barcode</span>
          <span>Status</span>
          <span />
        </div>
        {sorted.length === 0 && (
          <div style={{ padding: "40px 18px", textAlign: "center", fontSize: 13.5, color: "var(--muted)" }}>
            {q ? "No parts match your search" : "No parts in your listing yet — add a vehicle first"}
          </div>
        )}
        {sorted.map((l: any, i: number) => {
          const v = l.vehicleId ? vMap.get(l.vehicleId) : null;
          const isEditing = editing[l.id];
          const isSaving = saving.has(l.id);
          const loc = l.stockLocation || "";
          const bc = l.barcode || "";
          return (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: i < sorted.length - 1 ? "1px solid var(--line)" : "none", background: sel.has(l.id) ? "var(--surface2)" : "transparent" }}>
              <input type="checkbox" checked={sel.has(l.id)} onChange={() => toggleSel(l.id)} aria-label={`Select ${l.part}`} style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer", flexShrink: 0 }} />
              <PhotoCell icon="Wrench" url={l.image} style={{ width: 40, height: 36, flexShrink: 0 }} iconSize={15} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.part}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  {v ? `${v.year} ${v.make} ${v.model}` : ""}
                  {l.category && <> · {l.category}</>}
                </div>
              </div>

              {isEditing ? (
                <input value={isEditing.location} onChange={(e) => setEditing((prev) => ({ ...prev, [l.id]: { ...prev[l.id], location: e.target.value } }))} placeholder="e.g. A3" style={{ width: 90, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 12.5, fontFamily: "monospace", outline: "none" }} />
              ) : (
                <span style={{ width: 90, fontSize: 12.5, fontFamily: "monospace", fontWeight: 600, color: loc ? "var(--foreground)" : "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
                  <MapPin size={12} color={loc ? "var(--accent)" : "var(--muted)"} /> {loc || "—"}
                </span>
              )}

              {isEditing ? (
                <input value={isEditing.barcode} onChange={(e) => setEditing((prev) => ({ ...prev, [l.id]: { ...prev[l.id], barcode: e.target.value } }))} placeholder="Scan or type" style={{ width: 100, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 12.5, fontFamily: "monospace", outline: "none" }} />
              ) : (
                <span style={{ width: 100, fontSize: 12, fontFamily: "monospace", color: bc ? "var(--foreground)" : "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
                  <Hash size={12} color={bc ? "var(--accent)" : "var(--muted)"} /> {bc || "—"}
                </span>
              )}

              <div style={{ width: 80 }}><StatusBadge status={l.status} /></div>

              {isEditing ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => saveEdit(l.id)} disabled={isSaving} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {isSaving ? <LoaderCircle size={12} className="spin" /> : <Check size={12} />} Save
                  </button>
                  <button onClick={() => cancelEdit(l.id)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button onClick={() => startEdit(l)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <Pencil size={11} /> Edit
                </button>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// NMVTIS reporting scaffolding (CMP-1). US dismantlers must report obtained
// junk/salvage vehicles to NMVTIS. This card shows compliance status, lets the
// owner set the reporting-entity ID, downloads an NMVTIS-format CSV of the
// vehicles to report, and stamps a reporting period.
function NmvtisCard() {
  const { user } = useData();
  const canManage = user?.role === "owner" || user?.role === "editor";
  const [data, setData] = React.useState<any>(null);
  const [open, setOpen] = React.useState(false);
  const [idDraft, setIdDraft] = React.useState("");
  const [savingId, setSavingId] = React.useState(false);
  const [marking, setMarking] = React.useState(false);
  const period = new Date().toISOString().slice(0, 7);

  const load = React.useCallback(() => {
    fetch("/api/compliance/nmvtis").then((r) => r.json()).then((d) => {
      if (!d.error) { setData(d); setIdDraft(d.entity?.nmvtisId || ""); }
    }).catch(() => {});
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function saveId() {
    setSavingId(true);
    try {
      const r = await fetch("/api/shop", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nmvtis_id: idDraft.trim() }) });
      if (r.ok) { csToast("NMVTIS ID saved"); load(); } else { const e = await r.json().catch(() => ({})); csToast(e.error || "Couldn't save"); }
    } catch { csToast("Couldn't save"); }
    setSavingId(false);
  }

  function downloadCsv() {
    const rows = data?.rows || [];
    if (!rows.length) { csToast("No vehicles to report"); return; }
    const headers = ["Reporting Entity", "NMVTIS ID", "VIN", "Model Year", "Make", "Model", "Date Obtained", "Obtained From (Name)", "Obtained From (Address)", "Disposition"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((r: any) => [r.reportingEntity, r.nmvtisId, r.vin, r.modelYear, r.make, r.model, r.dateObtained, r.obtainedFromName, r.obtainedFromAddress, r.dispositionLabel].map(esc).join(","));
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `nmvtis-report-${period}.csv`; a.click();
    URL.revokeObjectURL(url);
    csToast(`NMVTIS report downloaded — ${rows.length} vehicle${rows.length === 1 ? "" : "s"}`);
  }

  async function markReported() {
    setMarking(true);
    try {
      const r = await fetch("/api/compliance/nmvtis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markReported: true, period }) });
      const d = await r.json();
      if (r.ok) { csToast(`Marked ${d.marked} vehicle${d.marked === 1 ? "" : "s"} reported for ${d.period}`); load(); }
      else csToast(d.error || "Couldn't update");
    } catch { csToast("Couldn't update"); }
    setMarking(false);
  }

  if (!data) return null;

  return (
    <Card pad={0}>
      <button onClick={() => setOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 16px", width: "100%", background: "transparent", border: "none", cursor: "pointer", color: "var(--foreground)", textAlign: "left" }}>
        <span style={{ width: 36, height: 36, borderRadius: 9, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0 }}><ShieldCheck size={18} color="var(--accent)" /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>NMVTIS reporting</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {data.unreported} of {data.total} vehicle{data.total === 1 ? "" : "s"} not yet reported
            {!data.configured && <> · <span style={{ color: "var(--signal)" }}>add your NMVTIS ID</span></>}
            {data.missingVin > 0 && <> · <span style={{ color: "var(--signal)" }}>{data.missingVin} missing a VIN</span></>}
          </div>
        </div>
        <ChevronDown size={16} color="var(--muted)" style={{ flexShrink: 0, transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", display: "grid", gap: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <div style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
            <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>US auto recyclers are required to report obtained junk/salvage vehicles to NMVTIS. Download a report of your vehicles in the standard layout (VIN, date obtained, who it came from, disposition) to file with your NMVTIS data provider, then mark the period reported. Disposition defaults from how each car is being sold; date obtained defaults to when you added it.</span>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>NMVTIS reporting ID</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={idDraft} onChange={(e) => setIdDraft(e.target.value)} placeholder="Your NMVTIS reporting entity ID" disabled={!canManage} style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13.5, outline: "none", fontFamily: "inherit" }} />
              {canManage && (
                <button onClick={saveId} disabled={savingId || idDraft.trim() === (data.entity?.nmvtisId || "")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: savingId || idDraft.trim() === (data.entity?.nmvtisId || "") ? 0.5 : 1 }}>
                  {savingId ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />} Save
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={downloadCsv} disabled={!data.total} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: data.total ? 1 : 0.5 }}>
              <FileDown size={15} /> Download NMVTIS report (CSV)
            </button>
            {canManage && (
              <button onClick={markReported} disabled={marking || !data.unreported} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: marking || !data.unreported ? 0.5 : 1 }}>
                {marking ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />} Mark {period} reported
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
