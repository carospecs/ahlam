"use client";

import { Car, Wrench, CirclePlus, ScanLine } from "lucide-react";
import { Card, PhotoCell, SellModeBadge } from "../UI";
import { useData } from "../Dashboard";

export function Vehicles({ go, onVehicle }: { go: (id: string) => void; onVehicle: (v: any) => void }) {
  const { vehicles } = useData();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18, maxWidth: 1180 }}>
      {vehicles.map((v: any) => (
        <button key={v.id} onClick={() => onVehicle(v)} style={{ all: "unset", cursor: "pointer", display: "block" }}>
          <Card pad={0} style={{ overflow: "hidden" }}>
            <div style={{ position: "relative" }}>
              <PhotoCell icon="Car" label={`${v.photos} photos`} style={{ height: 150, borderRadius: 0 }} iconSize={44} />
              <div style={{ position: "absolute", top: 10, left: 10 }}><SellModeBadge mode={v.sellMode} size="sm" /></div>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{v.year} {v.make} {v.model}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 1 }}>{v.trim} · {v.body} · {v.mileage}</div>
                </div>
                {v.askingPrice
                  ? <span className="tnum" style={{ fontSize: 16, fontWeight: 800, color: "var(--signal)" }}>${v.askingPrice.toLocaleString()}</span>
                  : <span className="tnum" style={{ fontSize: 16, fontWeight: 800, color: "var(--success)" }}>${v.value.toLocaleString()}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
                <ScanLine size={13} /> VIN {v.vin}
                <span style={{ marginLeft: "auto", color: v.askingPrice ? "var(--signal)" : "var(--muted)" }}>{v.askingPrice ? "car asking price" : "parts value"}</span>
              </div>
              <div style={{ display: "flex", gap: 18, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <Mini label="Parts" value={v.parts} />
                <Mini label="Listed" value={v.listed} />
                <Mini label="Sold" value={v.sold} tone="var(--signal)" />
              </div>
            </div>
          </Card>
        </button>
      ))}
      <button onClick={() => go("add")} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, border: "1.5px dashed var(--line)", borderRadius: "var(--radius-lg)", background: "transparent", color: "var(--foreground)", padding: 24, minHeight: 280 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(220,38,38,0.14)", display: "grid", placeItems: "center" }}>
          <CirclePlus size={24} color="var(--accent)" />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Add a vehicle</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>Photograph it and let AI build the inventory</div>
      </button>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div>
      <div className="tnum" style={{ fontSize: 17, fontWeight: 700, color: tone || "var(--foreground)" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{label}</div>
    </div>
  );
}
