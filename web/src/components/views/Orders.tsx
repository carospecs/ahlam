"use client";

import React from "react";
import { Package, ShoppingBag, Truck, CircleCheck, Clock, LoaderCircle, ShieldCheck } from "lucide-react";
import { Card } from "../UI";
import { csToast } from "../Dashboard";

interface Order {
  id: string;
  title: string;
  amount_cents: number;
  fee_cents: number;
  status: string;
  created_at: string;
  stripe_transfer_id: string | null;
}

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  paid: { label: "Paid — in escrow", color: "var(--accent)", icon: ShieldCheck },
  shipped: { label: "Shipped", color: "var(--signal)", icon: Truck },
  completed: { label: "Completed", color: "var(--success)", icon: CircleCheck },
  refunded: { label: "Refunded", color: "var(--muted)", icon: Clock },
  cancelled: { label: "Cancelled", color: "var(--muted)", icon: Clock },
};

function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function Orders() {
  const [purchases, setPurchases] = React.useState<Order[]>([]);
  const [sales, setSales] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<"purchases" | "sales">("purchases");
  const [busy, setBusy] = React.useState<string | null>(null);

  function load() {
    fetch("/api/payments/orders")
      .then((r) => r.json())
      .then((d) => { setPurchases(d.purchases || []); setSales(d.sales || []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  React.useEffect(load, []);

  async function act(orderId: string, action: "ship" | "confirm") {
    setBusy(orderId);
    try {
      const r = await fetch("/api/payments/release", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action }),
      });
      const d = await r.json();
      if (!r.ok) { csToast(d.error || "Could not update order"); setBusy(null); return; }
      csToast(action === "ship" ? "Marked as shipped" : "Receipt confirmed — seller paid out");
      load();
    } catch { csToast("Could not update order"); }
    setBusy(null);
  }

  const list = tab === "purchases" ? purchases : sales;

  return (
    <div style={{ maxWidth: 820, display: "grid", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--muted)", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 14px" }}>
        <ShieldCheck size={14} color="var(--accent)" /> Payments are held in escrow until the buyer confirms they got the part — then the seller is paid out automatically.
      </div>

      <div style={{ display: "flex", gap: 6, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 5, width: "fit-content" }}>
        {[["purchases", "Purchases", ShoppingBag, purchases.length] as const, ["sales", "Sales", Package, sales.length] as const].map(([id, label, Icon, n]) => {
          const on = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 9, border: "none", background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--muted)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              <Icon size={16} /> {label} <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>{n}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>Loading orders…</div>
      ) : list.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", color: "var(--muted)", fontSize: 14, border: "1px dashed var(--line)", borderRadius: 14 }}>
          {tab === "purchases" ? "You haven't bought anything yet." : "No sales yet — they'll appear here once a buyer pays."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {list.map((o) => {
            const meta = STATUS_META[o.status] || STATUS_META.paid;
            const Icon = meta.icon;
            const payout = o.amount_cents - o.fee_cents;
            return (
              <Card key={o.id} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, flexShrink: 0 }}>
                  <Icon size={19} color={meta.color} />
                </span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{o.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                    {new Date(o.created_at).toLocaleDateString()} · <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="tnum" style={{ fontSize: 17, fontWeight: 800 }}>{dollars(o.amount_cents)}</div>
                  {tab === "sales" && (
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>you get {dollars(payout)} · fee {dollars(o.fee_cents)}</div>
                  )}
                </div>
                {tab === "sales" && o.status === "paid" && (
                  <button onClick={() => act(o.id, "ship")} disabled={busy === o.id} style={actBtn}>
                    {busy === o.id ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <Truck size={15} />} Mark shipped
                  </button>
                )}
                {tab === "purchases" && (o.status === "paid" || o.status === "shipped") && (
                  <button onClick={() => act(o.id, "confirm")} disabled={busy === o.id} style={{ ...actBtn, background: "var(--success)", color: "#fff", border: "none" }}>
                    {busy === o.id ? <LoaderCircle size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <CircleCheck size={15} />} Confirm receipt
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

const actBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 10,
  border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--foreground)",
  fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0,
};
