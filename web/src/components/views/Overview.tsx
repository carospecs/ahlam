"use client";

import { TrendingUp, ArrowRight, Car, Wrench, Tag, DollarSign, ScanLine, TriangleAlert, MessageSquare, CircleCheck, Send, CirclePlus, Store, Circle } from "lucide-react";
import { Card, PhotoCell } from "../UI";
import { useData } from "../Dashboard";

export function Overview({ go }: { go: (id: string) => void; onVehicle?: (v: any) => void }) {
  const { vehicles, listings, activity, user, shop } = useData();
  const partsIdentified = listings.length;
  const activeListings = listings.filter((l: any) => l.status === "Posted" || l.status === "active").length;
  const soldListings = listings.filter((l: any) => l.status === "Sold");
  const soldTotal = soldListings.reduce((s: number, l: any) => s + (l.price || 0), 0);
  const soldCount = soldListings.length;

  // Brand-new accounts have nothing to summarize — guide them instead of showing a wall of zeros.
  const isNew = vehicles.length === 0 && listings.length === 0;
  const firstName = (user?.displayName || "").split(" ")[0];

  const stats = [
    { icon: Car, label: "Vehicles in inventory", value: String(vehicles.length), delta: vehicles.length > 0 ? null : null, tone: "var(--accent)", nav: "vehicles" },
    { icon: Wrench, label: "Parts identified", value: String(partsIdentified), delta: partsIdentified > 0 ? "+ parts" : null, tone: "var(--muted)", nav: "parts" },
    { icon: Tag, label: "Active listings", value: String(activeListings), tone: "var(--success)", nav: "parts" },
    { icon: DollarSign, label: "Sold this month", value: soldTotal > 0 ? `$${soldTotal.toLocaleString()}` : "$0", delta: soldCount > 0 ? `${soldCount} parts` : null, tone: "var(--signal)", nav: "analytics" },
  ];

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 1180 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="cs-grid4">
        {stats.map((s) => {
          const IconComp = s.icon;
          return (
            <button key={s.label} onClick={() => go(s.nav)} className="cs-card-btn" style={{ all: "unset", cursor: "pointer", display: "block" }} title={`Go to ${s.label}`}>
              <Card pad={18} style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `color-mix(in srgb, ${s.tone} 15%, transparent)`, display: "grid", placeItems: "center" }}>
                    <IconComp size={19} color={s.tone} />
                  </div>
                  {s.delta
                    ? <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 3 }}><TrendingUp size={13} /> {s.delta}</span>
                    : <ArrowRight size={15} color="var(--muted)" />}
                </div>
                <div>
                  <div className="tnum" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
                </div>
              </Card>
            </button>
          );
        })}
      </div>
      {isNew ? (
        <GettingStarted go={go} firstName={firstName} shopName={shop?.name} hasVehicle={vehicles.length > 0} hasListing={listings.length > 0} hasPosted={activeListings > 0} />
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }} className="cs-grid-2">
        <Card pad={0}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Recent vehicles</span>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: "var(--accent)", fontSize: 13, fontWeight: 600 }} onClick={() => go("vehicles")}>View all <ArrowRight size={13} /></button>
          </div>
          <div>
            {vehicles.length === 0 && (
              <div style={{ padding: "26px 18px", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>No vehicles yet.</div>
                <button onClick={() => go("add")} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 600 }}><CirclePlus size={16} /> Add your first vehicle</button>
              </div>
            )}
            {vehicles.slice(0, 4).map((v: any, i: number) => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 18px", borderBottom: i < 3 ? "1px solid var(--line)" : "none" }}>
                <PhotoCell icon="Car" style={{ width: 52, height: 40, flexShrink: 0 }} iconSize={20} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{v.year} {v.make} {v.model} <span style={{ color: "var(--muted)", fontWeight: 500 }}>{v.trim}</span></div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{v.parts} parts · {v.photos} photos · added {v.added}</div>
                </div>
                <div className="tnum" style={{ fontSize: 14, fontWeight: 700 }}>${v.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card pad={0}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Activity</span>
          </div>
          <div style={{ padding: "4px 18px 14px" }}>
            {activity.length === 0 && (
              <div style={{ padding: "22px 0", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
                No activity yet — it'll show up here as you add and post listings.
              </div>
            )}
             {activity.map((a: any, i: number) => {
               const iconMap: Record<string, any> = { ScanLine, TriangleAlert, MessageSquare, CircleCheck, Send };
               const IconComp = iconMap[a.icon] || ScanLine;
               const tones: Record<string, string> = { accent: "var(--accent)", success: "var(--success)", signal: "var(--signal)", muted: "var(--muted)" };
               const toneC = tones[a.tone] || "var(--muted)";
               return (
                 <div key={i} onClick={() => a.link && go(a.link)} style={{ display: "flex", gap: 12, padding: "11px 0", cursor: a.link ? "pointer" : "default", borderRadius: 6, borderBottom: i < activity.length - 1 ? "1px solid var(--line)" : "none" }}>
                   <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `color-mix(in srgb, ${toneC} 14%, transparent)`, display: "grid", placeItems: "center" }}>
                     <IconComp size={15} color={toneC} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <div style={{ fontSize: 13, lineHeight: 1.4 }}>{a.text}</div>
                     <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{a.time}</div>
                   </div>
                 </div>
               );
            })}
          </div>
        </Card>
      </div>
      )}
    </div>
  );
}

function GettingStarted({ go, firstName, shopName, hasVehicle, hasListing, hasPosted }: {
  go: (id: string) => void; firstName?: string; shopName?: string;
  hasVehicle: boolean; hasListing: boolean; hasPosted: boolean;
}) {
  const steps = [
    { done: true, label: "Create your shop", sub: shopName ? `${shopName} is set up` : "Workspace ready", nav: "shop" },
    { done: hasVehicle, label: "Add your first vehicle", sub: "Snap or upload up to 8 photos — AI grades the parts", nav: "add" },
    { done: hasListing, label: "Review your AI-graded parts", sub: "Check names, fitment, and suggested prices", nav: "parts" },
    { done: hasPosted, label: "Post a listing", sub: "Copy the text and cross-post everywhere you sell", nav: "export" },
  ];
  const nextStep = steps.find((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card pad={0}>
      <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em" }}>Welcome{firstName ? `, ${firstName}` : ""} 👋</div>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 3 }}>Let's get your first listing live. {doneCount} of {steps.length} done.</div>
        </div>
        {nextStep && (
          <button onClick={() => go(nextStep.nav)} className="cs-raise" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600 }}>
            <CirclePlus size={17} /> {nextStep.label}
          </button>
        )}
      </div>
      <div style={{ display: "grid", gap: 2, padding: 10 }}>
        {steps.map((s, i) => (
          <button key={i} onClick={() => go(s.nav)} className="cs-hover-row" style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 12px", border: "none", background: "transparent", textAlign: "left", color: "var(--foreground)", width: "100%" }}>
            {s.done
              ? <CircleCheck size={22} color="var(--success)" style={{ flexShrink: 0 }} />
              : <Circle size={22} color="var(--muted)" style={{ flexShrink: 0 }} />}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: s.done ? "var(--muted)" : "var(--foreground)", textDecoration: s.done ? "line-through" : "none" }}>{s.label}</span>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{s.sub}</span>
            </span>
            {!s.done && <ArrowRight size={16} color="var(--muted)" style={{ flexShrink: 0 }} />}
          </button>
        ))}
      </div>
    </Card>
  );
}
