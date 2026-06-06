"use client";

import {
  Wrench, WrenchIcon, Car, Check, CircleCheck, Send, PencilLine,
} from "lucide-react";

export function ConditionBadge({ grade, size = "md" }: { grade: string; size?: "sm" | "md" }) {
  const c = grade === "Good" ? "var(--success)" : "var(--danger)";
  const pad = size === "sm" ? "2px 8px" : "3px 10px";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 7, padding: pad, fontSize: size === "sm" ? 11.5 : 12.5, fontWeight: 700, color: c, background: `color-mix(in srgb, ${c} 16%, transparent)` }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c }} />
      {grade}
    </span>
  );
}

export function SellModeBadge({ mode, size = "md" }: { mode: string; size?: "sm" | "md" }) {
  const sellModeMap = { parts: { color: "var(--accent)", icon: "Wrench", short: "Parts only" }, whole: { color: "var(--signal)", icon: "Car", short: "Whole car" }, both: { color: "var(--success)", icon: "Layers", short: "Both" } } as const;
  const m = sellModeMap[mode as keyof typeof sellModeMap];
  if (!m) return null;
  const pad = size === "sm" ? "2px 8px" : "3px 10px";
  const IconComp = m.icon === "Wrench" ? Wrench : m.icon === "Car" ? Car : WrenchIcon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 7, padding: pad, fontSize: size === "sm" ? 11 : 12, fontWeight: 700, color: m.color, background: `color-mix(in srgb, ${m.color} 15%, transparent)` }}>
      {<IconComp size={size === "sm" ? 11 : 13} />} {m.short}
    </span>
  );
}

const partsAndWhole = {} as any;

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { c: string; icon: typeof Check }> = {
    Posted: { c: "var(--success)", icon: Send },
    Draft: { c: "var(--muted)", icon: PencilLine },
    Sold: { c: "var(--signal)", icon: CircleCheck },
  };
  const m = map[status] || map.Draft;
  const IconComp = m.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 7, padding: "3px 9px", fontSize: 12, fontWeight: 600, color: m.c, background: `color-mix(in srgb, ${m.c} 14%, transparent)` }}>
      <IconComp size={12} /> {status}
    </span>
  );
}

export function PhotoCell({ icon = "Car", label, style = {}, iconSize = 30 }: { icon?: string; label?: string; style?: React.CSSProperties; iconSize?: number }) {
  const IconComp = icon === "Car" ? Car : Wrench;
  return (
    <div className="photo-cell" style={{ borderRadius: "var(--radius-md)", ...style }}>
      <IconComp size={iconSize} strokeWidth={1.5} />
      {label && <span style={{ position: "absolute", bottom: 8, left: 10, fontSize: 11, color: "#6b7793" }}>{label}</span>}
    </div>
  );
}

export function MarketChip({ name }: { name: string }) {
  const icon = { Facebook: "Facebook", OfferUp: "Tag", eBay: "ShoppingBag" }[name] || "Globe";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 999, padding: "3px 9px" }}>
      {name}
    </span>
  );
}

export function Card({ children, style = {}, pad = 18 }: { children: React.ReactNode; style?: React.CSSProperties; pad?: number }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", padding: pad, ...style }}>{children}</div>
  );
}

export function Skeleton({ w = "100%", h = 14, r = 8, style = {} }: { w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="cs-skel" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

// Mirrors the Overview layout so the loading state doesn't "jump" into content.
export function DashboardSkeleton() {
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 1180 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="cs-grid4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} pad={18} style={{ display: "grid", gap: 14 }}>
            <Skeleton w={38} h={38} r={10} />
            <div style={{ display: "grid", gap: 8 }}>
              <Skeleton w={64} h={28} />
              <Skeleton w="80%" h={12} />
            </div>
          </Card>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }} className="cs-grid-2">
        {[0, 1].map((col) => (
          <Card key={col} pad={0}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)" }}><Skeleton w={140} h={14} /></div>
            <div style={{ padding: "6px 18px 14px" }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0" }}>
                  <Skeleton w={col === 0 ? 52 : 30} h={col === 0 ? 40 : 30} r={col === 0 ? 8 : 999} />
                  <div style={{ flex: 1, display: "grid", gap: 7 }}>
                    <Skeleton w="60%" h={13} />
                    <Skeleton w="40%" h={11} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
