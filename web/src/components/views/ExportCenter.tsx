"use client";

import React from "react";
import { Send, Copy, ExternalLink, Info, CircleCheck, Share2, Tag, ShoppingBag, Globe } from "lucide-react";
import { Card, PhotoCell, ConditionBadge, StatusBadge } from "../UI";
import { buildListingText } from "../data";
import { useData, csToast } from "../Dashboard";

const CHANNELS = [
  { name: "Facebook Marketplace", icon: Share2, note: "Copy & paste — no auto-post API", color: "#1877f2" },
  { name: "OfferUp", icon: Tag, note: "Copy & paste + attach saved photos", color: "var(--accent)" },
  { name: "eBay Motors", icon: ShoppingBag, note: "CSV bulk upload supported", color: "var(--signal)" },
  { name: "Craigslist", icon: Globe, note: "Copy formatted listing text", color: "var(--success)" },
];

export function ExportCenter({ go }: { go: (id: string) => void; onVehicle?: (v: any) => void }) {
  const { listings, shop } = useData();
  const ready = listings.filter((l: any) => l.status === "Draft" || l.status === "Posted");
  const posted = listings.filter((l: any) => l.status === "Posted").length;

  function copyAll() {
    const text = ready.map((l: any) => buildListingText(l, shop)).join("\n\n———\n\n");
    try { navigator.clipboard?.writeText(text); } catch {}
    csToast(`Copied ${ready.length} listings to clipboard`);
  }

  return (
    <div style={{ maxWidth: 1040, display: "grid", gap: 22 }}>
      <Card style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(220,38,38,0.14)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Send size={20} color="var(--accent)" />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Post everywhere you sell</div>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55 }}>
            Every listing is already sold inside Ahlam. Cross-posting to Facebook, OfferUp, eBay and Craigslist is a bonus —
            we format clean, copy-ready text and keep your photos attached so your posts look sharp wherever you paste them.
          </p>
        </div>
        <button onClick={copyAll} disabled={!ready.length} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, opacity: ready.length ? 1 : 0.5 }}>
          <Copy size={16} /> Copy all ({ready.length})
        </button>
      </Card>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Channels</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {CHANNELS.map((c) => (
            <Card key={c.name} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <c.icon size={18} color={c.color} />
              </span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }}>{c.note}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, background: "var(--surface2)", borderRadius: 10, padding: "11px 14px" }}>
        <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Facebook & OfferUp don't allow automated posting. Ahlam prepares the text and photos — you paste and hit post. eBay supports CSV bulk upload.</span>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Ready to post <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {ready.length}</span></div>
          <div style={{ fontSize: 12.5, color: "var(--success)", display: "flex", alignItems: "center", gap: 6 }}><CircleCheck size={14} /> {posted} live</div>
        </div>
        {ready.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 14, border: "1px dashed var(--line)", borderRadius: 14 }}>
            No listings ready yet. <button onClick={() => go("add")} style={{ color: "var(--accent)", background: "none", border: "none", fontWeight: 600, cursor: "pointer" }}>Add a vehicle</button> to draft some.
          </div>
        ) : (
          <Card pad={0}>
            {ready.map((l: any, i: number) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: i < ready.length - 1 ? "1px solid var(--line)" : "none" }}>
                <PhotoCell icon="Wrench" style={{ width: 44, height: 38, flexShrink: 0 }} iconSize={16} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.part}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{l.vehicle || l.fitment} · ${l.price}</div>
                </div>
                <ConditionBadge grade={l.grade} size="sm" />
                <StatusBadge status={l.status} />
                <button onClick={() => (window as any).csOpenExport?.(l)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                  <ExternalLink size={14} /> Open
                </button>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
