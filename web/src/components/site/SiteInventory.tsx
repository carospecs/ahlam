"use client";

import { useMemo, useState } from "react";
import { MessageSeller } from "@/components/MessageSeller";

// Searchable inventory for the Ultimate personal sites. Server-rendered with
// the full inventory in the payload (indexable), filtered client-side — the
// yard's whole stock is at most a few hundred rows.

const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden" };
const sectionH: React.CSSProperties = { fontSize: 21, fontWeight: 800, letterSpacing: "-0.015em", margin: "44px 0 16px", display: "flex", alignItems: "baseline", gap: 10 };

export function SiteInventory({
  parts,
  vehicles,
  shopId,
  shopName,
  signinHref,
}: {
  parts: any[];
  vehicles: any[];
  shopId: string;
  shopName: string;
  signinHref: string;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return parts;
    return parts.filter((p) =>
      [p.part, p.fitment, p.category, p.desc, p.note].join(" ").toLowerCase().includes(needle)
    );
  }, [parts, q]);

  return (
    <>
      <div id="inventory" style={{ scrollMarginTop: 80 }}>
        <h2 style={sectionH}>
          Parts in stock
          <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>updated live from our yard</span>
        </h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${parts.length} part${parts.length === 1 ? "" : "s"} — try a part name or vehicle…`}
          style={{ width: "100%", maxWidth: 560, padding: "13px 18px", borderRadius: 13, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--foreground)", fontSize: 15, fontFamily: "inherit", outline: "none", marginBottom: 16 }}
        />
        {parts.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--muted)", border: "1px dashed var(--line)", borderRadius: 16 }}>
            No parts listed right now — call us, new stock lands daily.
          </div>
        ) : shown.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", border: "1px dashed var(--line)", borderRadius: 16 }}>
            Nothing matches &ldquo;{q}&rdquo; — try a broader search, or message us and we&apos;ll check the yard.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {shown.map((p) => (
              <a key={p.id} href={`/p/${p.id}`} className="cs-listing-row" style={{ ...card, display: "flex", textDecoration: "none", color: "inherit" }}>
                <div className="cs-listing-photo" style={{ position: "relative", width: 200, flexShrink: 0 }}>
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt={p.part} style={{ width: "100%", height: "100%", minHeight: 148, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div className="photo-cell" style={{ width: "100%", height: "100%", minHeight: 148, borderRadius: 0 }} />
                  )}
                  <span style={{ position: "absolute", top: 10, left: 10, fontSize: 11, fontWeight: 800, color: "#fff", background: "rgba(7,11,22,0.72)", borderRadius: 6, padding: "3px 8px" }}>Grade {p.grade}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: "13px 16px", display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15.5, fontWeight: 700 }}>{p.part}</span>
                    {p.category && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 999, padding: "2px 9px" }}>{p.category}</span>}
                  </div>
                  {p.fitment && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Fits {p.fitment}</div>}
                  {(p.desc || p.note) && (
                    <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {[p.desc, p.note && p.note !== p.desc ? p.note : ""].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <div className="cs-listing-cta" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, padding: "13px 16px", borderLeft: "1px solid var(--line)", width: 170, flexShrink: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--success)" }}>${Number(p.price).toLocaleString()}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap", color: p.asIs ? "var(--muted)" : "var(--success)", background: p.asIs ? "color-mix(in srgb, var(--muted) 14%, transparent)" : "color-mix(in srgb, var(--success) 14%, transparent)" }}>{p.warrantyText}</span>
                  <span style={{ marginTop: "auto", fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>View details →</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {vehicles.length > 0 && (
        <div id="vehicles" style={{ scrollMarginTop: 80 }}>
          <h2 style={sectionH}>
            Vehicles
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>whole cars &amp; parting out</span>
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            {vehicles.map((v) => (
              <div key={v.id} className="cs-listing-row" style={{ ...card, display: "flex" }}>
                <div className="cs-listing-photo" style={{ width: 200, flexShrink: 0 }}>
                  {v.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.photoUrl} alt={`${v.year} ${v.make} ${v.model}`} style={{ width: "100%", height: "100%", minHeight: 148, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div className="photo-cell" style={{ width: "100%", height: "100%", minHeight: 148, borderRadius: 0 }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: "13px 16px", display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15.5, fontWeight: 700 }}>{v.year} {v.make} {v.model} {v.trim}</span>
                    {v.sellMode === "both" && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)", borderRadius: 999, padding: "2px 9px" }}>Also parting out</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{[v.mileage, v.body, v.color].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="cs-listing-cta" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, padding: "13px 16px", borderLeft: "1px solid var(--line)", width: 170, flexShrink: 0 }}>
                  {v.askingPrice ? <div style={{ fontSize: 20, fontWeight: 800 }}>${Number(v.askingPrice).toLocaleString()}</div> : <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--accent)" }}>Parting out</div>}
                  <div style={{ marginTop: "auto" }}>
                    <MessageSeller shopId={shopId} subject={`${v.year} ${v.make} ${v.model}`.trim()} sellerName={shopName} compact fullWidth signinHref={signinHref} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
