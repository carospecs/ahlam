"use client";

import React from "react";
import { Wrench, Car, Send, EllipsisVertical, ChevronRight, CirclePlus } from "lucide-react";
import { Card, PhotoCell, ConditionBadge, MarketChip, StatusBadge } from "../UI";
import { useData } from "../Dashboard";

export function Parts({ go }: { go: (id: string) => void; onVehicle?: (v: any) => void }) {
  const { vehicles, listings } = useData();
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
          <button style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600 }} onClick={() => (window as any).csOpenExport?.(listings.find((l: any) => l.status === "Draft") || listings[0])}>
            <Send size={15} /> Post selected
          </button>
        </div>
      </div>

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
                <PhotoCell icon="Wrench" style={{ width: 48, height: 40, flexShrink: 0 }} iconSize={17} />
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
                  <PhotoCell icon="Car" style={{ width: 44, height: 34, flexShrink: 0 }} iconSize={18} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{title} {trim && <span style={{ color: "var(--muted)", fontWeight: 500 }}>{trim}</span>}</span>
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: "var(--success)" }}>${total.toLocaleString()}</span>
                    <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{vParts.length} part{vParts.length === 1 ? "" : "s"}</span>
                  </span>
                </button>
                {open && vParts.map((l: any, i: number) => (
                  <div key={l.id} onClick={() => (window as any).csOpenExport?.(l)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", cursor: "pointer", borderWidth: 0, borderBottomWidth: i < vParts.length - 1 ? 1 : 0, borderStyle: "solid", borderColor: "var(--line)" }}>
                    <PhotoCell icon="Wrench" style={{ width: 48, height: 40, flexShrink: 0 }} iconSize={17} />
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
