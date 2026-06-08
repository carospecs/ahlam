"use client";

import React from "react";
import { Send, Copy, Download, FileDown, ExternalLink, Info, CircleCheck, Share2, Tag, ShoppingBag, Globe, LoaderCircle, Link2, RefreshCw, ChevronDown, Car } from "lucide-react";
import { Card, PhotoCell, ConditionBadge, SellModeBadge } from "../UI";
import { buildListingText, buildVehicleText } from "../data";
import { useData, csToast } from "../Dashboard";

// Platforms with no listing API — we prepare the text + photos and open the
// posting page so the seller just pastes and hits post.
const PREPARE_CHANNELS = [
  { name: "Facebook Marketplace", icon: Share2, color: "#1877f2", url: "https://www.facebook.com/marketplace/create/item", note: "Facebook has no posting API — we copy your text and open the form." },
  { name: "OfferUp", icon: Tag, color: "var(--accent)", url: "https://offerup.com/post/", note: "Copy & paste + attach your saved photos." },
  { name: "Craigslist", icon: Globe, color: "var(--success)", url: "https://post.craigslist.org/", note: "Copy the formatted listing text and pick your city." },
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

  function prepareAndOpen(ch: typeof PREPARE_CHANNELS[number], l: any) {
    try { navigator.clipboard?.writeText(buildListingText(l, shop)); } catch {}
    csToast(`Copied — opening ${ch.name}`);
    window.open(ch.url, "_blank", "noopener");
  }

  function prepareCar(ch: typeof PREPARE_CHANNELS[number], v: any) {
    try { navigator.clipboard?.writeText(buildVehicleText(v, shop)); } catch {}
    csToast(`Copied car ad — opening ${ch.name}`);
    window.open(ch.url, "_blank", "noopener");
  }

  // One publisher for parts, wholesale lots, and whole cars — body decides which.
  async function ebayPublish(key: string, body: any, okMsg: string) {
    if (busy) return;
    setBusy(key);
    try {
      const r = await fetch("/api/ebay/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { csToast(okMsg); window.open(d.url, "_blank", "noopener"); (window as any).csReloadData?.(); }
      else if (d.notConnected) csToast("Connect your eBay account first");
      else csToast(d.error || "eBay listing failed");
    } catch { csToast("eBay listing failed — check your connection"); }
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
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Parts by vehicle <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {ready.length}</span></div>
        {ready.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 14, border: "1px dashed var(--line)", borderRadius: 14 }}>
            No listings yet. <button onClick={() => go("add")} style={{ color: "var(--accent)", background: "none", border: "none", fontWeight: 600, cursor: "pointer" }}>Add a vehicle</button> to create some.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {groups.map((g) => {
              const gv = g.key === "__other" ? null : vById.get(g.key);
              return (
              <div key={g.key}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "0 2px 8px", flexWrap: "wrap" }}>
                  <Car size={14} color="var(--muted)" />
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{g.name}</span>
                  <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>· {g.items.length} part{g.items.length === 1 ? "" : "s"}</span>
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
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Advanced: bulk file exports */}
      <div>
        <button onClick={() => setAdvanced((a) => !a)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
          <ChevronDown size={15} style={{ transform: advanced ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} /> Advanced — bulk file export
        </button>
        {advanced && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={exportCSV} disabled={!ready.length} style={advBtn}><FileDown size={16} /> Export CSV</button>
            <button onClick={exportJSON} disabled={!ready.length} style={advBtn}><Download size={16} /> Export JSON</button>
            <button onClick={() => { try { navigator.clipboard?.writeText(ready.map((l: any) => buildListingText(l, shop)).join("\n\n———\n\n")); } catch {} csToast(`Copied ${ready.length} listings`); }} disabled={!ready.length} style={advBtn}><Copy size={16} /> Copy all text</button>
          </div>
        )}
      </div>
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
