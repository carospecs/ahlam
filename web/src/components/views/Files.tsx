"use client";

import React from "react";
import { FolderClosed, FileText, ChevronRight, Lock, Car, Printer, LoaderCircle } from "lucide-react";
import { Card } from "../UI";
import { useData } from "../Dashboard";

// Owner-only file cabinet. For now it holds VIN reports: every vehicle that has a
// VIN gets a decoded report (NHTSA), organized Files / VIN number reports / <car>.
export function Files() {
  const { vehicles, role } = useData();
  const [open, setOpen] = React.useState<string | null>(null); // vehicle id
  const [reports, setReports] = React.useState<Record<string, any>>({});
  const [loading, setLoading] = React.useState<string | null>(null);

  const withVin = (vehicles || []).filter((v: any) => (v.vin || "").trim().length >= 11);

  if (role && role !== "owner") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Card style={{ display: "flex", gap: 12, alignItems: "center", padding: 22 }}>
          <Lock size={20} color="var(--muted)" />
          <div style={{ fontSize: 14, color: "var(--muted)" }}>Files are visible to the shop owner only.</div>
        </Card>
      </div>
    );
  }

  async function openReport(v: any) {
    if (open === v.id) { setOpen(null); return; }
    setOpen(v.id);
    if (reports[v.id]) return;
    setLoading(v.id);
    try {
      const r = await fetch("/api/vin-decode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vin: v.vin }) });
      const d = await r.json();
      setReports((prev) => ({ ...prev, [v.id]: d.ok ? d.decode : { error: d.error || "Couldn't decode this VIN" } }));
    } catch { setReports((prev) => ({ ...prev, [v.id]: { error: "Couldn't reach the VIN service" } })); }
    setLoading(null);
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
        <FolderClosed size={15} /> Files <ChevronRight size={13} /> <span style={{ color: "var(--foreground)", fontWeight: 600 }}>VIN number reports</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--muted)" }}><Lock size={12} /> Owner only</span>
      </div>

      {withVin.length === 0 ? (
        <Card style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
          No VIN reports yet. Add a vehicle with its VIN and a report is filed here automatically.
        </Card>
      ) : (
        <Card pad={0}>
          {withVin.map((v: any, i: number) => {
            const isOpen = open === v.id;
            const rep = reports[v.id];
            return (
              <div key={v.id} style={{ borderBottom: i < withVin.length - 1 ? "1px solid var(--line)" : "none" }}>
                <button onClick={() => openReport(v)} className="cs-hover-row" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px", border: "none", background: "transparent", color: "var(--foreground)", cursor: "pointer", textAlign: "left" }}>
                  <ChevronRight size={15} color="var(--muted)" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }} />
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0 }}><Car size={17} color="var(--accent)" /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{v.year} {v.make} {v.model} {v.trim}</span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.03em" }}>VIN {v.vin}</span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--muted)", flexShrink: 0 }}><FileText size={14} /> VIN report</span>
                </button>
                {isOpen && (
                  <div style={{ padding: "0 18px 18px 18px" }}>
                    {loading === v.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13, padding: "8px 0" }}><LoaderCircle size={15} className="spin" /> Decoding VIN…</div>
                    ) : rep?.error ? (
                      <div style={{ fontSize: 13, color: "var(--danger)" }}>{rep.error}</div>
                    ) : rep ? (
                      <VinReport decode={rep} vehicle={v} />
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function VinReport({ decode: d, vehicle }: { decode: any; vehicle: any }) {
  return (
    <div data-no-i18n style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>VIN Report</div>
        <button onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--muted)", background: "transparent", border: "1px solid var(--line)", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}><Printer size={13} /> Print / save</button>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)", marginBottom: 10 }}>{d.vin}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }} className="cs-grid-2">
        <Row label="Year" value={d.year} />
        <Row label="Company/Brand" value={d.make} />
        <Row label="Model" value={d.model} />
        <Row label="Trim" value={d.trim} />
        <Row label="Body class" value={d.bodyClass} />
        <Row label="Doors" value={d.doors} />
        <Row label="Engine" value={d.engine} />
        <Row label="Cylinders" value={d.engineCylinders} />
        <Row label="Displacement (CC)" value={d.displacement} />
        <Row label="Fuel type" value={d.fuelType} />
        <Row label="Transmission" value={d.transmission} />
        <Row label="Drive type" value={d.driveType} />
        <Row label="Seating" value={d.seatingCapacity} />
        <Row label="Manufacturer" value={d.manufacturer} />
        <Row label="Plant" value={[d.plantCity, d.plantState, d.plantCountry].filter(Boolean).join(", ")} />
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>Source: NHTSA vPIC · decoded from the VIN · private to the shop owner.</div>
    </div>
  );
}
