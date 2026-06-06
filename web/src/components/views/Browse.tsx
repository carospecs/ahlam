"use client";

import React from "react";
import { Camera, Car, Wrench, MapPin, Store, Search, MessageSquare, X, Send, LoaderCircle, Eye, SlidersHorizontal, ChevronDown, Plus } from "lucide-react";
import { PhotoCell, ConditionBadge, SellModeBadge, conditionColorOf } from "../UI";
import { csToast } from "../Dashboard";

interface MktPart {
  id: string; part: string; grade: string; price: number; fitment: string;
  category: string; photoUrl: string | null; views: number; shopName: string;
  location: string; note: string; desc: string; shopId?: string;
}
interface MktVehicle {
  id: string; year: string; make: string; model: string; trim: string; body: string;
  color: string; mileage: string; sellMode: string; askingPrice: number | null;
  views: number; shopId: string; shopName: string; location: string;
}

// Record a view (best-effort) when a buyer opens a post's detail.
function recordView(body: { listingId?: string; vehicleId?: string }) {
  try { fetch("/api/marketplace/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); } catch {}
}

export function Browse() {
  const [tab, setTab] = React.useState("parts");
  const [parts, setParts] = React.useState<MktPart[]>([]);
  const [vehicles, setVehicles] = React.useState<MktVehicle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [demo, setDemo] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [contact, setContact] = React.useState<{ listingId?: string; shopId?: string; subject?: string; title: string } | null>(null);
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
    fetch("/api/marketplace")
      .then((r) => r.json())
      .then((d) => { setParts(d.parts || []); setVehicles(d.vehicles || []); setDemo(!!d.demo); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const ql = q.trim().toLowerCase();

  // Filter options derived from what's actually in the feed.
  const partCats = ["All", ...Array.from(new Set(parts.map((p) => p.category).filter(Boolean))).sort()];
  const vehMakes = ["All", ...Array.from(new Set(vehicles.map((v) => v.make).filter(Boolean))).sort()];

  // Default feed order is newest-first (API sorts by created_at desc), so
  // "recommended" keeps that order; other modes re-sort a copy.
  const bySort = <T,>(arr: T[], val: (x: T) => number): T[] => {
    if (sort === "price-asc") return [...arr].sort((a, b) => val(a) - val(b));
    if (sort === "price-desc") return [...arr].sort((a, b) => val(b) - val(a));
    if (sort === "views") return [...arr].sort((a, b) => val(b) - val(a));
    return arr;
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, width: 260 }}>
          <Search size={15} color="var(--muted)" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search parts, cars, shops…" style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--foreground)", fontSize: 13.5, padding: "9px 0" }} />
          <button onClick={() => fileRef.current?.click()} style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, border: "none", background: photoSearchResult ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent", color: "var(--muted)", cursor: "pointer" }}>
            <Camera size={17} color={photoSearchResult ? "var(--accent)" : "var(--muted)"} />
          </button>
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
              {["A","B","C","D","F"].map((g) => {
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
            <Select label="Make" value={vehMake} onChange={setVehMake} options={vehMakes} />
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
                    <PhotoCell icon="Wrench" style={{ height: 150, borderRadius: 0 }} iconSize={40} />
                    <div style={{ position: "absolute", top: 10, left: 10 }}><ConditionBadge grade={l.grade} size="sm" /></div>
                  </div>
                  <div style={{ padding: 14, display: "grid", gap: 4 }}>
                    <div className="tnum" style={{ fontSize: 19, fontWeight: 800, color: "var(--success)" }}>${l.price}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.part}</div>
                    {l.fitment && <div style={{ fontSize: 12, color: "var(--muted)" }}>Fits {l.fitment}</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                      <Store size={13} /> <ShopLink id={l.shopId} name={l.shopName} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                      <MapPin size={13} /> {l.location || "—"} · <Eye size={12} /> {l.views} views
                    </div>
                    <button style={contactBtn} onClick={(e) => { e.stopPropagation(); setContact({ listingId: l.id, title: `${l.part} · ${l.shopName}` }); }}>
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
                  <PhotoCell icon="Wrench" style={{ height: 150, borderRadius: 0 }} iconSize={40} />
                  <div style={{ position: "absolute", top: 10, left: 10 }}><ConditionBadge grade={l.grade} size="sm" /></div>
                </div>
                <div style={{ padding: 14, display: "grid", gap: 4 }}>
                  <div className="tnum" style={{ fontSize: 19, fontWeight: 800, color: "var(--success)" }}>${l.price}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.part}</div>
                  {l.fitment && <div style={{ fontSize: 12, color: "var(--muted)" }}>Fits {l.fitment}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                    <Store size={13} /> <ShopLink id={l.shopId} name={l.shopName} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                    <MapPin size={13} /> {l.location || "—"} · <Eye size={12} /> {l.views} views
                  </div>
                  <button style={contactBtn} onClick={(e) => { e.stopPropagation(); setContact({ listingId: l.id, title: `${l.part} · ${l.shopName}` }); }}>
                    <MessageSquare size={14} /> Message seller
                  </button>
                </div>
              </div>
            ))}
          </div>
          {fParts.length > visible && <LoadMore onClick={() => setVisible((v) => v + PAGE)} remaining={fParts.length - visible} />}
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
                  <PhotoCell icon="Car" style={{ height: 168, borderRadius: 0 }} iconSize={46} />
                  <div style={{ position: "absolute", top: 10, left: 10 }}><SellModeBadge mode={v.sellMode} size="sm" /></div>
                </div>
                <div style={{ padding: 14, display: "grid", gap: 4 }}>
                  {v.askingPrice ? <div className="tnum" style={{ fontSize: 20, fontWeight: 800 }}>${v.askingPrice.toLocaleString()}</div> : <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>Parting out</div>}
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{v.year} {v.make} {v.model} {v.trim}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span>{v.mileage}</span><span>·</span><span>{v.body}</span><span>·</span><span>{v.color}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                    <Store size={13} /> <ShopLink id={v.shopId} name={v.shopName} /> · <MapPin size={12} /> {v.location || "—"} · <Eye size={12} /> {v.views} views
                  </div>
                  <button style={contactBtn} onClick={(e) => { e.stopPropagation(); setContact({ shopId: v.shopId, subject: `${v.year} ${v.make} ${v.model}`, title: `${v.year} ${v.make} ${v.model} · ${v.shopName}` }); }}>
                    <MessageSquare size={14} /> Message seller
                  </button>
                </div>
              </div>
            ))}
          </div>
          {fVehicles.length > visible && <LoadMore onClick={() => setVisible((v) => v + PAGE)} remaining={fVehicles.length - visible} />}
          </>
        )
      )}

      {detailPart && (
        <PartDetailModal
          part={detailPart}
          onClose={() => setDetailPart(null)}
          onContact={() => { setContact({ listingId: detailPart.id, title: `${detailPart.part} · ${detailPart.shopName}` }); setDetailPart(null); }}
        />
      )}
      {detailVehicle && (
        <VehicleDetailModal
          vehicle={detailVehicle}
          onClose={() => setDetailVehicle(null)}
          onContact={() => { setContact({ shopId: detailVehicle.shopId, subject: `${detailVehicle.year} ${detailVehicle.make} ${detailVehicle.model}`, title: `${detailVehicle.year} ${detailVehicle.make} ${detailVehicle.model} · ${detailVehicle.shopName}` }); setDetailVehicle(null); }}
        />
      )}
      {contact && <ContactModal target={contact} onClose={() => setContact(null)} />}
    </div>
  );
}

function DetailShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={ov} onMouseDown={onClose}>
      <div style={detailModal} className="fade-up" onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, zIndex: 2, width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", display: "grid", placeItems: "center" }}><X size={16} color="var(--muted)" /></button>
        {children}
      </div>
    </div>
  );
}

function MetaRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--muted)" }}>{icon} {children}</div>;
}

function PartDetailModal({ part, onClose, onContact }: { part: MktPart; onClose: () => void; onContact: () => void }) {
  return (
    <DetailShell onClose={onClose}>
      <div style={{ position: "relative" }}>
        <PhotoCell icon="Wrench" style={{ height: 230, borderRadius: 0 }} iconSize={56} />
        <div style={{ position: "absolute", top: 12, left: 12 }}><ConditionBadge grade={part.grade} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, padding: "6px 16px 0" }}>
        {[0, 1, 2].map((i) => <PhotoCell key={i} icon="Wrench" style={{ aspectRatio: "1", borderRadius: 9 }} iconSize={18} />)}
      </div>
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
        <MetaRow icon={<Store size={14} />}><ShopLink id={part.shopId} name={part.shopName} /></MetaRow>
        <MetaRow icon={<MapPin size={14} />}>{part.location || "—"}</MetaRow>
        <MetaRow icon={<Eye size={14} />}>{part.views} {part.views === 1 ? "person has" : "people have"} viewed this</MetaRow>
        <button style={primaryBtn} onClick={onContact}><MessageSquare size={15} /> Message seller</button>
      </div>
    </DetailShell>
  );
}

function VehicleDetailModal({ vehicle: v, onClose, onContact }: { vehicle: MktVehicle; onClose: () => void; onContact: () => void }) {
  return (
    <DetailShell onClose={onClose}>
      <div style={{ position: "relative" }}>
        <PhotoCell icon="Car" style={{ height: 240, borderRadius: 0 }} iconSize={60} />
        <div style={{ position: "absolute", top: 12, left: 12 }}><SellModeBadge mode={v.sellMode} /></div>
      </div>
      <div style={{ padding: 18, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{v.year} {v.make} {v.model} {v.trim}</div>
          {v.askingPrice ? <div className="tnum" style={{ fontSize: 22, fontWeight: 800 }}>${v.askingPrice.toLocaleString()}</div> : <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>Parting out</div>}
        </div>
        <MetaRow icon={<Car size={14} />}>{[v.body, v.color].filter(Boolean).join(" · ") || "—"}</MetaRow>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--foreground)" }}>
          {v.sellMode === "both" ? "Selling whole or parting out — message for specific parts or the full vehicle." : "Whole-car sale. Message the seller for mileage, history, and condition details."}
        </p>
        <div style={{ height: 1, background: "var(--line)" }} />
        <MetaRow icon={<Store size={14} />}><ShopLink id={v.shopId} name={v.shopName} /></MetaRow>
        <MetaRow icon={<MapPin size={14} />}>{v.location || "—"}</MetaRow>
        <MetaRow icon={<Eye size={14} />}>{v.views} {v.views === 1 ? "person has" : "people have"} viewed this</MetaRow>
        <button style={primaryBtn} onClick={onContact}><MessageSquare size={15} /> Message seller</button>
      </div>
    </DetailShell>
  );
}

function ContactModal({ target, onClose }: { target: { listingId?: string; shopId?: string; subject?: string; title: string }; onClose: () => void }) {
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
      csToast("Message sent to seller");
      onClose();
    } catch {
      csToast("Could not send message");
      setBusy(false);
    }
  }

  return (
    <div style={ov} onMouseDown={onClose}>
      <div style={modal} className="fade-up" onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Message seller</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", display: "grid", placeItems: "center" }}><X size={16} color="var(--muted)" /></button>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{target.title}</div>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} style={{ width: "100%", padding: "11px 14px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", marginTop: 4 }} />
        <button onClick={send} disabled={busy} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 18px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
          {busy ? <LoaderCircle size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <Send size={15} />} {busy ? "Sending…" : "Send message"}
        </button>
      </div>
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

function LoadMore({ onClick, remaining }: { onClick: () => void; remaining: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
      <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600 }}>
        <Plus size={15} /> Load {Math.min(12, remaining)} more <span style={{ color: "var(--muted)" }}>({remaining} left)</span>
      </button>
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden" };
const contactBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 8, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" };
const ov: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 160, background: "rgba(7,11,22,0.72)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24 };
const modal: React.CSSProperties = { width: "min(440px, 100%)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", padding: 20, display: "grid", gap: 10, boxShadow: "0 40px 90px -30px rgba(0,0,0,0.8)" };
const detailModal: React.CSSProperties = { position: "relative", width: "min(480px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", boxShadow: "0 40px 90px -30px rgba(0,0,0,0.8)" };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, padding: "11px 16px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%" };
