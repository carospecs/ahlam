"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Send, Copy, Download, FileDown, ExternalLink, Info, CircleCheck, Share2, Tag, ShoppingBag, Globe, LoaderCircle, Link2, RefreshCw, ChevronDown, Car, X, AlertTriangle, Check, ImageDown } from "lucide-react";

// Render an overlay through the document body so its position:fixed always
// covers the real viewport — a transformed ancestor (the scrolled content area)
// would otherwise trap it mid-page and force the user to scroll to find it.
function Portal({ children }: { children: React.ReactNode }) {
  return typeof document !== "undefined" ? createPortal(children, document.body) : null;
}

// Phones can't run browser extensions, so on mobile we hand the post off via the
// native OS share sheet (text + photo files) → the real Facebook/OfferUp/etc. APP.
const isMobileDevice = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
import { Card, PhotoCell, ConditionBadge, SellModeBadge } from "../UI";
import { buildListingText, buildVehicleText } from "../data";
import { useData, csToast } from "../Dashboard";

// Platforms with no listing API — we prepare the text + photos and open the
// posting page so the seller just pastes and hits post.
const PREPARE_CHANNELS = [
  { key: "facebook", name: "Facebook Marketplace", icon: Share2, color: "#1877f2", url: "https://www.facebook.com/marketplace/create/item", note: "No posting API — we copy your text, save the photos, and open the form to paste & drag in. For bulk, use the Facebook catalog CSV below." },
  { key: "offerup", name: "OfferUp", icon: Tag, color: "var(--accent)", url: "https://offerup.com/post/", note: "Copies text and saves your photos so you just paste & drag them in." },
  { key: "craigslist", name: "Craigslist", icon: Globe, color: "var(--success)", url: "https://post.craigslist.org/", note: "Copies the formatted listing text and saves photos; pick your city." },
];

export function ExportCenter({ go }: { go: (id: string) => void; onVehicle?: (v: any) => void }) {
  const { listings, vehicles, shop } = useData();
  const ready = listings.filter((l: any) => l.status === "Draft" || l.status === "Posted");

  // Resolve a listing's car from its vehicleId (live data has no inline name).
  const vById = React.useMemo(
    () => new Map<string, any>((vehicles || []).map((v: any) => [v.id, v])),
    [vehicles]
  );
  const vehLabel = (v: any) => `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`.trim();
  const listingVeh = (l: any) => {
    const v = l.vehicleId ? vById.get(l.vehicleId) : null;
    return v ? vehLabel(v) : (l.vehicle || l.fitment || "Other parts");
  };

  // Group the ready parts under their vehicle so the export reads car-by-car.
  const groups = React.useMemo(() => {
    const m = new Map<string, { key: string; name: string; items: any[] }>();
    for (const l of ready) {
      const v = l.vehicleId ? vById.get(l.vehicleId) : null;
      const key = v ? v.id : "__other";
      const name = v ? vehLabel(v) : "Other parts";
      if (!m.has(key)) m.set(key, { key, name, items: [] });
      m.get(key)!.items.push(l);
    }
    return [...m.values()].sort((a, b) => (a.key === "__other" ? 1 : b.key === "__other" ? -1 : a.name.localeCompare(b.name)));
  }, [ready, vById]);

  // Cars that are listed whole (or both) — postable as a single vehicle ad.
  const sellableCars = (vehicles || []).filter((v: any) => v.sellMode === "whole" || v.sellMode === "both");

  const [ebay, setEbay] = React.useState<{ configured: boolean; connected: boolean; account: string | null; env: string } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null); // "part:id" | "lot:id" | "car:id"
  const [advanced, setAdvanced] = React.useState(false);
  const advRef = React.useRef<HTMLDivElement>(null);
  // Which vehicle groups are expanded. Default collapsed so it reads as a clean
  // list of vehicles; click a vehicle to reveal its parts.
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(new Set());
  const toggleGroup = (key: string) => setOpenGroups((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // "Post elsewhere" prep sheet (text + photos, shown before opening the marketplace).
  const [prepare, setPrepare] = React.useState<PrepareState | null>(null);
  // Fix-it sheet shown when an eBay publish fails, with tailored next steps.
  const [fix, setFix] = React.useState<{ raw: string; target: string; retry: () => void } | null>(null);

  const loadEbay = React.useCallback(() => {
    fetch("/api/ebay/status").then((r) => r.json()).then((d) => d.ok && setEbay(d)).catch(() => setEbay(null));
  }, []);
  React.useEffect(() => { loadEbay(); }, [loadEbay]);

  // Toast the result of the OAuth round-trip, then clean the URL.
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("ebay") === "connected") { csToast("eBay account connected"); loadEbay(); }
    if (p.get("ebay") === "error") csToast("Couldn't connect eBay — try again");
    if (p.has("ebay")) window.history.replaceState({}, "", window.location.pathname);
  }, [loadEbay]);

  // Photos can't be auto-attached to Facebook/OfferUp/Craigslist (no API), so we
  // save them to the seller's device — they drag them straight into the form.
  async function savePhotos(urls: string[], prefix: string) {
    const clean = urls.filter((u) => u && /^https?:\/\//.test(u));
    if (!clean.length) return 0;
    let n = 0;
    for (let i = 0; i < clean.length; i++) {
      try {
        const res = await fetch(clean[i]);
        const blob = await res.blob();
        const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${prefix}-${i + 1}.${ext}`; a.click();
        URL.revokeObjectURL(url); n++;
      } catch { /* skip a photo that won't fetch (CORS/offline) */ }
    }
    return n;
  }

  const slug = (s: string) => (s || "listing").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

  // Open the prep sheet — an editable card of the post — instead of dumping the
  // seller on a blank marketplace form. They review/fix the fields (and save the
  // fix back to the listing), then open the marketplace to paste.
  function prepareAndOpen(ch: typeof PREPARE_CHANNELS[number], l: any) {
    setPrepare({ channel: ch, kind: "part", entity: l, photos: [l.image, ...(Array.isArray(l.images) ? l.images : [])].filter(Boolean), prefix: slug(l.part) });
  }

  function prepareCar(ch: typeof PREPARE_CHANNELS[number], v: any) {
    setPrepare({ channel: ch, kind: "car", entity: v, photos: [v.image, ...(Array.isArray(v.images) ? v.images : [])].filter(Boolean), prefix: slug(`${v.year}-${v.make}-${v.model}`) });
  }

  // One publisher for parts, wholesale lots, and whole cars — body decides which.
  // On success we open the live listing; on failure we surface a Fix-it sheet
  // (with tailored steps + Retry) instead of a disappearing toast.
  async function ebayPublish(key: string, body: any, okMsg: string) {
    if (busy) return;
    setBusy(key);
    const target = key.startsWith("car") ? "vehicles" : "parts";
    try {
      const r = await fetch("/api/ebay/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { csToast(okMsg); window.open(d.url, "_blank", "noopener"); (window as any).csReloadData?.(); }
      else setFix({ raw: d.error || (d.notConnected ? "Connect your eBay account first." : "eBay couldn't publish this listing."), target, retry: () => ebayPublish(key, body, okMsg) });
    } catch {
      setFix({ raw: "Couldn't reach eBay — check your connection and try again.", target, retry: () => ebayPublish(key, body, okMsg) });
    }
    setBusy(null);
  }

  function downloadBlob(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url); csToast(`Downloaded ${filename}`);
  }
  function exportCSV() {
    const headers = ["Part", "Vehicle/Fitment", "Price", "Grade", "Status", "Description"];
    const rows = ready.map((l: any) => [l.part, listingVeh(l), l.price ?? "", l.grade ?? "", l.status, (l.desc || l.description || "").replace(/"/g, '""')]);
    const csv = [headers.join(","), ...rows.map((r: string[]) => r.map((v: string) => `"${v}"`).join(","))].join("\n");
    downloadBlob(csv, "listings.csv", "text/csv");
  }
  function exportJSON() {
    const data = ready.map((l: any) => ({ id: l.id, part: l.part, vehicle: listingVeh(l), fitment: l.fitment, price: l.price, grade: l.grade, status: l.status, description: l.desc || l.description }));
    downloadBlob(JSON.stringify(data, null, 2), "listings.json", "application/json");
  }

  // Facebook/Meta Commerce catalog feed. A shop with a Facebook Page Shop +
  // Commerce Manager catalog uploads this CSV (Data sources → Add items → Data
  // feed) to bulk-list everything — the only free, official way onto Facebook.
  function exportFacebookCSV() {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://ahlam.io";
    const shopUrl = shop?.id ? `${origin}/shop/${shop.id}` : origin;
    const headers = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "quantity_to_sell_on_facebook", "google_product_category", "product_type"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const withImg = ready.filter((l: any) => l.image && /^https?:\/\//.test(l.image));
    const rows = withImg.map((l: any) => {
      const v = l.vehicleId ? vById.get(l.vehicleId) : null;
      const title = [l.part, l.fitment || (v ? vehLabel(v) : "")].filter(Boolean).join(" — ").slice(0, 150);
      const price = Number(l.price) > 0 ? `${Number(l.price).toFixed(2)} USD` : "1.00 USD";
      return [
        `ahlam-${l.id}`, title, (l.desc || l.description || title).slice(0, 5000),
        "in stock", "used", price, shopUrl, l.image, v?.make || "OEM",
        "1", "Vehicles & Parts > Vehicle Parts & Accessories", l.category || "Auto Part",
      ].map(esc).join(",");
    });
    if (!rows.length) { csToast("No listings with a public photo to export — Facebook needs an image per item"); return; }
    downloadBlob([headers.join(","), ...rows].join("\n"), "facebook-catalog.csv", "text/csv");
    if (withImg.length < ready.length) csToast(`Exported ${withImg.length} of ${ready.length} — ${ready.length - withImg.length} skipped (no photo)`);
  }

  return (
    <div style={{ maxWidth: 1000, display: "grid", gap: 18 }}>
      {/* eBay — the real integration */}
      <Card style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap" }}>
          <span style={{ width: 46, height: 46, borderRadius: 12, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <ShoppingBag size={22} color="var(--accent)" />
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              List on eBay automatically
              {ebay?.env === "sandbox" && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--signal)", background: "var(--signal-bg)", borderRadius: 6, padding: "2px 7px" }}>SANDBOX</span>}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>
              {!ebay ? "Checking connection…"
                : !ebay.configured ? "Not set up on the server yet — add your eBay API keys to enable."
                : ebay.connected ? <>Connected{ebay.account ? ` as ${ebay.account}` : ""} — publish any listing straight to eBay.</>
                : "Connect your eBay seller account to publish listings with one click."}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {ebay?.connected && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--success)" }}><CircleCheck size={15} /> Connected</span>
            )}
            {ebay?.configured && (
              <a href="/api/ebay/connect" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: ebay.connected ? "1px solid var(--line)" : "none", background: ebay.connected ? "transparent" : "var(--accent)", color: ebay.connected ? "var(--foreground)" : "#fff", fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}>
                {ebay.connected ? <><RefreshCw size={14} /> Reconnect</> : <><Link2 size={15} /> Connect eBay</>}
              </a>
            )}
          </div>
        </div>
        {ebay && !ebay.configured && (
          <div style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, background: "var(--surface2)", borderRadius: 10, padding: "11px 14px" }}>
            <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Add <code>EBAY_CLIENT_ID</code>, <code>EBAY_CLIENT_SECRET</code> and <code>EBAY_REDIRECT_URI</code> in your environment, then redeploy. See the setup guide.</span>
          </div>
        )}
      </Card>

      {/* Other channels — prepare & open */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Other marketplaces</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>These don't allow third-party auto-posting — we prep your text + photos and open the form so you just paste.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {PREPARE_CHANNELS.map((c) => (
            <Card key={c.name} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0 }}><c.icon size={18} color={c.color} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>{c.note}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Whole cars for sale */}
      {sellableCars.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Whole cars for sale <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {sellableCars.length}</span></div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>List the complete vehicle as one ad. eBay Motors uses a separate vehicle flow — use <strong>Post elsewhere</strong> to copy a ready-to-paste car ad.</div>
          <Card pad={0}>
            {sellableCars.map((v: any, i: number) => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 16px", borderBottom: i < sellableCars.length - 1 ? "1px solid var(--line)" : "none", flexWrap: "wrap" }}>
                <PhotoCell icon="Car" url={v.image} style={{ width: 44, height: 38, flexShrink: 0 }} iconSize={18} />
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{vehLabel(v)}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {[v.body, v.mileage].filter(Boolean).join(" · ")}
                    {v.askingPrice ? ` · $${Number(v.askingPrice).toLocaleString()}` : ""}
                  </div>
                </div>
                <SellModeBadge mode={v.sellMode} size="sm" />
                {v.ebayUrl ? (
                  <a href={v.ebayUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--success)", textDecoration: "none" }}><CircleCheck size={14} /> On eBay</a>
                ) : ebay?.connected ? (
                  <button onClick={() => ebayPublish(`car:${v.id}`, { mode: "vehicle", vehicleId: v.id }, "Car listed on eBay Motors 🎉")} disabled={!!busy} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: "none", background: "var(--signal)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", opacity: busy && busy !== `car:${v.id}` ? 0.5 : 1 }}>
                    {busy === `car:${v.id}` ? <LoaderCircle size={14} className="spin" /> : <Car size={14} />} List on eBay
                  </button>
                ) : null}
                <PrepareMenu channels={PREPARE_CHANNELS} onPick={(ch) => prepareCar(ch, v)} />
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Parts — grouped by vehicle */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>Parts by vehicle <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {ready.length}</span></div>
          {groups.length > 0 && (
            <button onClick={() => setOpenGroups(openGroups.size ? new Set() : new Set(groups.map((g) => g.key)))} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {openGroups.size ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
        {ready.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 14, border: "1px dashed var(--line)", borderRadius: 14 }}>
            No listings yet. <button onClick={() => go("add")} style={{ color: "var(--accent)", background: "none", border: "none", fontWeight: 600, cursor: "pointer" }}>Add a vehicle</button> to create some.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {groups.map((g) => {
              const gv = g.key === "__other" ? null : vById.get(g.key);
              const open = openGroups.has(g.key);
              return (
              <div key={g.key}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "0 2px 8px", flexWrap: "wrap" }}>
                  <button onClick={() => toggleGroup(g.key)} style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0, background: "transparent", border: "none", cursor: "pointer", color: "var(--foreground)", padding: 0, textAlign: "left" }}>
                    <ChevronDown size={14} color="var(--muted)" style={{ flexShrink: 0, transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                    <Car size={14} color="var(--muted)" />
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{g.name}</span>
                    <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>· {g.items.length} part{g.items.length === 1 ? "" : "s"}</span>
                  </button>
                  {gv && g.items.length > 1 && (
                    gv.ebayLotUrl ? (
                      <a href={gv.ebayLotUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--success)", textDecoration: "none" }}><CircleCheck size={13} /> Lot on eBay</a>
                    ) : ebay?.connected ? (
                      <button onClick={() => ebayPublish(`lot:${gv.id}`, { mode: "lot", vehicleId: gv.id }, "Parts lot listed on eBay 🎉")} disabled={!!busy} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, border: "1px solid var(--accent)", background: "var(--accent-tint)", color: "var(--accent)", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: busy && busy !== `lot:${gv.id}` ? 0.5 : 1 }}>
                        {busy === `lot:${gv.id}` ? <LoaderCircle size={13} className="spin" /> : <ShoppingBag size={13} />} List all as one lot
                      </button>
                    ) : null
                  )}
                </div>
                {open && (
                <Card pad={0}>
                  {g.items.map((l: any, i: number) => (
                    <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 16px", borderBottom: i < g.items.length - 1 ? "1px solid var(--line)" : "none", flexWrap: "wrap" }}>
                      <PhotoCell icon="Wrench" url={l.image} style={{ width: 44, height: 38, flexShrink: 0 }} iconSize={16} />
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.part}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{l.fitment || g.name} · ${l.price}</div>
                      </div>
                      <ConditionBadge grade={l.grade} size="sm" />
                      {l.ebayUrl ? (
                        <a href={l.ebayUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--success)", textDecoration: "none" }}><CircleCheck size={14} /> On eBay</a>
                      ) : ebay?.connected ? (
                        <button onClick={() => ebayPublish(`part:${l.id}`, { listingId: l.id }, "Listed on eBay 🎉")} disabled={!!busy} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", opacity: busy && busy !== `part:${l.id}` ? 0.5 : 1 }}>
                          {busy === `part:${l.id}` ? <LoaderCircle size={14} className="spin" /> : <ShoppingBag size={14} />} List on eBay
                        </button>
                      ) : null}
                      <PrepareMenu channels={PREPARE_CHANNELS} onPick={(ch) => prepareAndOpen(ch, l)} />
                    </div>
                  ))}
                </Card>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Advanced: bulk file exports */}
      <div ref={advRef}>
        <button onClick={() => { setAdvanced((a) => !a); if (!advanced) setTimeout(() => advRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
          <ChevronDown size={15} style={{ transform: advanced ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} /> Advanced — bulk file export
        </button>
        {advanced && (
          <>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={exportFacebookCSV} disabled={!ready.length} style={advBtn}><Share2 size={16} color="#1877f2" /> Facebook catalog (CSV)</button>
              <button onClick={exportCSV} disabled={!ready.length} style={advBtn}><FileDown size={16} /> Export CSV</button>
              <button onClick={exportJSON} disabled={!ready.length} style={advBtn}><Download size={16} /> Export JSON</button>
              <button onClick={() => { try { navigator.clipboard?.writeText(ready.map((l: any) => buildListingText(l, shop)).join("\n\n———\n\n")); } catch {} csToast(`Copied ${ready.length} listings`); }} disabled={!ready.length} style={advBtn}><Copy size={16} /> Copy all text</button>
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--muted)", lineHeight: 1.5, marginTop: 10 }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span><strong>Facebook catalog</strong> is the free, official way to bulk-list on Facebook: in Commerce Manager, create a catalog → Data sources → Add items → <strong>Data feed</strong>, then upload this CSV. Only items with a public photo are included.</span>
            </div>
          </>
        )}
      </div>

      {prepare && (
        <PreparePanel data={prepare} shop={shop} onClose={() => setPrepare(null)} onSavePhotos={savePhotos} />
      )}
      {fix && (
        <FixPanel raw={fix.raw} target={fix.target} connected={!!ebay?.connected} go={go} onRetry={() => { const r = fix.retry; setFix(null); r(); }} onClose={() => setFix(null)} />
      )}
    </div>
  );
}

const advBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" };

// Small dropdown to prepare a listing for a non-API channel.
function PrepareMenu({ channels, onPick }: { channels: typeof PREPARE_CHANNELS; onPick: (c: typeof PREPARE_CHANNELS[number]) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc); return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
        <Send size={13} /> Post elsewhere <ChevronDown size={13} />
      </button>
      {open && (
        <div className="fade-up" style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 30, minWidth: 200, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 18px 40px -16px rgba(0,0,0,0.35)", overflow: "hidden" }}>
          {channels.map((c) => (
            <button key={c.name} className="cs-row" onClick={() => { setOpen(false); onPick(c); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", padding: "10px 12px", border: "none", background: "transparent", color: "var(--foreground)", fontSize: 13, cursor: "pointer" }}>
              <c.icon size={15} color={c.color} /> {c.name} <ExternalLink size={12} color="var(--muted)" style={{ marginLeft: "auto" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type PrepareState = { channel: typeof PREPARE_CHANNELS[number]; kind: "part" | "car"; entity: any; photos: string[]; prefix: string };

// Labelled input row for the editable post card. Flags empty values so the
// seller can see what's missing before posting.
function CardField({ label, value, onChange, placeholder, missing, area, suffix }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; missing?: boolean; area?: boolean; suffix?: string }) {
  const base: React.CSSProperties = { width: "100%", border: `1px solid ${missing ? "var(--signal)" : "var(--line)"}`, borderRadius: 9, background: "var(--surface2)", color: "var(--foreground)", fontSize: 13, padding: "9px 11px", fontFamily: "inherit", outline: "none" };
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", display: "flex", gap: 6, alignItems: "center" }}>
        {label}{missing && <span style={{ color: "var(--signal)", fontWeight: 700 }}>· add this</span>}
      </span>
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ ...base, resize: "vertical", lineHeight: 1.5 }} />
      ) : (
        <span style={{ position: "relative", display: "flex", alignItems: "center" }}>
          {suffix && <span style={{ position: "absolute", left: 11, color: "var(--muted)", fontSize: 13 }}>{suffix}</span>}
          <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...base, paddingLeft: suffix ? 24 : 11 }} />
        </span>
      )}
    </label>
  );
}

// Shared centered modal shell.
function Sheet({ title, accent, onClose, children, footer }: { title: React.ReactNode; accent?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <Portal><div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} className="fade-up" style={{ width: "min(540px, 100%)", maxHeight: "88vh", display: "flex", flexDirection: "column", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 40px 80px -30px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, flex: 1, color: accent || "var(--foreground)" }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer" }}><X size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>{children}</div>
        {footer && (
          <div style={{ flexShrink: 0, borderTop: "1px solid var(--line)", padding: "12px 18px", background: "var(--surface)" }}>{footer}</div>
        )}
      </div>
    </div></Portal>
  );
}

function StepNum({ n }: { n: number }) {
  return <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 999, background: "var(--accent-tint)", color: "var(--accent)", fontSize: 12, fontWeight: 700, display: "grid", placeItems: "center" }}>{n}</span>;
}

// "Post elsewhere" prep sheet — compact no-scroll layout. Shows the post
// text + key info immediately, copies and opens the marketplace in one tap.
function PreparePanel({ data, shop, onClose, onSavePhotos }: { data: PrepareState; shop: any; onClose: () => void; onSavePhotos: (urls: string[], prefix: string) => Promise<number> }) {
  const { channel, kind, entity, photos, prefix } = data;
  const isCar = kind === "car";
  // Photos uploaded from this sheet (data URLs), shown alongside the saved ones.
  const [extraPhotos, setExtraPhotos] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const upRef = React.useRef<HTMLInputElement>(null);
  const valid = [...photos.filter((u) => u && /^https?:\/\//.test(u)), ...extraPhotos];

  // Upload picture(s) to this part listing right from the export sheet.
  async function uploadPhotos(files: FileList) {
    const arr = Array.from(files).slice(0, 8);
    if (!arr.length || isCar) return;
    setUploading(true);
    try {
      const b64s = await Promise.all(arr.map((f) => new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f);
      })));
      const r = await fetch("/api/listings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: entity.id, photosBase64: b64s }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't upload photo"); setUploading(false); return; }
      setExtraPhotos((p) => [...p, ...b64s]);
      csToast("Photo added");
      (window as any).csReloadData?.();
    } catch { csToast("Couldn't upload photo"); }
    setUploading(false);
  }

  // Editable copy of the post fields, seeded from the listing/vehicle.
  const [f, setF] = React.useState<Record<string, string>>(() => isCar ? {
    title: entity.title || `${entity.year || ""} ${entity.make || ""} ${entity.model || ""}${entity.trim ? ` ${entity.trim}` : ""}`.trim(),
    price: entity.askingPrice ? String(entity.askingPrice) : "",
    mileage: entity.mileage || "",
    description: entity.description || "",
  } : {
    part: entity.part || "",
    fitment: entity.fitment || "",
    grade: (["A", "B", "C"].includes(entity.grade) ? entity.grade : "B"),
    price: entity.price ? String(entity.price) : "",
    note: entity.note || "",
    description: entity.desc || entity.description || "",
  });
  const [editOpen, setEditOpen] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const set = (k: string) => (v: string) => { setF((p) => ({ ...p, [k]: v })); setDirty(true); };
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Detect the Ahlam Auto-Poster browser extension (it sets this attribute on
  // ahlam.io). When present we hand it the listing and it fills the form for you.
  const [ext, setExt] = React.useState(false);
  React.useEffect(() => {
    const has = () => document.documentElement.getAttribute("data-ahlam-autopost") === "1";
    if (has()) { setExt(true); return; }
    let n = 0;
    const id = setInterval(() => { if (has()) { setExt(true); clearInterval(id); } else if (++n > 12) clearInterval(id); }, 300);
    return () => clearInterval(id);
  }, []);

  // Live post text rebuilt from the edited fields (what gets pasted).
  const text = isCar
    ? buildVehicleText({ ...entity, description: f.description, askingPrice: Number(f.price) || 0, mileage: f.mileage, title: f.title } as any, shop)
    : buildListingText({ ...entity, part: f.part, fitment: f.fitment, grade: f.grade, note: f.note, desc: f.description, price: Number(f.price) || 0 } as any, shop);

  async function saveFields() {
    setSaving(true);
    const body = isCar
      ? { vehicleId: entity.id, title: f.title, description: f.description, mileage: f.mileage, askingPrice: f.price === "" ? "" : Number(f.price) }
      : { listingId: entity.id, partName: f.part, fitment: f.fitment, condition: f.grade, priceUsd: f.price, description: f.description, conditionNotes: f.note };
    try {
      const r = await fetch("/api/listings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) { setDirty(false); csToast("Saved to your listing"); (window as any).csReloadData?.(); }
      else { const d = await r.json().catch(() => ({})); csToast(d.error || "Couldn't save changes"); }
    } catch { csToast("Couldn't save changes"); }
    setSaving(false);
  }

  // Fetch the listing photos as File objects for the native share sheet.
  async function photosToFiles(urls: string[]): Promise<File[]> {
    const out: File[] = [];
    for (const u of urls.slice(0, 10)) {
      try {
        const res = await fetch(u);
        const blob = await res.blob();
        const e = (blob.type.split("/")[1] || "jpg").split("+")[0];
        out.push(new File([blob], `${prefix}-${out.length + 1}.${e}`, { type: blob.type || "image/jpeg" }));
      } catch { /* skip a photo that won't fetch */ }
    }
    return out;
  }

  async function confirmAndOpen() {
    const titleText = isCar ? (f.title || `${entity.year || ""} ${entity.make || ""} ${entity.model || ""}`.trim()) : f.part;

    // 1) Desktop with the Auto-Poster extension → it fills the marketplace form.
    if (ext) {
      try { await navigator.clipboard?.writeText(text); } catch {}
      window.postMessage({
        __ahlamAutopost: true, kind: "post", channel: (channel as any).key || "facebook",
        listing: { title: titleText, price: f.price || "", description: text, text, photos: valid, location: shop?.location || "" },
      }, "*");
      setCopied(true);
      csToast(`Sending to ${channel.name} — the extension will fill the form`);
      return;
    }

    // 2) Phone → native share sheet so the photos + text go into the real APP.
    if (isMobileDevice() && typeof navigator !== "undefined" && (navigator as any).share) {
      try { await navigator.clipboard?.writeText(text); } catch {}
      try {
        const files = await photosToFiles(valid);
        const payload: any = { title: titleText, text };
        if (files.length && (navigator as any).canShare?.({ files })) payload.files = files;
        await (navigator as any).share(payload);
        setCopied(true);
        csToast(`Shared — pick ${channel.name}; paste the text if it isn't there`);
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return; // user closed the share sheet
        // otherwise fall through to copy/open
      }
    }

    // 3) Desktop without the extension → copy text + save photos + open the form.
    try { await navigator.clipboard?.writeText(text); } catch {}
    setCopied(true);
    window.open(channel.url, "_blank", "noopener");
    csToast(`Text copied${valid.length ? " · saving photos…" : ""} — paste into ${channel.name}`);
    if (valid.length) {
      const n = await onSavePhotos(valid, prefix);
      if (n) csToast(`${n} photo${n === 1 ? "" : "s"} saved — drag them into ${channel.name}`);
    }
  }

  return (
    <Portal><div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} className="fade-up" style={{ width: "min(480px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 40px 80px -30px rgba(0,0,0,0.6)", display: "grid", gap: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <channel.icon size={18} color={channel.color} />
          <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{channel.name}</span>
          <button onClick={onClose} aria-label="Close" style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer" }}><X size={15} /></button>
        </div>

        {/* Full post preview — photo, title, price, condition, fitment, description */}
        <div style={{ padding: "12px 16px 0" }}>
          {valid.length > 0 ? (
            <div style={{ display: "grid", gap: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={valid[0]} alt="" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 12, border: "1px solid var(--line)", display: "block" }} />
              {valid.length > 1 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {valid.slice(1, 6).map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={u} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ aspectRatio: "4 / 3", borderRadius: 12, border: "1px dashed var(--line)", display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 12.5, background: "var(--surface2)" }}>No photo on this listing</div>
          )}
          {!isCar && (
            <>
              <input ref={upRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files) uploadPhotos(e.target.files); e.target.value = ""; }} />
              <button onClick={() => upRef.current?.click()} disabled={uploading} style={{ marginTop: 8, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 0", borderRadius: 10, border: "1px dashed var(--line)", background: "transparent", color: "var(--muted)", fontSize: 13, fontWeight: 600, cursor: uploading ? "default" : "pointer" }}>
                {uploading ? <LoaderCircle size={15} className="spin" /> : <ImageDown size={15} />} {uploading ? "Uploading…" : valid.length ? "Add another photo" : "Upload a photo"}
              </button>
            </>
          )}
        </div>

        <div style={{ padding: "12px 16px 4px", display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontSize: 17, fontWeight: 700, flex: 1, lineHeight: 1.25 }}>{isCar ? (f.title || `${entity.year || ""} ${entity.make || ""} ${entity.model || ""}`.trim()) : (f.part || "Part")}</div>
            <div className="tnum" style={{ fontSize: 17, fontWeight: 800, color: f.price ? "var(--success)" : "var(--muted)" }}>{f.price ? `$${Number(f.price).toLocaleString()}` : "No price"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12.5, color: "var(--muted)" }}>
            {!isCar && <span style={{ fontWeight: 700, padding: "2px 9px", borderRadius: 6, color: f.grade === "A" ? "var(--success)" : f.grade === "B" ? "var(--signal)" : "var(--muted)", background: `color-mix(in srgb, ${f.grade === "A" ? "var(--success)" : f.grade === "B" ? "var(--signal)" : "var(--muted)"} 16%, transparent)` }}>Grade {f.grade}</span>}
            {isCar ? (f.mileage ? <span>{f.mileage}</span> : null) : (f.fitment ? <span>{f.fitment}</span> : null)}
          </div>
          <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.5, maxHeight: 96, overflowY: "auto", whiteSpace: "pre-wrap" }}>
            {((f.description || (isCar ? "" : f.note) || "").trim()) || "No description yet — add one under Edit fields."}
          </div>
        </div>

        {/* Exact text that gets pasted (collapsible — the card above is the readable view) */}
        <details style={{ padding: "2px 16px 0" }}>
          <summary style={{ fontSize: 12, color: "var(--muted)", cursor: "pointer", padding: "4px 0", listStyle: "none" }}>▸ Preview the exact text you'll paste</summary>
          <textarea readOnly value={text} style={{ width: "100%", height: 120, marginTop: 6, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 12.5, lineHeight: 1.5, padding: "9px 11px", fontFamily: "inherit", resize: "vertical" }} />
        </details>

        {/* Confirm & copy button */}
        <div style={{ padding: "12px 16px" }}>
          <button onClick={confirmAndOpen} style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 0", borderRadius: 11, border: "none", background: copied ? "var(--success)" : channel.color, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}>
            {copied
              ? <><Check size={18} /> {ext ? "Sent — check the new tab" : isMobileDevice() ? "Shared" : "Copied & opened"}</>
              : <><ExternalLink size={18} /> {ext ? `Auto-fill on ${channel.name}` : isMobileDevice() ? `Share to ${channel.name}` : `Copy & post to ${channel.name}`}</>}
          </button>
        </div>

        {/* Edit fields toggle */}
        <details open={editOpen} style={{ borderTop: "1px solid var(--line)" }}>
          <summary onClick={(e) => { e.preventDefault(); setEditOpen(!editOpen); }} style={{ cursor: "pointer", padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "var(--muted)", listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}>
            <ChevronDown size={14} style={{ transform: editOpen ? "none" : "rotate(-90deg)", transition: "transform 0.15s" }} /> Edit fields {dirty && <span style={{ fontSize: 11, color: "var(--signal)", fontWeight: 700 }}>(unsaved)</span>}
          </summary>
          {editOpen && (
          <div style={{ padding: "0 16px 12px", display: "grid", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            {isCar ? (
              <>
                <CardField label="Title" value={f.title} onChange={set("title")} placeholder="2015 Honda Accord EX" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <CardField label="Price" value={f.price} onChange={set("price")} placeholder="0" suffix="$" missing={!f.price || Number(f.price) <= 0} />
                  <CardField label="Mileage" value={f.mileage} onChange={set("mileage")} placeholder="120,000 mi" />
                </div>
                <CardField label="Description" value={f.description} onChange={set("description")} placeholder="Condition, what's included…" area />
              </>
            ) : (
              <>
                <CardField label="Part" value={f.part} onChange={set("part")} placeholder="Alternator" missing={!f.part?.trim()} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <CardField label="Fits" value={f.fitment} onChange={set("fitment")} placeholder="2015 Honda Accord" missing={!f.fitment?.trim()} />
                  <CardField label="Price" value={f.price} onChange={set("price")} placeholder="0" suffix="$" missing={!f.price || Number(f.price) <= 0} />
                </div>
                <div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>Condition</span>
                  <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                    {["A", "B", "C"].map((g) => (
                      <button key={g} onClick={() => set("grade")(g)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${f.grade === g ? "var(--accent)" : "var(--line)"}`, background: f.grade === g ? "var(--accent-tint)" : "transparent", color: f.grade === g ? "var(--accent)" : "var(--muted)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{g}</button>
                    ))}
                  </div>
                </div>
                <CardField label="Note" value={f.note} onChange={set("note")} placeholder="e.g. light scratches on the chrome" />
                <CardField label="Description" value={f.description} onChange={set("description")} placeholder="Condition notes, what's included, pickup details…" area />
              </>
            )}
            {dirty && (
              <button onClick={saveFields} disabled={saving} style={{ justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {saving ? <><LoaderCircle size={13} className="spin" /> Saving…</> : <><Check size={13} /> Save to listing</>}
              </button>
            )}
          </div>
          )}
        </details>
      </div>
    </div></Portal>
  );
}

// Classify an eBay publish error into a plain-language title + fix steps.
function classifyEbayError(raw: string) {
  const e = (raw || "").toLowerCase();
  if (/connect your ebay|not connected|account not connected|notconnected/.test(e))
    return { kind: "connect", title: "Connect your eBay account", blurb: "You need to link your eBay seller account before publishing.", steps: ["Click Connect eBay below and sign in to eBay.", "Approve the requested permissions.", "Come back and hit List again."], showRaw: false };
  if (/set a price|set an asking price|set prices on the parts|price before|set prices/.test(e))
    return { kind: "price", title: "Add a price first", blurb: "eBay won't accept a listing without a price.", steps: ["Open the part or vehicle.", "Enter a price (or accept the AI-suggested one).", "Return here and List again."], showRaw: false };
  if (/polic|location|merchantlocation|fulfillment|payment profile|return profile|shipping profile|business polic/.test(e))
    return { kind: "policies", title: "Finish your eBay business setup", blurb: "eBay requires payment, shipping and return policies plus an inventory location before it will publish for you.", steps: ["In eBay: Account → Business policies — create a Payment, a Shipping and a Return policy.", "Add an inventory location (Account → Shipping / Locations).", "Click Reconnect below so we pick them up, then List again."], showRaw: true };
  if (/no parts to bundle|no listings to|nothing to bundle/.test(e))
    return { kind: "empty", title: "Nothing to list yet", blurb: "There aren't any priced, unsold items here to publish.", steps: ["Add parts to this vehicle (or set their prices).", "Then try again."], showRaw: false };
  if (/at least one photo|requires at least one photo|add a photo/.test(e))
    return { kind: "photo", title: "Add a photo first", blurb: "eBay requires at least one photo on every listing.", steps: ["Open the part and add at least one photo.", "Then list it on eBay again."], showRaw: false };
  if (/seller'?s account|create a seller|register.*seller|additional information to create|not registered/.test(e))
    return { kind: "sellerreg", title: "Finish your eBay seller registration", blurb: "Your eBay account isn't set up to sell yet — eBay needs a bit more info (payment + identity) before it will publish listings.", steps: ["Go to eBay → Sell, and complete the seller-account setup (link a payout method + verify your identity).", "It's a one-time step on eBay's side.", "Come back and List on eBay again."], showRaw: true };
  if (/motors/.test(e))
    return { kind: "motors", title: "eBay Motors couldn't accept this car", blurb: "Whole-vehicle listings run through eBay Motors, which has extra requirements and fees.", steps: ["Make sure year, make, model and a VIN are all set on the car.", "Confirm your eBay account is approved to sell vehicles.", "Try again, or use Post elsewhere to list it manually."], showRaw: true };
  return { kind: "generic", title: "eBay couldn't publish this", blurb: "eBay returned an error. The exact message is below — it usually points to what to fix.", steps: [], showRaw: true };
}

// Fix-it sheet for a failed eBay publish.
function FixPanel({ raw, target, connected, go, onRetry, onClose }: { raw: string; target: string; connected: boolean; go: (id: string) => void; onRetry: () => void; onClose: () => void }) {
  const info = classifyEbayError(raw);
  return (
    <Sheet title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><AlertTriangle size={18} color="var(--danger)" /> {info.title}</span>} accent="var(--foreground)" onClose={onClose}>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: info.steps.length ? 14 : 10 }}>{info.blurb}</div>

      {info.steps.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          {info.steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <StepNum n={i + 1} />
              <div style={{ fontSize: 13, lineHeight: 1.45, paddingTop: 2 }}>{s}</div>
            </div>
          ))}
        </div>
      )}

      {info.showRaw && (
        <div style={{ display: "flex", gap: 8, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, background: "var(--surface2)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontFamily: "ui-monospace, monospace", wordBreak: "break-word" }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{raw}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(info.kind === "connect" || info.kind === "policies") && (
          <a href="/api/ebay/connect" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}>
            {connected ? <><RefreshCw size={15} /> Reconnect eBay</> : <><Link2 size={15} /> Connect eBay</>}
          </a>
        )}
        {(info.kind === "price" || info.kind === "empty") && (
          <button onClick={() => { onClose(); go(target); }} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            <ExternalLink size={15} /> Open {target === "vehicles" ? "vehicles" : "parts"}
          </button>
        )}
        <button onClick={onRetry} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    </Sheet>
  );
}
