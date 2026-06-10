"use client";

import React from "react";
import { Wrench, Car, Send, EllipsisVertical, ChevronRight, CirclePlus, Upload, Tag, X, LoaderCircle, FileSpreadsheet } from "lucide-react";
import { Card, PhotoCell, ConditionBadge, MarketChip, StatusBadge } from "../UI";
import { useData, csToast } from "../Dashboard";

export function Parts({ go }: { go: (id: string) => void; onVehicle?: (v: any) => void }) {
  const { vehicles, listings } = useData();
  const [showImport, setShowImport] = React.useState(false);
  const [showBulk, setShowBulk] = React.useState(false);
  const [filter, setFilter] = React.useState("All");
  const [group, setGroup] = React.useState("car"); // default: folders by car
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set()); // collapsed by default
  const toggle = (key: string) => setExpanded((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const tabs = ["All", "Draft", "Posted", "Sold"];
  const rows = listings.filter((l: any) => filter === "All" || l.status === filter);

  // Resolve a listing's source vehicle (live data links by vehicleId).
  const vMap = new Map<string, any>(vehicles.map((v: any) => [v.id, v]));
  const carTitle = (l: any) => {
    const v = vMap.get(l.vehicleId);
    return v ? `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}` : (l.vehicle || "Unassigned parts");
  };

  // Group rows by their source car for the "By car" folder view.
  const carGroups = new Map<string, any[]>();
  for (const l of rows) {
    const key = l.vehicleId || "_none";
    if (!carGroups.has(key)) carGroups.set(key, []);
    carGroups.get(key)!.push(l);
  }

  return (
    <div style={{ maxWidth: 1180, display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, padding: 4 }}>
          {tabs.map((t) => {
            const on = filter === t;
            const count = t === "All" ? listings.length : listings.filter((l: any) => l.status === t).length;
            return (
              <button key={t} onClick={() => setFilter(t)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 8, border: "none", background: on ? "var(--surface2)" : "transparent", color: on ? "var(--foreground)" : "var(--muted)", fontSize: 13.5, fontWeight: 600 }}>
                {t} <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{count}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, padding: 4 }}>
            {[["car", "By car", Car] as const, ["part", "All parts", Wrench] as const].map(([id, label, IconComp]) => {
              const on = group === id;
              return (
                <button key={id} onClick={() => setGroup(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, border: "none", background: on ? "var(--surface2)" : "transparent", color: on ? "var(--foreground)" : "var(--muted)", fontSize: 13, fontWeight: 600 }}>
                  <IconComp size={14} /> {label}
                </button>
              );
            })}
          </div>
          <button style={toolBtn} onClick={() => setShowImport(true)}>
            <Upload size={15} /> Import CSV
          </button>
          <button style={toolBtn} onClick={() => setShowBulk(true)}>
            <Tag size={15} /> Bulk price
          </button>
          <button style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600 }} onClick={() => (window as any).csOpenExport?.(listings.find((l: any) => l.status === "Draft") || listings[0])}>
            <Send size={15} /> Post selected
          </button>
        </div>
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showBulk && <BulkPriceModal listings={listings} onClose={() => setShowBulk(false)} />}

      {rows.length === 0 && (
        <div style={{ padding: 48, textAlign: "center", border: "1px dashed var(--line)", borderRadius: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--accent-tint)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
            <Wrench size={22} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>
            {filter === "All" ? "No parts yet — add a vehicle and the AI will catalog its parts." : `No ${filter.toLowerCase()} parts.`}
          </div>
          {filter === "All" && (
            <button onClick={() => go("add")} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600 }}>
              <CirclePlus size={16} /> Add your first vehicle
            </button>
          )}
        </div>
      )}

      {group === "part" && rows.length > 0 && (
        <div className="cs-parts-card">
          <Card pad={0}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--line)" }}>
              <span style={{ width: 48 }} />
              <span style={{ flex: 1 }}>Part</span>
              <span style={{ width: 90 }}>Condition</span>
              <span style={{ width: 70, textAlign: "right" }}>Price</span>
              <span style={{ width: 180 }}>Marketplaces</span>
              <span style={{ width: 60, textAlign: "right" }}>Views</span>
              <span style={{ width: 96 }}>Status</span>
              <span style={{ width: 36 }} />
            </div>
            {rows.map((l: any, i: number) => (
              <div key={l.id} onClick={() => (window as any).csOpenExport?.(l)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", cursor: "pointer", borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : "none" }}>
                <PhotoCell icon="Wrench" url={l.image} style={{ width: 48, height: 40, flexShrink: 0 }} iconSize={17} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.part}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{carTitle(l)}</div>
                </div>
                <span style={{ width: 90 }}><ConditionBadge grade={l.grade} size="sm" /></span>
                <span className="tnum" style={{ width: 70, textAlign: "right", fontSize: 14, fontWeight: 700 }}>${l.price}</span>
                <span style={{ width: 180, display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {l.markets.length ? l.markets.map((m: string) => <MarketChip key={m} name={m} />) : <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>}
                </span>
                <span className="tnum" style={{ width: 60, textAlign: "right", fontSize: 13, color: "var(--muted)" }}>{l.views || "—"}</span>
                <span style={{ width: 96 }}><StatusBadge status={l.status} /></span>
                <button style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center", flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); (window as any).csOpenExport?.(l); }}>
                  <EllipsisVertical size={16} color="var(--muted)" />
                </button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {group === "car" && rows.length > 0 && (
        <div style={{ display: "grid", gap: 16 }}>
          {[...carGroups.entries()].map(([key, vParts]) => {
            const v = vMap.get(key);
            const title = v ? `${v.year} ${v.make} ${v.model}` : "Parts not linked to a car";
            const trim = v?.trim || "";
            const total = vParts.reduce((s, l) => s + (l.price || 0), 0);
            const open = expanded.has(key);
            return (
              <Card key={key} pad={0}>
                <button onClick={() => toggle(key)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderWidth: 0, borderBottomWidth: open ? 1 : 0, borderStyle: "solid", borderColor: "var(--line)", width: "100%", background: "transparent", textAlign: "left", cursor: "pointer", color: "var(--foreground)" }}>
                  <ChevronRight size={16} color="var(--muted)" style={{ flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "none" }} />
                  <PhotoCell icon="Car" url={v?.image} style={{ width: 44, height: 34, flexShrink: 0 }} iconSize={18} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{title} {trim && <span style={{ color: "var(--muted)", fontWeight: 500 }}>{trim}</span>}</span>
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: "var(--success)" }}>${total.toLocaleString()}</span>
                    <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{vParts.length} part{vParts.length === 1 ? "" : "s"}</span>
                  </span>
                </button>
                {open && vParts.map((l: any, i: number) => (
                  <div key={l.id} onClick={() => (window as any).csOpenExport?.(l)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", cursor: "pointer", borderWidth: 0, borderBottomWidth: i < vParts.length - 1 ? 1 : 0, borderStyle: "solid", borderColor: "var(--line)" }}>
                    <PhotoCell icon="Wrench" url={l.image} style={{ width: 48, height: 40, flexShrink: 0 }} iconSize={17} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.part}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{l.category || carTitle(l)}</div>
                    </div>
                    <span style={{ width: 90 }}><ConditionBadge grade={l.grade} size="sm" /></span>
                    <span className="tnum" style={{ width: 70, textAlign: "right", fontSize: 14, fontWeight: 700 }}>${l.price}</span>
                    <span style={{ width: 180, display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {l.markets.length ? l.markets.map((m: string) => <MarketChip key={m} name={m} />) : <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>}
                    </span>
                    <span className="tnum" style={{ width: 60, textAlign: "right", fontSize: 13, color: "var(--muted)" }}>{l.views || "—"}</span>
                    <span style={{ width: 96 }}><StatusBadge status={l.status} /></span>
                  </div>
                ))}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

const toolBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 10,
  border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)",
  fontSize: 13.5, fontWeight: 600, cursor: "pointer",
};
const ov: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 160, background: "rgba(7,11,22,0.72)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24 };
const modal: React.CSSProperties = { width: "min(560px, 100%)", maxHeight: "88vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", padding: 22, display: "grid", gap: 12, boxShadow: "0 40px 90px -30px rgba(0,0,0,0.8)" };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 18px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" };

function ModalShell({ title, icon, onClose, children }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={ov} onMouseDown={onClose}>
      <div style={modal} className="fade-up" onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 16, fontWeight: 700 }}>{icon} {title}</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={16} color="var(--muted)" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Bulk YMS import — paste a spreadsheet export or upload a .csv, preview, import.
function ImportModal({ onClose }: { onClose: () => void }) {
  const [csv, setCsv] = React.useState("");
  const [preview, setPreview] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function run(dryRun: boolean) {
    if (!csv.trim()) { csToast("Paste a CSV or choose a file"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/listings/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv, dryRun }) });
      const d = await r.json();
      if (!r.ok) { csToast(d.error || "Import failed"); setBusy(false); return; }
      if (dryRun) { setPreview(d); }
      else {
        csToast(`Imported ${d.created} part${d.created === 1 ? "" : "s"}`);
        (window as any).csReloadData?.();
        onClose();
      }
    } catch { csToast("Import failed"); }
    setBusy(false);
  }

  function onFile(f: File | undefined) {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setCsv(String(reader.result || "")); setPreview(null); };
    reader.readAsText(f);
  }

  return (
    <ModalShell title="Import parts from CSV" icon={<FileSpreadsheet size={18} color="var(--accent)" />} onClose={onClose}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
        Paste your yard export or upload a .csv. Columns are matched by header — include at least a <b>Part</b> (or Description) column. Recognized: Part, Price, Condition, Category, Year, Make, Model, Hollander, Notes, Stock.
      </p>
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <button onClick={() => fileRef.current?.click()} style={{ ...toolBtn, width: "fit-content" }}><Upload size={15} /> Choose .csv file</button>
      <textarea value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} rows={6} placeholder={"Part,Price,Condition,Year,Make,Model,Hollander\nAlternator,95,B,2015,Honda,Accord,400-12345\nStarter,70,B,2014,Chevy,Cruze,410-54321"} style={{ width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 12.5, fontFamily: "var(--font-mono, monospace)", outline: "none", resize: "vertical" }} />

      {preview && (
        <div style={{ fontSize: 13, color: "var(--foreground)", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 11, padding: 12 }}>
          <b style={{ color: "var(--success)" }}>{preview.willCreate}</b> parts ready to import{preview.skipped?.length ? `, ${preview.skipped.length} skipped` : ""}.
          {preview.sample?.length > 0 && (
            <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
              {preview.sample.map((s: any, i: number) => (
                <div key={i} style={{ fontSize: 12, color: "var(--muted)" }}>• {s.partName} — {s.condition}{s.suggestedPriceUsd ? ` · $${s.suggestedPriceUsd}` : ""}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => run(true)} disabled={busy} style={{ ...toolBtn, opacity: busy ? 0.6 : 1 }}>{busy ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : null} Preview</button>
        <button onClick={() => run(false)} disabled={busy || !preview} style={{ ...primaryBtn, flex: 1, opacity: busy || !preview ? 0.6 : 1 }}>
          {busy ? <LoaderCircle size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <Upload size={15} />} Import {preview ? `${preview.willCreate} parts` : "parts"}
        </button>
      </div>
    </ModalShell>
  );
}

// Bulk pricing — apply a % change, flat delta, or fixed price to a set of parts.
function BulkPriceModal({ listings, onClose }: { listings: any[]; onClose: () => void }) {
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const l of listings) { const c = l.category || l.partCategory; if (c) set.add(c); }
    return ["All", ...Array.from(set).sort()];
  }, [listings]);

  const [category, setCategory] = React.useState("All");
  const [mode, setMode] = React.useState<"percent" | "delta" | "set">("percent");
  const [value, setValue] = React.useState("-10");
  const [preview, setPreview] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);

  async function run(dryRun: boolean) {
    const num = Number(value);
    if (Number.isNaN(num)) { csToast("Enter a number"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/listings/bulk-price", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, mode, value: num, dryRun }) });
      const d = await r.json();
      if (!r.ok) { csToast(d.error || "Could not update prices"); setBusy(false); return; }
      if (dryRun) setPreview(d);
      else { csToast(`Updated ${d.updated} price${d.updated === 1 ? "" : "s"}`); (window as any).csReloadData?.(); onClose(); }
    } catch { csToast("Could not update prices"); }
    setBusy(false);
  }

  return (
    <ModalShell title="Bulk pricing" icon={<Tag size={18} color="var(--accent)" />} onClose={onClose}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>Apply a price change across many parts at once. Preview before you commit.</p>
      <label style={lbl}>Apply to</label>
      <select value={category} onChange={(e) => { setCategory(e.target.value); setPreview(null); }} style={field}>
        {categories.map((c) => <option key={c} value={c}>{c === "All" ? "All my parts" : c}</option>)}
      </select>
      <label style={lbl}>Change</label>
      <div style={{ display: "flex", gap: 8 }}>
        <select value={mode} onChange={(e) => { setMode(e.target.value as any); setPreview(null); }} style={{ ...field, flex: 1 }}>
          <option value="percent">Percent change (%)</option>
          <option value="delta">Add / subtract ($)</option>
          <option value="set">Set fixed price ($)</option>
        </select>
        <input type="number" value={value} onChange={(e) => { setValue(e.target.value); setPreview(null); }} style={{ ...field, width: 110 }} />
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        {mode === "percent" ? "e.g. -10 = 10% off, 5 = 5% markup" : mode === "delta" ? "e.g. -15 takes $15 off each, 20 adds $20" : "every selected part gets this exact price"}
      </div>

      {preview && (
        <div style={{ fontSize: 13, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 11, padding: 12 }}>
          <b style={{ color: "var(--accent)" }}>{preview.count}</b> parts will change.
          {preview.sample?.length > 0 && (
            <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
              {preview.sample.map((s: any) => (
                <div key={s.id} style={{ fontSize: 12, color: "var(--muted)" }}>${s.from} → <b style={{ color: "var(--success)" }}>${s.to}</b></div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => run(true)} disabled={busy} style={{ ...toolBtn, opacity: busy ? 0.6 : 1 }}>{busy ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : null} Preview</button>
        <button onClick={() => run(false)} disabled={busy || !preview} style={{ ...primaryBtn, flex: 1, opacity: busy || !preview ? 0.6 : 1 }}>
          {busy ? <LoaderCircle size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <Tag size={15} />} Apply {preview ? `to ${preview.count}` : ""}
        </button>
      </div>
    </ModalShell>
  );
}

const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--muted)" };
const field: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13.5, outline: "none", fontFamily: "inherit" };
