"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Car, X, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useData } from "../Dashboard";

type PhotoGroup = { key: string; name: string; desc: string; photos: { url: string; label: string }[] };

const vehLabel = (v: any) => [v.year, v.make, v.model].filter(Boolean).join(" ") || v.title || "Vehicle";

// Every photo across the shop, grouped by the car it belongs to — the car's own
// gallery plus each of its parts' photos. Click any photo to view it full-screen.
export function Gallery() {
  const { vehicles, listings } = useData();
  const [lb, setLb] = React.useState<{ images: string[]; i: number } | null>(null);
  // Each car post is collapsed under a single cover photo; expand to reveal the rest.
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const toggle = (key: string) => setExpanded((s) => {
    const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n;
  });

  const groups = React.useMemo<PhotoGroup[]>(() => {
    const vById = new Map<string, any>((vehicles || []).map((v: any) => [v.id, v]));
    const m = new Map<string, PhotoGroup>();
    const ensure = (key: string, name: string, desc: string) => {
      if (!m.has(key)) m.set(key, { key, name, desc, photos: [] });
      const g = m.get(key)!;
      if (!g.desc && desc) g.desc = desc;
      return g;
    };
    const seen = new Set<string>();
    const push = (key: string, name: string, url: string, label: string, desc = "") => {
      if (!url || seen.has(key + url)) return; seen.add(key + url);
      ensure(key, name, desc).photos.push({ url, label });
    };
    const vehDesc = (v: any) => String(v.description || v.title || "").trim();
    for (const v of vehicles || []) {
      const imgs = Array.isArray(v.images) ? v.images : (v.image ? [v.image] : []);
      imgs.filter(Boolean).forEach((u: string) => push(v.id, vehLabel(v), u, "Whole car", vehDesc(v)));
    }
    for (const l of listings || []) {
      const imgs = (Array.isArray(l.images) && l.images.length ? l.images : (l.image ? [l.image] : [])).filter(Boolean);
      if (!imgs.length) continue;
      const v = l.vehicleId ? vById.get(l.vehicleId) : null;
      const gKey = v ? v.id : "__other";
      const gName = v ? vehLabel(v) : "Other parts";
      const gDesc = v ? vehDesc(v) : "";
      imgs.forEach((u: string) => push(gKey, gName, u, l.part || "Part", gDesc));
    }
    return [...m.values()].filter((g) => g.photos.length)
      .sort((a, b) => (a.key === "__other" ? 1 : b.key === "__other" ? -1 : a.name.localeCompare(b.name)));
  }, [vehicles, listings]);

  const total = groups.reduce((s, g) => s + g.photos.length, 0);
  const carCount = groups.filter((g) => g.key !== "__other").length;

  React.useEffect(() => {
    if (!lb) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLb(null);
      if (e.key === "ArrowRight") setLb((s) => s && { ...s, i: (s.i + 1) % s.images.length });
      if (e.key === "ArrowLeft") setLb((s) => s && { ...s, i: (s.i - 1 + s.images.length) % s.images.length });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lb]);

  if (!total) {
    return <div style={{ padding: 48, textAlign: "center", color: "var(--muted)", fontSize: 14, border: "1px dashed var(--line)", borderRadius: 14 }}>No photos yet — add a vehicle to start building your gallery.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{carCount} car{carCount === 1 ? "" : "s"} posted</span>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>· {total} photo{total === 1 ? "" : "s"} across your inventory</span>
      </div>
      {groups.map((g) => {
        const isOpen = expanded.has(g.key);
        const many = g.photos.length > 1;
        const shown = isOpen ? g.photos : g.photos.slice(0, 1);
        return (
          <div key={g.key}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: g.desc ? 4 : 11 }}>
              <Car size={15} color="var(--muted)" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{g.name}</span>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>· {g.photos.length} photo{g.photos.length === 1 ? "" : "s"}</span>
              {many && (
                <button onClick={() => toggle(g.key)} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--foreground)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 9, padding: "5px 11px", cursor: "pointer" }}>
                  {isOpen ? "Collapse" : `Show all ${g.photos.length}`}
                  <ChevronDown size={14} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s var(--ease-out)" }} />
                </button>
              )}
            </div>
            {g.desc && <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 11, maxWidth: 680, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{g.desc}</div>}
            <div style={{ display: "grid", gridTemplateColumns: isOpen ? "repeat(auto-fill, minmax(132px, 1fr))" : "minmax(0, 232px)", gap: 10 }}>
              {shown.map((p, i) => {
                const openLightbox = isOpen || !many;
                return (
                  <button key={i} onClick={() => (openLightbox ? setLb({ images: g.photos.map((x) => x.url), i }) : toggle(g.key))} title={openLightbox ? p.label : `Show all ${g.photos.length} photos`} style={{ padding: 0, border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", cursor: openLightbox ? "zoom-in" : "pointer", background: "var(--surface2)", aspectRatio: "1", position: "relative", display: "block" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.label} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 8px 6px", fontSize: 11, fontWeight: 600, color: "#fff", textAlign: "left", background: "linear-gradient(transparent, rgba(7,11,22,0.82))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{!isOpen && many ? `+${g.photos.length - 1} more` : p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {lb && typeof document !== "undefined" && createPortal(
        <div onClick={() => setLb(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4,7,14,0.93)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24 }}>
          <button onClick={() => setLb(null)} style={{ position: "absolute", top: 18, right: 18, width: 40, height: 40, borderRadius: 999, display: "grid", placeItems: "center", border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer" }}><X size={20} /></button>
          {lb.images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setLb((s) => s && { ...s, i: (s.i - 1 + s.images.length) % s.images.length }); }} style={{ position: "absolute", left: 18, width: 44, height: 44, borderRadius: 999, display: "grid", placeItems: "center", border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer" }}><ChevronLeft size={24} /></button>
              <button onClick={(e) => { e.stopPropagation(); setLb((s) => s && { ...s, i: (s.i + 1) % s.images.length }); }} style={{ position: "absolute", right: 18, width: 44, height: 44, borderRadius: 999, display: "grid", placeItems: "center", border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer" }}><ChevronRight size={24} /></button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lb.images[lb.i]} alt="" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "92vw", maxHeight: "86vh", objectFit: "contain", borderRadius: 12 }} />
          {lb.images.length > 1 && <div style={{ position: "absolute", bottom: 20, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{lb.i + 1} / {lb.images.length}</div>}
        </div>, document.body)}
    </div>
  );
}
