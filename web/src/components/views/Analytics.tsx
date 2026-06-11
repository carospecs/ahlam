"use client";

import { Eye, MessageSquare, Tag, DollarSign, TrendingUp, BarChart3, Wallet } from "lucide-react";
import { Card } from "../UI";
import { useData } from "../Dashboard";

export function Analytics({ go }: { go: (id: string) => void; onVehicle?: (v: any) => void }) {
  const { listings, threads, vehicles } = useData();

  const totalViews = listings.reduce((s: number, l: any) => s + (l.views || 0), 0);
  const posted = listings.filter((l: any) => l.status === "Posted" || l.status === "active");
  const sold = listings.filter((l: any) => l.status === "Sold");
  const revenue = sold.reduce((s: number, l: any) => s + (l.price || 0), 0);
  const inquiries = threads.length;
  const conversionRate = totalViews > 0 ? ((inquiries / totalViews) * 100).toFixed(1) : "0";
  const revenueEstimate = posted.reduce((s: number, l: any) => s + (l.price || 0), 0);

  // Profit: only for cars the owner recorded a purchase cost on. Profit per car =
  // value of its parts sold − what they paid for the car.
  const costed = [...(vehicles || [])]
    .filter((v: any) => v.acquisitionCost != null && v.acquisitionCost > 0)
    .sort((a: any, b: any) => ((b.soldValue || 0) - b.acquisitionCost) - ((a.soldValue || 0) - a.acquisitionCost));
  const invested = costed.reduce((s: number, v: any) => s + v.acquisitionCost, 0);
  const recovered = costed.reduce((s: number, v: any) => s + (v.soldValue || 0), 0);
  const netProfit = recovered - invested;
  const stillListed = costed.reduce((s: number, v: any) => s + Math.max(0, (v.value || 0) - (v.soldValue || 0)), 0);

  // Conversion funnel — derived entirely from real listing state.
  const funnel = [
    { label: "Parts identified", value: listings.length, tone: "var(--muted)" },
    { label: "Posted to market", value: posted.length, tone: "var(--accent)" },
    { label: "Viewed by buyers", value: listings.filter((l: any) => (l.views || 0) > 0).length, tone: "var(--signal)" },
    { label: "Sold", value: sold.length, tone: "var(--success)" },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  // Views by category.
  const catMap = new Map<string, number>();
  for (const l of listings) {
    const k = l.category || "Uncategorized";
    catMap.set(k, (catMap.get(k) || 0) + (l.views || 0));
  }
  const byCategory = [...catMap.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const catMaxV = Math.max(1, ...byCategory.map(([, v]) => v));

  const topListings = [...listings].sort((a: any, b: any) => (b.views || 0) - (a.views || 0)).slice(0, 6);

  const stats = [
    { icon: Eye, label: "Total listing views", value: totalViews.toLocaleString(), tone: "var(--accent)" },
    { icon: MessageSquare, label: "Buyer inquiries", value: String(inquiries), tone: "var(--signal)" },
    { icon: Tag, label: "Active listings", value: String(posted.length), tone: "var(--success)" },
    { icon: DollarSign, label: "Revenue (sold)", value: `$${revenue.toLocaleString()}`, tone: "var(--success)" },
    { icon: TrendingUp, label: "Conversion rate", value: `${conversionRate}%`, tone: "var(--signal)" },
    { icon: DollarSign, label: "Revenue estimate", value: `$${revenueEstimate.toLocaleString()}`, tone: "var(--accent)" },
  ];

  if (listings.length === 0) {
    return (
      <div style={{ maxWidth: 1180 }}>
        <div style={{ padding: 56, textAlign: "center", border: "1px dashed var(--line)", borderRadius: 16 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--accent-tint)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><BarChart3 size={22} color="var(--accent)" /></div>
          <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>No analytics yet — post a few listings and insights on views, inquiries, and sales will appear here.</div>
          <button onClick={() => go("add")} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600 }}>Add your first vehicle</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 1180 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 16 }}>
        {stats.map((s) => (
          <Card key={s.label} pad={18} style={{ display: "grid", gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `color-mix(in srgb, ${s.tone} 15%, transparent)`, display: "grid", placeItems: "center" }}><s.icon size={19} color={s.tone} /></div>
            <div>
              <div className="tnum" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Profit by vehicle — needs a purchase cost entered on the car */}
      <Card pad={0}>
        <div style={cardHead}><Wallet size={15} color="var(--success)" /> <span style={{ fontWeight: 700, fontSize: 14 }}>Profit — what your cars are returning</span></div>
        {costed.length === 0 ? (
          <div style={{ padding: "18px", fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
            Enter <strong style={{ color: "var(--foreground)" }}>what you paid for a car</strong> on its vehicle page, and Ahlam tracks parts-sold vs. that cost here — your true profit per car.
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14, padding: "16px 18px" }}>
              <Metric label="Invested in cars" value={`$${invested.toLocaleString()}`} tone="var(--muted)" />
              <Metric label="Recovered (parts sold)" value={`$${recovered.toLocaleString()}`} tone="var(--accent)" />
              <Metric label="Net profit" value={`${netProfit < 0 ? "−" : ""}$${Math.abs(netProfit).toLocaleString()}`} tone={netProfit >= 0 ? "var(--success)" : "var(--danger)"} />
              <Metric label="Still to sell (listed)" value={`$${stillListed.toLocaleString()}`} tone="var(--signal)" />
            </div>
            <div style={{ borderTop: "1px solid var(--line)" }}>
              {costed.map((v: any, i: number) => {
                const profit = (v.soldValue || 0) - v.acquisitionCost;
                const roi = v.acquisitionCost > 0 ? Math.round((profit / v.acquisitionCost) * 100) : 0;
                return (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: i < costed.length - 1 ? "1px solid var(--line)" : "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{[v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>Paid ${v.acquisitionCost.toLocaleString()} · {v.sold || 0} part{(v.sold || 0) === 1 ? "" : "s"} sold for ${(v.soldValue || 0).toLocaleString()}</div>
                    </div>
                    <span className="tnum" style={{ fontSize: 14, fontWeight: 700, color: profit >= 0 ? "var(--success)" : "var(--danger)" }}>{profit < 0 ? "−" : "+"}${Math.abs(profit).toLocaleString()}</span>
                    <span className="tnum" style={{ fontSize: 12.5, color: "var(--muted)", width: 64, textAlign: "right" }}>{roi >= 0 ? "+" : "−"}{Math.abs(roi)}%</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="cs-grid-2">
        {/* Conversion funnel */}
        <Card pad={0}>
          <div style={cardHead}><TrendingUp size={15} color="var(--accent)" /> <span style={{ fontWeight: 700, fontSize: 14 }}>Conversion funnel</span></div>
          <div style={{ padding: "16px 18px", display: "grid", gap: 14 }}>
            {funnel.map((f) => (
              <div key={f.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ color: "var(--muted)" }}>{f.label}</span>
                  <span className="tnum" style={{ fontWeight: 700 }}>{f.value}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "var(--surface2)", overflow: "hidden" }}>
                  <div style={{ width: `${(f.value / funnelMax) * 100}%`, height: "100%", borderRadius: 999, background: f.tone, transition: "width 0.4s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Views by category */}
        <Card pad={0}>
          <div style={cardHead}><BarChart3 size={15} color="var(--signal)" /> <span style={{ fontWeight: 700, fontSize: 14 }}>Views by category</span></div>
          <div style={{ padding: "16px 18px", display: "grid", gap: 13 }}>
            {byCategory.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>No views recorded yet.</div>}
            {byCategory.map(([cat, v]) => (
              <div key={cat}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "75%" }}>{cat}</span>
                  <span className="tnum" style={{ fontWeight: 700 }}>{v}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "var(--surface2)", overflow: "hidden" }}>
                  <div style={{ width: `${(v / catMaxV) * 100}%`, height: "100%", borderRadius: 999, background: "var(--signal)" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Top listings */}
      <Card pad={0}>
        <div style={cardHead}><Eye size={15} color="var(--muted)" /> <span style={{ fontWeight: 700, fontSize: 14 }}>Most-viewed listings</span></div>
        <div>
          {topListings.map((l: any, i: number) => (
            <div key={l.id} onClick={() => (window as any).csOpenExport?.(l)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", cursor: "pointer", borderBottom: i < topListings.length - 1 ? "1px solid var(--line)" : "none" }} className="cs-row">
              <span style={{ width: 22, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.part}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{l.category || "—"} · {l.status}</div>
              </div>
              <span className="tnum" style={{ fontSize: 14, fontWeight: 700, color: "var(--success)" }}>${l.price}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--muted)", width: 80, justifyContent: "flex-end" }}><Eye size={13} /> {l.views || 0}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const cardHead: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", borderBottom: "1px solid var(--line)" };

// Compact labelled number used in the profit summary row.
function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div className="tnum" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: tone }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}
