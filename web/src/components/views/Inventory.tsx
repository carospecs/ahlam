"use client";

import React from "react";
import { Car, Wrench, Store, CircleCheck, Send, PencilLine, Eye } from "lucide-react";
import { Card, PhotoCell, ConditionBadge, SellModeBadge, StatusBadge } from "../UI";
import { useData, csToast } from "../Dashboard";
import { statusIs } from "../data";

export function Inventory({ go, onVehicle }: { go: (id: string) => void; onVehicle: (v: any) => void }) {
  const { vehicles, listings } = useData();
  const [tab, setTab] = React.useState("all");
  const tabs = [
    { id: "all", label: "All", icon: Store },
    { id: "vehicles", label: "Vehicles", icon: Car },
    { id: "parts", label: "Parts", icon: Wrench },
  ];

  const partsCount = listings.length;
  const draftCount = listings.filter((l: any) => statusIs(l.status, "draft")).length;
  const postedCount = listings.filter((l: any) => statusIs(l.status, "posted")).length;
  const soldCount = listings.filter((l: any) => statusIs(l.status, "sold")).length;

  return (
    <div style={{ maxWidth: 1180, display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 6, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 4 }}>
        {tabs.map((t) => {
          const on = tab === t.id;
          const IconComp = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 8, border: "none", background: on ? "var(--surface2)" : "transparent", color: on ? "var(--foreground)" : "var(--muted)", fontSize: 13.5, fontWeight: 600 }}>
              <IconComp size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total parts", value: partsCount, tone: "var(--muted)" },
          { label: "Draft", value: draftCount, tone: "var(--muted)" },
          { label: "Posted", value: postedCount, tone: "var(--success)" },
          { label: "Sold", value: soldCount, tone: "var(--signal)" },
        ].map((s) => (
          <Card key={s.label} pad={14} style={{ textAlign: "center" }}>
            <div className="tnum" style={{ fontSize: 26, fontWeight: 800, color: s.tone }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {(tab === "all" || tab === "vehicles") && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Car size={16} color="var(--accent)" /> {tab === "all" ? "Vehicles" : ""} <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 13 }}>{vehicles.length} vehicles</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {vehicles.map((v: any) => {
              const vParts = listings.filter((l: any) => l.vehicle?.includes(v.make) && l.vehicle?.includes(v.model));
              const vListed = vParts.filter((l: any) => statusIs(l.status, "posted")).length;
              const vSold = vParts.filter((l: any) => statusIs(l.status, "sold")).length;
              return (
                <button key={v.id} onClick={() => onVehicle(v)} style={{ all: "unset", cursor: "pointer", display: "block" }}>
                  <Card pad={0} style={{ overflow: "hidden" }}>
                    <PhotoCell icon="Car" url={v.image} style={{ height: 130, borderRadius: 0 }} iconSize={40} />
                    <div style={{ padding: 14 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{v.year} {v.make} {v.model} <span style={{ fontWeight: 500, color: "var(--muted)" }}>{v.trim}</span></div>
                      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
                        <span><span className="tnum" style={{ fontWeight: 700, color: "var(--foreground)" }}>{vParts.length}</span> parts</span>
                        <span><span className="tnum" style={{ fontWeight: 700, color: "var(--success)" }}>{vListed}</span> listed</span>
                        <span><span className="tnum" style={{ fontWeight: 700, color: vSold > 0 ? "var(--signal)" : "var(--muted)" }}>{vSold}</span> sold</span>
                      </div>
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(tab === "all" || tab === "parts") && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Wrench size={16} color="var(--accent)" /> {tab === "all" ? "Parts" : ""} <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 13 }}>{listings.length} parts</span>
          </div>
          <Card pad={0}>
            {listings.map((l: any, i: number) => (
              <div key={l.id} onClick={() => (window as any).csOpenExport?.(l)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", cursor: "pointer", borderBottom: i < listings.length - 1 ? "1px solid var(--line)" : "none" }}>
                <PhotoCell icon="Wrench" url={l.image} style={{ width: 42, height: 36, flexShrink: 0 }} iconSize={15} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.part}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{l.vehicle}</div>
                </div>
                <ConditionBadge grade={l.grade} size="sm" />
                <span className="tnum" style={{ width: 60, textAlign: "right", fontSize: 14, fontWeight: 700 }}>${l.price}</span>
                <StatusBadge status={l.status} />
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
