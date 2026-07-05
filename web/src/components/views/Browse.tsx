"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Camera, Car, Wrench, MapPin, Store, Search, MessageSquare, X, Send, LoaderCircle, Eye, SlidersHorizontal, ChevronDown, Phone, MessageCircle, ShieldCheck, ShoppingBag } from "lucide-react";
import { PhotoCell, ConditionBadge, conditionColorOf, Stars, VerifiedBadge } from "../UI";
import { csToast } from "../Dashboard";

interface MktPart {
  id: string; part: string; grade: string; price: number; fitment: string;
  category: string; photoUrl: string | null; photoUrls?: string[] | null; views: number; shopName: string;
  location: string; note: string; desc: string; shopId?: string; phone?: string | null;
  distance?: number | null; driveTime?: number | null;
  verified?: boolean; rating?: number; ratingCount?: number;
}
interface MktVehicle {
  id: string; year: string; make: string; model: string; trim: string; body: string;
  color: string; mileage: string; sellMode: string; askingPrice: number | null;
  views: number; shopId: string; shopName: string; location: string; phone?: string | null;
  photoUrl?: string | null; photoUrls?: string[] | null; distance?: number | null; driveTime?: number | null;
  verified?: boolean; rating?: number; ratingCount?: number;
}

// Record a view (best-effort) when a buyer opens a post's detail.
function recordView(body: { listingId?: string; vehicleId?: string }) {
  try { fetch("/api/marketplace/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); } catch {}
}

// Buy now — start a Stripe Checkout session and send the buyer to it. Returns
// false if checkout wasn't available (the caller resets its busy state).
async function startCheckout(body: { listingId?: string; vehicleId?: string }): Promise<boolean> {
  try {
    const r = await fetch("/api/payments/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.url) { window.location.href = d.url; return true; }
    csToast(d.error || "Checkout isn't available right now");
  } catch { csToast("Couldn't reach checkout — try again"); }
  return false;
}

// Primary "Buy now" button with its own busy state. Shown on detail modals.
function BuyButton({ body }: { body: { listingId?: string; vehicleId?: string } }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      onClick={async () => { setBusy(true); const ok = await startCheckout(body); if (!ok) setBusy(false); }}
      disabled={busy}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, padding: "11px 16px", borderRadius: 11, border: "none", background: "var(--success)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", opacity: busy ? 0.6 : 1 }}
    >
      {busy ? <LoaderCircle size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <ShoppingBag size={15} />} {busy ? "Starting checkout…" : "Buy now — secure checkout"}
    </button>
  );
}

export function Browse() {
  const [tab, setTab] = React.useState("parts");
  const [parts, setParts] = React.useState<MktPart[]>([]);
  const [vehicles, setVehicles] = React.useState<MktVehicle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [demo, setDemo] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [contact, setContact] = React.useState<{ listingId?: string; shopId?: string; subject?: string; title: string; phone?: string | null } | null>(null);
  const [detailPart, setDetailPart] = React.useState<MktPart | null>(null);
  const [detailVehicle, setDetailVehicle] = React.useState<MktVehicle | null>(null);
  const [sort, setSort] = React.useState("recommended");
  const [partCat, setPartCat] = React.useState("All");
  const [vehMake, setVehMake] = React.useState("All");
  const [visible, setVisible] = React.useState(12);
  const PAGE = 12;
  const [photoSearchResult, setPhotoSearchResult] = React.useState<MktPart[] | null>(null);
  const [selectedConditions, setSelectedConditions] = React.useState<Set<string>>(new Set());
  const [priceMin, setPriceMin] = React.useState("");
  const [priceMax, setPriceMax] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [focusedSuggestion, setFocusedSuggestion] = React.useState(-1);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  const COMMON_PARTS = [
    "Hood", "Front Bumper Cover", "Rear Bumper Cover", "Grille", "Front Fender",
    "Rear Quarter Panel", "Front Door", "Rear Door", "Trunk Lid", "Tailgate",
    "Liftgate", "Side Mirror", "Roof Panel", "Windshield", "Back Glass",
    "Front Door Window", "Rear Door Window", "Quarter Glass", "Headlight Assembly",
    "Tail Light Assembly", "Fog Light", "Wheel", "Tire", "Engine", "Transmission",
    "Radiator", "Alternator", "Starter", "Battery", "AC Compressor", "Front Seat",
    "Rear Seat", "Seat Belt", "Steering Wheel", "Center Console", "Dashboard",
    "Instrument Cluster", "Glove Box", "Airbag", "Door Panel", "Sun Visor",
    "Rear View Mirror", "Shifter", "Serpentine Belt", "Idler Pulley",
    "Tensioner Pulley", "Brake Caliper", "Brake Rotor", "Brake Pad",
    "Shock Absorber", "Strut Assembly", "Control Arm", "Ball Joint",
    "Tie Rod End", "Sway Bar Link", "CV Axle", "Drive Shaft",
    "Radiator Fan", "Intercooler", "Turbocharger", "Catalytic Converter",
    "Exhaust Manifold", "Muffler", "Oxygen Sensor", "Fuel Pump",
    "Fuel Injector", "Throttle Body", "Mass Airflow Sensor", "ECU",
    "Ignition Coil", "Spark Plug", "Distributor", "Wiring Harness",
    "Fuse Box", "Relay", "Power Steering Pump", "Water Pump",
    "Thermostat", "Heater Core", "Blower Motor", "Condenser",
    "Evaporator", "Compressor", "Hose", "Belt", "Motor Mount",
    "Transmission Mount", "Leaf Spring", "Coil Spring", "Wheel Hub",
    "Wheel Bearing", "Knuckle", "Spindle", "Axle Shaft",
    "Differential", "Transfer Case", "Clutch", "Flywheel",
    "Starter Solenoid", "Voltage Regulator",
  ];

  function updateSearchSuggestions(value: string) {
    if (!value.trim()) { setSuggestions([]); setShowSuggestions(false); return; }
    const lower = value.toLowerCase();
    const fromParts = new Set(parts.map(p => p.part));
    const fromVehicles = new Set(vehicles.map(v => `${v.year} ${v.make} ${v.model}`));
    const fromCommon = COMMON_PARTS;
    const all = [...new Set([...fromCommon, ...fromParts, ...fromVehicles])];
    const matches = all.filter(s => s.toLowerCase().includes(lower)).slice(0, 8);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
    setFocusedSuggestion(-1);
  }

  function pickSuggestion(s: string) {
    setQ(s);
    setShowSuggestions(false);
    setSuggestions([]);
    inputRef.current?.blur();
  }

  function onSearchKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedSuggestion(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedSuggestion(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusedSuggestion >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[focusedSuggestion]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  function toggleCondition(g: string) {
    setSelectedConditions((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  }

  async function onPhotoSelected(file: File) {
    const fd = new FormData();
    fd.append("photo", file);
    try {
      const r = await fetch("/api/search-by-photo", { method: "POST", body: fd });
      const d = await r.json();
      setPhotoSearchResult(d.results || []);
    } catch {}
  }

  // Reset how many cards are shown whenever the result set changes.
  React.useEffect(() => { setVisible(PAGE); }, [tab, q, sort, partCat, vehMake]);

  function openPart(p: MktPart) {
    recordView({ listingId: p.id });
    setParts((prev) => prev.map((x) => (x.id === p.id ? { ...x, views: x.views + 1 } : x)));
    setDetailPart({ ...p, views: p.views + 1 });
  }
  function openVehicle(v: MktVehicle) {
    recordView({ vehicleId: v.id });
    setVehicles((prev) => prev.map((x) => (x.id === v.id ? { ...x, views: x.views + 1 } : x)));
    setDetailVehicle({ ...v, views: v.views + 1 });
  }

  React.useEffect(() => {
    const params = new URLSearchParams();
    // "Recommended" = nearest: ask for the buyer's location and let the API sort
    // both parts and vehicles by distance.
    if (sort === "recommended" || sort === "distance") {
      params.set("sort", "distance");
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => { params.set("lat", String(pos.coords.latitude)); params.set("lng", String(pos.coords.longitude)); fetchMarket(params); },
          () => fetchMarket(params),
          { timeout: 5000, enableHighAccuracy: false }
        );
      } else fetchMarket(params);
    } else {
      params.set("sort", sort);
      fetchMarket(params);
    }
    function fetchMarket(p: URLSearchParams) {
      fetch(`/api/marketplace?${p.toString()}`)
        .then((r) => r.json())
        .then((d) => { setParts(d.parts || []); setVehicles(d.vehicles || []); setDemo(!!d.demo); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [sort]);

  const ql = q.trim().toLowerCase();

  // Filter options derived from what's actually in the feed.
  const partCats = ["All", ...Array.from(new Set(parts.map((p) => p.category).filter(Boolean))).sort()];
  const vehMakes = ["All", ...Array.from(new Set(vehicles.map((v) => v.make).filter(Boolean))).sort()];

  // Default feed order is newest-first (API sorts by created_at desc), so
  // "recommended" keeps that order; other modes re-sort a copy.
  const bySort = <T extends { distance?: number | null },>(arr: T[], val: (x: T) => number): T[] => {
    if (sort === "price-asc") return [...arr].sort((a, b) => val(a) - val(b));
    if (sort === "price-desc") return [...arr].sort((a, b) => val(b) - val(a));
    if (sort === "views") return [...arr].sort((a, b) => val(b) - val(a));
    // Recommended = nearest first (items without a known distance sink to the end).
    return [...arr].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  };

  const fParts = bySort(
    parts
      .filter((p) => partCat === "All" || p.category === partCat)
      .filter((p) => selectedConditions.size === 0 || selectedConditions.has(p.grade))
      .filter((p) => !priceMin || p.price >= Number(priceMin))
      .filter((p) => !priceMax || p.price <= Number(priceMax))
      .filter((p) => !ql || `${p.part} ${p.fitment} ${p.category} ${p.shopName}`.toLowerCase().includes(ql)),
    sort === "views" ? (p) => p.views : (p) => p.price
  );
  const fVehicles = bySort(
    vehicles
      .filter((v) => vehMake === "All" || v.make === vehMake)
      .filter((v) => !ql || `${v.year} ${v.make} ${v.model} ${v.trim} ${v.shopName}`.toLowerCase().includes(ql)),
    sort === "views" ? (v) => v.views : (v) => v.askingPrice ?? 0
  );

  const shownParts = fParts.slice(0, visible);
  const shownVehicles = fVehicles.slice(0, visible);

  // Infinite scroll: reveal more cards as the sentinel scrolls into view —
  // no "load more" button, everything streams in as the user scrolls down.
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setVisible((v) => v + PAGE);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [tab, q, sort, partCat, vehMake, visible, fParts.length, fVehicles.length]);

  return (
    <div style={{ maxWidth: 1180, display: "grid", gap: 18 }}>
      {demo && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--muted)", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 14px" }}>
          <Store size={14} color="var(--accent)" /> Showing sample nearby listings — as other shops post, real inventory appears here.
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 5 }}>
          {[["parts", "Parts", Wrench, fParts.length] as const, ["vehicles", "Vehicles", Car, fVehicles.length] as const].map(([id, label, IconComp, n]) => {
            const on = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 9, border: "none", background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--muted)", fontSize: 14, fontWeight: 600 }}>
                <IconComp size={16} /> {label} <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>{n}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, width: 260, position: "relative" }}>
          <Search size={15} color="var(--muted)" />
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); updateSearchSuggestions(e.target.value); }} onFocus={() => { if (q.trim()) updateSearchSuggestions(q); }} onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} onKeyDown={onSearchKeyDown} placeholder="Search parts, cars, shops…" style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 13.5, padding: "9px 0" }} />
          {q && <button onClick={() => { setQ(""); setSuggestions([]); setShowSuggestions(false); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={14} color="var(--muted)" /></button>}
          <button onClick={() => fileRef.current?.click()} style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, border: "none", background: photoSearchResult ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent", color: "var(--muted)", cursor: "pointer" }}>
            <Camera size={17} color={photoSearchResult ? "var(--accent)" : "var(--muted)"} />
          </button>
          {showSuggestions && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, boxShadow: "0 12px 40px -8px rgba(0,0,0,0.5)", zIndex: 50, overflow: "hidden" }}>
              {suggestions.map((s, i) => (
                <button key={s} onMouseDown={() => pickSuggestion(s)} onMouseEnter={() => setFocusedSuggestion(i)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", border: "none", borderBottom: i < suggestions.length - 1 ? "1px solid var(--line)" : "none", background: i === focusedSuggestion ? "var(--surface2)" : "transparent", color: "var(--foreground)", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
                  <Search size={12} style={{ marginRight: 8, opacity: 0.5 }} /> {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhotoSelected(f); e.target.value = ""; }} />
      </div>

      {!loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--muted)" }}><SlidersHorizontal size={14} /> Filter</span>
          {tab === "parts" ? (
            <>
              <Select label="Category" value={partCat} onChange={setPartCat} options={partCats} />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Grade:</span>
              {["A","B","C"].map((g) => {
                const on = selectedConditions.has(g);
                const color = conditionColorOf(g);
                return (
                  <button key={g} onClick={() => toggleCondition(g)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 9px", borderRadius: 7, border: on ? `2px solid ${color}` : "1px solid var(--line)", background: on ? `color-mix(in srgb, ${color} 14%, transparent)` : "transparent", color: on ? color : "var(--muted)", fontSize: 12, fontWeight: 700 }}>
                    {g}
                  </button>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>$</span>
                <input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="Min" style={{ width: 62, padding: "6px 8px", borderRadius: 7, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 12, outline: "none" }} />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>–</span>
                <input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="Max" style={{ width: 62, padding: "6px 8px", borderRadius: 7, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 12, outline: "none" }} />
              </div>
            </>
          ) : (
            <Select label="Company/Brand" value={vehMake} onChange={setVehMake} options={vehMakes} />
          )}
          <Select label="Sort" value={sort} onChange={setSort} options={[["recommended", "Recommended"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"], ["views", "Most viewed"]]} />
          <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }}>
            {(tab === "parts" ? fParts.length : fVehicles.length)} result{(tab === "parts" ? fParts.length : fVehicles.length) === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>Loading marketplace…</div>
      ) : tab === "parts" ? (
        <>
        {photoSearchResult && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>
              <Camera size={16} /> Photo search <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {photoSearchResult.length} match{photoSearchResult.length === 1 ? "" : "es"}</span>
              <button onClick={() => setPhotoSearchResult(null)} style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>Clear</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
              {photoSearchResult.map((l) => (
                <div key={l.id} style={{ ...card, cursor: "pointer" }} onClick={() => openPart(l)} className="cs-hover-card">
                  <div style={{ position: "relative" }}>
                    <PhotoCell icon="Wrench" url={l.photoUrl} style={{ height: 150, borderRadius: 0 }} iconSize={40} />
                    <div style={{ position: "absolute", top: 10, left: 10 }}><ConditionBadge grade={l.grade} size="sm" /></div>
                  </div>
                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                    <div className="tnum" style={{ fontSize: 19, fontWeight: 800, color: "var(--success)" }}>${l.price}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.part}</div>
                    {l.fitment && <div style={{ fontSize: 12, color: "var(--muted)" }}>Fits {l.fitment}</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                      <Store size={13} /> <ShopLink id={l.shopId} name={l.shopName} />{l.verified ? <VerifiedBadge size={12} /> : null}{(l.ratingCount ?? 0) > 0 ? <>· <Stars value={l.rating || 0} count={l.ratingCount} size={11} /></> : null}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                      <MapPin size={13} /> {l.location || "—"}{l.distance != null ? ` · ${l.distance} mi` : ""}{l.driveTime != null ? ` · ~${l.driveTime} min` : ""} · <Eye size={12} /> {l.views > 0 ? `${l.views} views` : "New"}
                    </div>
                    <button style={contactBtn} onClick={(e) => { e.stopPropagation(); setContact({ listingId: l.id, title: `${l.part} · ${l.shopName}`, phone: l.phone }); }}>
                      <MessageSquare size={14} /> Message seller
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {fParts.length > 0 && (
          <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {shownParts.map((l) => (
              <div key={l.id} style={{ ...card, cursor: "pointer" }} onClick={() => openPart(l)} className="cs-hover-card">
                <div style={{ position: "relative" }}>
                  <PhotoCell icon="Wrench" url={l.photoUrl} style={{ height: 150, borderRadius: 0 }} iconSize={40} />
                  <div style={{ position: "absolute", top: 10, left: 10 }}><ConditionBadge grade={l.grade} size="sm" /></div>
                </div>
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <div className="tnum" style={{ fontSize: 19, fontWeight: 800, color: "var(--success)" }}>${l.price}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.part}</div>
                  {l.fitment && <div style={{ fontSize: 12, color: "var(--muted)" }}>Fits {l.fitment}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                    <Store size={13} /> <ShopLink id={l.shopId} name={l.shopName} />{l.verified ? <VerifiedBadge size={12} /> : null}{(l.ratingCount ?? 0) > 0 ? <>· <Stars value={l.rating || 0} count={l.ratingCount} size={11} /></> : null}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                    <MapPin size={13} /> {l.location || "—"}{l.distance != null ? ` · ${l.distance} mi` : ""}{l.driveTime != null ? ` · ~${l.driveTime} min` : ""} · <Eye size={12} /> {l.views > 0 ? `${l.views} views` : "New"}
                  </div>
                    <button style={contactBtn} onClick={(e) => { e.stopPropagation(); setContact({ listingId: l.id, title: `${l.part} · ${l.shopName}`, phone: l.phone }); }}>
                      <MessageSquare size={14} /> Message seller
                    </button>
                </div>
              </div>
            ))}
          </div>
          {fParts.length > visible && <div ref={sentinelRef} aria-hidden style={{ height: 1 }} />}
          </>
        )}
        {fParts.length === 0 && !photoSearchResult && <Empty label="No parts match your search." />}
        </>
      ) : (
        fVehicles.length === 0 ? <Empty label="No vehicles match your search." /> : (
          <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {shownVehicles.map((v) => (
              <div key={v.id} style={{ ...card, cursor: "pointer" }} onClick={() => openVehicle(v)} className="cs-hover-card">
                <div style={{ position: "relative" }}>
                  <PhotoCell icon="Car" url={v.photoUrl} style={{ height: 168, borderRadius: 0 }} iconSize={46} />
                </div>
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  {v.askingPrice ? <div className="tnum" style={{ fontSize: 20, fontWeight: 800 }}>${v.askingPrice.toLocaleString()}</div> : <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>Contact for price</div>}
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{v.year} {v.make} {v.model} {v.trim}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span>{v.mileage}</span><span>·</span><span>{v.body}</span><span>·</span><span>{v.color}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                    <Store size={13} /> <ShopLink id={v.shopId} name={v.shopName} />{v.verified ? <VerifiedBadge size={12} /> : null}{(v.ratingCount ?? 0) > 0 ? <> · <Stars value={v.rating || 0} count={v.ratingCount} size={11} /></> : null} · <MapPin size={12} /> {v.location || "—"}{v.distance != null ? ` · ${v.distance} mi` : ""}{v.driveTime != null ? ` · ~${v.driveTime} min` : ""} · <Eye size={12} /> {v.views > 0 ? `${v.views} views` : "New"}
                  </div>
                  <button style={contactBtn} onClick={(e) => { e.stopPropagation(); setContact({ shopId: v.shopId, subject: `${v.year} ${v.make} ${v.model}`, title: `${v.year} ${v.make} ${v.model} · ${v.shopName}`, phone: v.phone }); }}>
                    <MessageSquare size={14} /> Message seller
                  </button>
                </div>
              </div>
            ))}
          </div>
          {fVehicles.length > visible && <div ref={sentinelRef} aria-hidden style={{ height: 1 }} />}
          </>
        )
      )}

      {detailPart && (
        <PartDetailModal
          part={detailPart}
          onClose={() => setDetailPart(null)}
          onContact={() => { setContact({ listingId: detailPart.id, title: `${detailPart.part} · ${detailPart.shopName}`, phone: detailPart.phone }); setDetailPart(null); }}
        />
      )}
      {detailVehicle && (
        <VehicleDetailModal
          vehicle={detailVehicle}
          onClose={() => setDetailVehicle(null)}
          onContact={() => { setContact({ shopId: detailVehicle.shopId, subject: `${detailVehicle.year} ${detailVehicle.make} ${detailVehicle.model}`, title: `${detailVehicle.year} ${detailVehicle.make} ${detailVehicle.model} · ${detailVehicle.shopName}`, phone: detailVehicle.phone }); setDetailVehicle(null); }}
        />
      )}
      {contact && <ContactModal target={contact} onClose={() => setContact(null)} />}
    </div>
  );
}

// Render overlays to document.body. The Browse view lives inside .cs-content,
// whose direct children run the `cs-rise` transform animation — a transformed
// ancestor becomes the containing block for `position: fixed`, so an in-tree
// overlay would center against the (tall) content box instead of the viewport
// and land off-screen. Portaling out keeps the modal pinned to the viewport,
// matching how Dashboard mounts its own modals at the layout root.
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

function DetailShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <Portal>
      <div style={ov} onMouseDown={onClose}>
        <div style={detailModal} className="fade-up" onMouseDown={(e) => e.stopPropagation()}>
          <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, zIndex: 2, width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", display: "grid", placeItems: "center" }}><X size={16} color="var(--muted)" /></button>
          {children}
        </div>
      </div>
    </Portal>
  );
}

function MetaRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--muted)" }}>{icon} {children}</div>;
}

function PartDetailModal({ part, onClose, onContact }: { part: MktPart; onClose: () => void; onContact: () => void }) {
  const photos = part.photoUrls && part.photoUrls.length ? part.photoUrls : (part.photoUrl ? [part.photoUrl] : []);
  const [pi, setPi] = React.useState(0);
  return (
    <DetailShell onClose={onClose}>
      <div style={{ position: "relative" }}>
        <PhotoCell icon="Wrench" url={photos[pi] || part.photoUrl} style={{ height: 230, borderRadius: 0 }} iconSize={56} />
        <div style={{ position: "absolute", top: 12, left: 12 }}><ConditionBadge grade={part.grade} /></div>
      </div>
      {photos.length > 1 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(photos.length, 5)},1fr)`, gap: 6, padding: "6px 16px 0" }}>
          {photos.slice(0, 5).map((u, i) => (
            <button key={i} onClick={() => setPi(i)} style={{ padding: 0, border: i === pi ? "2px solid var(--accent)" : "1px solid var(--line)", borderRadius: 9, overflow: "hidden", cursor: "pointer", aspectRatio: "1", background: "var(--surface2)" }}>
              <PhotoCell icon="Wrench" url={u} style={{ width: "100%", height: "100%", borderRadius: 0 }} iconSize={18} />
            </button>
          ))}
        </div>
      )}
      <div style={{ padding: 18, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{part.part}</div>
          <div className="tnum" style={{ fontSize: 22, fontWeight: 800, color: "var(--success)" }}>${part.price}</div>
        </div>
        {part.fitment && <MetaRow icon={<Car size={14} />}>Fits {part.fitment}</MetaRow>}
        {part.category && <MetaRow icon={<Wrench size={14} />}>{part.category}</MetaRow>}
        {(part.desc || part.note) && (
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--foreground)" }}>{part.desc || part.note}</p>
        )}
        <div style={{ height: 1, background: "var(--line)" }} />
        <MetaRow icon={<Store size={14} />}><ShopLink id={part.shopId} name={part.shopName} />{part.verified ? <VerifiedBadge size={13} withLabel /> : null}</MetaRow>
        {part.shopId && !part.shopId.startsWith("demo") && <ShopReviews shopId={part.shopId} />}
        <MetaRow icon={<MapPin size={14} />}>{part.location || "—"}{part.distance != null ? ` · ${part.distance} mi · ~${part.driveTime} min drive` : ""}</MetaRow>
        {part.phone && <MetaRow icon={<Phone size={14} />}><a href={`tel:${part.phone}`} style={{ color: "var(--foreground)", textDecoration: "none" }}>{part.phone}</a></MetaRow>}
        <MetaRow icon={<Eye size={14} />}>{part.views > 0 ? `${part.views} ${part.views === 1 ? "person has" : "people have"} viewed this` : "Be the first to view this — newly listed"}</MetaRow>
        <BuyButton body={{ listingId: part.id }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11.5, color: "var(--muted)" }}>
          <ShieldCheck size={12} color="var(--success)" /> Payment held in escrow until you confirm you got the part
        </div>
        <button style={{ ...primaryBtn, background: "transparent", border: "1px solid var(--line)", color: "var(--foreground)" }} onClick={onContact}><MessageSquare size={15} /> Message seller</button>
      </div>
    </DetailShell>
  );
}

function VehicleDetailModal({ vehicle: v, onClose, onContact }: { vehicle: MktVehicle; onClose: () => void; onContact: () => void }) {
  const photos = v.photoUrls && v.photoUrls.length ? v.photoUrls : (v.photoUrl ? [v.photoUrl] : []);
  const [pi, setPi] = React.useState(0);
  return (
    <DetailShell onClose={onClose}>
      <div style={{ position: "relative" }}>
        <PhotoCell icon="Car" url={photos[pi] || v.photoUrl} style={{ height: 240, borderRadius: 0 }} iconSize={60} />
      </div>
      {photos.length > 1 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(photos.length, 5)},1fr)`, gap: 6, padding: "6px 16px 0" }}>
          {photos.slice(0, 5).map((u, i) => (
            <button key={i} onClick={() => setPi(i)} style={{ padding: 0, border: i === pi ? "2px solid var(--accent)" : "1px solid var(--line)", borderRadius: 9, overflow: "hidden", cursor: "pointer", aspectRatio: "1", background: "var(--surface2)" }}>
              <PhotoCell icon="Car" url={u} style={{ width: "100%", height: "100%", borderRadius: 0 }} iconSize={18} />
            </button>
          ))}
        </div>
      )}
      <div style={{ padding: 18, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{v.year} {v.make} {v.model} {v.trim}</div>
          {v.askingPrice ? <div className="tnum" style={{ fontSize: 22, fontWeight: 800 }}>${v.askingPrice.toLocaleString()}</div> : <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>Contact for price</div>}
        </div>
        <MetaRow icon={<Car size={14} />}>{[v.body, v.color].filter(Boolean).join(" · ") || "—"}</MetaRow>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--foreground)" }}>
          Whole-car listing. Message the seller for mileage, history, and condition details.
        </p>
        <div style={{ height: 1, background: "var(--line)" }} />
        <MetaRow icon={<Store size={14} />}><ShopLink id={v.shopId} name={v.shopName} />{v.verified ? <VerifiedBadge size={13} withLabel /> : null}</MetaRow>
        {v.shopId && !v.shopId.startsWith("demo") && <ShopReviews shopId={v.shopId} />}
        <MetaRow icon={<MapPin size={14} />}>{v.location || "—"}{v.distance != null ? ` · ${v.distance} mi · ~${v.driveTime} min drive` : ""}</MetaRow>
        {v.phone && <MetaRow icon={<Phone size={14} />}><a href={`tel:${v.phone}`} style={{ color: "var(--foreground)", textDecoration: "none" }}>{v.phone}</a></MetaRow>}
        <MetaRow icon={<Eye size={14} />}>{v.views} {v.views === 1 ? "person has" : "people have"} viewed this</MetaRow>
        {v.askingPrice ? (
          <>
            <BuyButton body={{ vehicleId: v.id }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11.5, color: "var(--muted)" }}>
              <ShieldCheck size={12} color="var(--success)" /> Payment held in escrow until you confirm the sale
            </div>
            <button style={{ ...primaryBtn, background: "transparent", border: "1px solid var(--line)", color: "var(--foreground)" }} onClick={onContact}><MessageSquare size={15} /> Message seller</button>
          </>
        ) : (
          <button style={primaryBtn} onClick={onContact}><MessageSquare size={15} /> Message seller</button>
        )}
      </div>
    </DetailShell>
  );
}

function ContactModal({ target, onClose }: { target: { listingId?: string; shopId?: string; subject?: string; title: string; phone?: string | null }; onClose: () => void }) {
  const [msg, setMsg] = React.useState("Hi — is this still available?");
  const [busy, setBusy] = React.useState(false);

  async function send() {
    if (!msg.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/marketplace/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: target.listingId, shopId: target.shopId, subject: target.subject, message: msg }),
      });
      const d = await r.json();
      if (!r.ok) { csToast(d.error || "Could not send"); setBusy(false); return; }
      // Sample/demo listings have no real seller — don't pretend the message landed.
      if (d.demo) { csToast("This is a sample listing — messaging turns on once real shops post"); onClose(); return; }
      csToast("Message sent — find it under Messages › Buying");
      onClose();
    } catch {
      csToast("Could not send message");
      setBusy(false);
    }
  }

  const waNumber = target.phone?.replace(/[^0-9]/g, "");
  const waHref = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}` : null;

  return (
    <Portal>
    <div style={ov} onMouseDown={onClose}>
      <div style={modal} className="fade-up" onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Message seller</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center" }}><X size={16} color="var(--muted)" /></button>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{target.title}</div>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} style={{ width: "100%", padding: "11px 14px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", marginTop: 4 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={send} disabled={busy} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 18px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
            {busy ? <LoaderCircle size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <Send size={15} />} {busy ? "Sending…" : "Send message"}
          </button>
          {waHref && (
            <a href={waHref} target="_blank" rel="noopener noreferrer" onClick={onClose} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 18px", borderRadius: 11, border: "none", background: "#25D366", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
              <MessageCircle size={15} /> WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}

// Inline reviews block shown in a listing's detail modal: rating summary, a few
// recent reviews, and a "write a review" form for signed-in buyers.
function ShopReviews({ shopId }: { shopId: string }) {
  const [data, setData] = React.useState<any>(null);
  const [writing, setWriting] = React.useState(false);
  const [rating, setRating] = React.useState(5);
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  function load() {
    fetch(`/api/reviews?shopId=${shopId}`).then((r) => r.json()).then(setData).catch(() => setData({ reviews: [], ratingCount: 0, ratingAvg: 0 }));
  }
  React.useEffect(load, [shopId]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, rating, body }) });
      const d = await r.json();
      if (!r.ok) { csToast(d.error || "Could not post review"); setBusy(false); return; }
      csToast("Thanks for your review");
      setWriting(false); setBody(""); load();
    } catch { csToast("Could not post review"); }
    setBusy(false);
  }

  if (!data) return null;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <Stars value={data.ratingAvg} count={data.ratingCount} size={14} />
        </div>
        {!writing && <button onClick={() => setWriting(true)} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>Write a review</button>}
      </div>

      {writing && (
        <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)" }}>
          <Stars value={rating} size={20} onRate={setRating} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="How was the part and the seller?" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 13.5, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={submit} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
              {busy ? <LoaderCircle size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Send size={13} />} Post review
            </button>
            <button onClick={() => setWriting(false)} style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {data.reviews?.slice(0, 4).map((rv: any) => (
        <div key={rv.id} style={{ display: "grid", gap: 3, paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Stars value={rv.rating} size={12} />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{rv.author}</span>
            {rv.verifiedPurchase && <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 600 }}>· Verified purchase</span>}
          </div>
          {rv.body && <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{rv.body}</div>}
        </div>
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div style={{ padding: 48, textAlign: "center", color: "var(--muted)", fontSize: 14, border: "1px dashed var(--line)", borderRadius: 14 }}>{label}</div>;
}

// Compact labeled dropdown. Accepts plain string options or [value, label] pairs.
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: (string | [string, string])[] }) {
  return (
    <label style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} style={{ appearance: "none", WebkitAppearance: "none", padding: "8px 30px 8px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
        {options.map((o) => {
          const [val, lab] = Array.isArray(o) ? o : [o, o];
          return <option key={val} value={val}>{label}: {lab}</option>;
        })}
      </select>
      <ChevronDown size={14} color="var(--muted)" style={{ position: "absolute", right: 9, pointerEvents: "none" }} />
    </label>
  );
}

// Shop name → public storefront. Plain text for demo shops (no real page).
function ShopLink({ id, name }: { id?: string; name: string }) {
  if (!id || id.startsWith("demo")) return <>{name}</>;
  return (
    <a href={`/shop/${id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}>
      {name}
    </a>
  );
}

// Full-height flex column so cards in a row match height and the "Message seller"
// button can be pushed to a shared baseline (marginTop:auto on the button).
const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" };
const contactBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: "auto", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" };
const ov: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 160, background: "rgba(7,11,22,0.72)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24 };
const modal: React.CSSProperties = { width: "min(440px, 100%)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", padding: 20, display: "grid", gap: 10, boxShadow: "0 40px 90px -30px rgba(0,0,0,0.8)" };
const detailModal: React.CSSProperties = { position: "relative", width: "min(480px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", boxShadow: "0 40px 90px -30px rgba(0,0,0,0.8)" };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, padding: "11px 16px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%" };
