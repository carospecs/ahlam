"use client";

import React from "react";
import { DollarSign, TrendingUp, Cpu, LoaderCircle, ChevronDown, Info } from "lucide-react";
import { livePartPrice } from "@/lib/pricing";

export type PriceSource = "asking" | "ebay" | "ai";

export function PricingToggle({
  askingPrice,
  aiPrice,
  partName,
  vehicleText,
  source,
  onChange,
}: {
  askingPrice: number;
  aiPrice: number | null;
  partName: string;
  vehicleText?: string;
  source: PriceSource;
  onChange: (s: PriceSource) => void;
}) {
  const [ebayPrice, setEbayPrice] = React.useState<number | null>(null);
  const [loadingEbay, setLoadingEbay] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const query = vehicleText ? `${vehicleText} ${partName}` : partName;

  React.useEffect(() => {
    if (!open || ebayPrice !== null || loadingEbay) return;
    setLoadingEbay(true);
    livePartPrice(query).then((p) => { setEbayPrice(p); setLoadingEbay(false); });
  }, [open, ebayPrice, loadingEbay, query]);

  const prices: { key: PriceSource; label: string; icon: any; value: number | null; desc: string }[] = [
    { key: "asking", label: "Asking price", icon: DollarSign, value: askingPrice, desc: "Your listed price" },
    { key: "ebay", label: "eBay median", icon: TrendingUp, value: ebayPrice, desc: "Live eBay comps" },
    { key: "ai", label: "AI estimate", icon: Cpu, value: aiPrice, desc: "AI-suggested price" },
  ];

  const active = prices.find((p) => p.key === source);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
      >
        {active?.icon && <active.icon size={13} color="var(--accent)" />}
        <span className="tnum" style={{ fontWeight: 700 }}>${active?.value?.toLocaleString() ?? "—"}</span>
        <span style={{ color: "var(--muted)", fontSize: 11 }}>{active?.label}</span>
        <ChevronDown size={12} color="var(--muted)" />
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 100, marginTop: 4, minWidth: 220, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.3)", padding: 6 }}>
            {prices.map((p) => {
              const on = source === p.key;
              const val = p.value;
              const isLoading = p.key === "ebay" && loadingEbay && ebayPrice === null;
              return (
                <button
                  key={p.key}
                  onClick={() => { onChange(p.key); setOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", background: on ? "var(--accent-tint)" : "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: on ? 700 : 500, cursor: "pointer", textAlign: "left" }}
                >
                  <p.icon size={15} color={on ? "var(--accent)" : "var(--muted)"} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{p.label}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{p.desc}</div>
                  </div>
                  <span className="tnum" style={{ fontWeight: 700, fontSize: 14, color: on ? "var(--accent)" : "var(--foreground)" }}>
                    {isLoading ? <LoaderCircle size={14} className="spin" /> : val != null ? `$${val.toLocaleString()}` : "—"}
                  </span>
                </button>
              );
            })}
            {!loadingEbay && ebayPrice === null && (
              <div style={{ padding: "8px 12px", fontSize: 11.5, color: "var(--muted)", borderTop: "1px solid var(--line)", marginTop: 4 }}>
                <Info size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
                eBay pricing requires EBAY_CLIENT_ID and EBAY_CLIENT_SECRET env vars
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
