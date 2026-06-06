"use client";

import React from "react";
import { CONDITION_GRADE_MAP } from "@ahlam/shared";
import {
  Wrench, WrenchIcon, Car, Check, CircleCheck, Send, PencilLine,
  ChevronDown, LoaderCircle, Search as SearchIcon,
} from "lucide-react";

// Combobox: a text field that's also a filterable dropdown. Type freely OR pick
// from the suggested list. Used by the interchange guided form (part / make /
// model / year). `onOpen` lets the caller lazy-load options (e.g. NHTSA models).
export function Combobox({
  label, value, onChange, options, placeholder, icon, loading, disabled, onOpen, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onOpen?: () => void;
  hint?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const q = value.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)).slice(0, 60) : options.slice(0, 60);
  return (
    <div ref={ref} style={{ display: "grid", gap: 6, position: "relative" }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
        {label}{hint && <span style={{ fontWeight: 500, opacity: 0.8 }}> · {hint}</span>}
      </span>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", background: disabled ? "var(--background)" : "var(--surface2)", border: `1px solid ${open ? "var(--accent)" : "var(--line)"}`, borderRadius: 10, opacity: disabled ? 0.6 : 1, transition: "border-color 0.15s" }}
        onClick={() => { if (!disabled) { setOpen(true); onOpen?.(); } }}
      >
        {icon && <span style={{ flexShrink: 0, display: "grid", placeItems: "center", color: "var(--muted)" }}>{icon}</span>}
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => { if (!disabled) { setOpen(true); onOpen?.(); } }}
          placeholder={placeholder}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 13.5, padding: "11px 0", minWidth: 0 }}
        />
        {loading ? <LoaderCircle size={15} className="spin" color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />}
      </div>
      {open && !disabled && (filtered.length > 0 || loading) && (
        <div className="fade-up" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 40, marginTop: 4, maxHeight: 240, overflowY: "auto", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 18px 40px -16px rgba(0,0,0,0.35)" }}>
          {loading && <div style={{ padding: "10px 12px", fontSize: 12.5, color: "var(--muted)" }}>Loading…</div>}
          {!loading && filtered.map((o) => (
            <button key={o} type="button" className="cs-row" onClick={() => { onChange(o); setOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none", background: o === value ? "var(--accent-tint)" : "transparent", color: "var(--foreground)", fontSize: 13.5, cursor: "pointer" }}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function conditionColorOf(grade: string): string {
  return CONDITION_GRADE_MAP[grade]?.color || "var(--muted)";
}

export function ConditionBadge({ grade, size = "md" }: { grade: string; size?: "sm" | "md" }) {
  const c = CONDITION_GRADE_MAP[grade]?.color || "var(--muted)";
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

export function Skeleton({ width = "100%", height = 14, borderRadius = 8 }: { width?: number | string; height?: number | string; borderRadius?: number }) {
  return <div className="cs-skel" style={{ width, height, borderRadius }} />;
}

// Mirrors the Overview layout so the loading state doesn't "jump" into content.
export function DashboardSkeleton() {
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 1180 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="cs-grid4">
          {[0, 1, 2, 3].map((i) => (
          <Card key={i} pad={18} style={{ display: "grid", gap: 14 }}>
            <Skeleton width={38} height={38} borderRadius={10} />
            <div style={{ display: "grid", gap: 8 }}>
              <Skeleton width={64} height={28} />
              <Skeleton width="80%" height={12} />
            </div>
          </Card>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }} className="cs-grid-2">
        {[0, 1].map((col) => (
          <Card key={col} pad={0}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)" }}><Skeleton width={140} height={14} /></div>
            <div style={{ padding: "6px 18px 14px" }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0" }}>
                  <Skeleton width={col === 0 ? 52 : 30} height={col === 0 ? 40 : 30} borderRadius={col === 0 ? 8 : 999} />
                  <div style={{ flex: 1, display: "grid", gap: 7 }}>
                    <Skeleton width="60%" height={13} />
                    <Skeleton width="40%" height={11} />
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
