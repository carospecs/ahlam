"use client";
// Type-ahead location field. As you type, it suggests real US places (OSM
// Nominatim); picking one fills the location text and hands back the ZIP +
// coordinates so the shop is registered with a real, geocoded address.
import React from "react";

interface Picked { label: string; zip: string; lat: string; lng: string }

export function AddressAutocomplete({ value, onChange, onSelect, placeholder, style, disabled }: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (p: Picked) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const [q, setQ] = React.useState(value || "");
  const [sug, setSug] = React.useState<any[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const justPicked = React.useRef(false);

  React.useEffect(() => { setQ(value || ""); }, [value]);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  React.useEffect(() => {
    if (justPicked.current) { justPicked.current = false; return; }
    const t = q.trim();
    if (!open || t.length < 3) { setSug([]); return; }
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=5&q=${encodeURIComponent(t)}`, { headers: { Accept: "application/json" } });
        const d = await r.json();
        setSug(Array.isArray(d) ? d : []);
      } catch { setSug([]); }
      setLoading(false);
    }, 350);
    return () => clearTimeout(id);
  }, [q, open]);

  function pick(s: any) {
    const a = s.address || {};
    const city = a.city || a.town || a.village || a.hamlet || a.county || "";
    const state = a.state || "";
    const label = [city, state].filter(Boolean).join(", ") || (s.display_name || "").split(",").slice(0, 2).join(", ");
    justPicked.current = true;
    setQ(label);
    onChange(label);
    onSelect?.({ label, zip: a.postcode || "", lat: s.lat, lng: s.lon });
    setOpen(false);
    setSug([]);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={q}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        style={style}
        autoComplete="off"
      />
      {open && (loading || sug.length > 0) && (
        <div className="fade-up" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, marginTop: 4, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 18px 40px -16px rgba(0,0,0,0.35)", overflow: "hidden" }}>
          {loading && sug.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12.5, color: "var(--muted)" }}>Searching…</div>}
          {sug.map((s, i) => {
            const a = s.address || {};
            const city = a.city || a.town || a.village || a.hamlet || a.county || "";
            const main = [city, a.state].filter(Boolean).join(", ");
            return (
              <button key={i} type="button" className="cs-row" onClick={() => pick(s)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none", background: "transparent", color: "var(--foreground)", fontSize: 13.5, cursor: "pointer", borderBottom: i < sug.length - 1 ? "1px solid var(--line)" : "none" }}>
                <span style={{ fontWeight: 600 }}>{main || s.display_name?.split(",")[0]}</span>
                {a.postcode && <span style={{ color: "var(--muted)" }}> · {a.postcode}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
