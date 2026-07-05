"use client";

import React from "react";
import { Check, ArrowRight } from "lucide-react";

// Custom, THEME-AWARE pricing — matches the site in dark and light (uses the app's
// CSS variables, so the light/dark toggle restyles it automatically) and lays the
// plans out in a single horizontal row. Mirrors the Stripe pricing table's plans;
// the CTA is wired by the caller (sign-up on the homepage, checkout in billing).
// Stripe price ids per plan can be wired into onChoose once provided.

export interface Plan {
  id: string;
  name: string;
  price: string;
  per?: string;
  desc: string;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Free trial",
    price: "$0",
    per: "/first month",
    desc: "Your first month is free, with every feature unlocked and no card required. Try the whole platform, not a stripped-down version.",
    features: [
      "Free for your first month",
      "AI scan: 2 cars included (photo-to-listing)",
      "Every feature we've built, included",
      "Unlimited manual listings",
      "Access to Ahlam marketplace",
    ],
  },
  {
    id: "solo",
    name: "Solo",
    price: "$19",
    per: "/mo",
    desc: "For individuals and flippers who mostly want the cross-posting extension, with a few AI scans each month.",
    features: [
      "Single user",
      "AI scan: 3 cars per month (photo-to-listing)",
      "Cross-post with the Ahlam browser extension (Facebook, OfferUp)",
      "Post up to 1 car a day",
      "Export up to 20 cars / 100 parts a month",
      "List on the Ahlam marketplace",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: "$100",
    per: "/mo",
    desc: "For dismantlers selling on eBay who want AI scanning and automation without the full cross-post suite.",
    features: [
      "AI scan: 5 cars per month (photo-to-listing)",
      "eBay auto-posting (eBay is this plan's marketplace channel)",
      "Unlimited manual listings",
      "Team access: Owner & Editor",
      "AI Interchange Assistant (parts fitment across vehicles)",
      "AI Auto-Repricing (market watch, updates prices automatically)",
      "Inventory analytics",
      "List on the Ahlam marketplace",
    ],
    highlight: true,
  },
  {
    id: "max",
    name: "Max",
    price: "$200",
    per: "/mo",
    desc: "For high-volume yards that need full team access and cross-platform selling power.",
    features: [
      "AI scan: 20 cars per month (photo-to-listing)",
      "Cross-post everywhere: eBay, Facebook, OfferUp",
      "Unlimited manual listings",
      "Team access: Owner & Unlimited Editors",
      "AI Interchange Assistant (parts fitment across vehicles)",
      "AI Auto-Repricing (market watch, updates prices automatically)",
      "Full inventory analytics & profit tracking",
    ],
  },
  {
    id: "ultimate",
    name: "Ultimate",
    price: "$350",
    per: "/mo",
    desc: "Everything in Max, plus we build and host a professional website for your business with your own custom domain, fully managed by Ahlam.",
    features: [
      "Unlimited AI car scans (photo-to-listing)",
      "Cross-post everywhere: eBay, Facebook, OfferUp",
      "Unlimited manual listings",
      "Team access: Owner & Unlimited Editors",
      "AI Interchange Assistant (parts fitment across vehicles)",
      "AI Auto-Repricing (market watch, updates prices automatically)",
      "Full inventory analytics & profit tracking",
      "Custom business website, built for you",
      "Managed domain registration & hosting · priority support",
    ],
  },
];

export function PricingPlans({
  onChoose,
  ctaLabel,
}: {
  onChoose?: (planId: string) => void;
  ctaLabel?: string;
}) {
  return (
    <div className="cs-plan-row" style={{ display: "flex", gap: 14, alignItems: "stretch", justifyContent: "center", flexWrap: "wrap" }}>
      {PLANS.map((p) => (
        <div
          key={p.id}
          className="cs-glass"
          style={{
            flex: "1 1 0",
            minWidth: 198,
            maxWidth: 300,
            borderRadius: "var(--radius-xl)",
            padding: 20,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            border: p.highlight
              ? "1.5px solid color-mix(in srgb, var(--accent) 60%, var(--line))"
              : "1px solid var(--line)",
            background: p.highlight ? "color-mix(in srgb, var(--accent) 5%, var(--surface))" : "var(--surface)",
          }}
        >
          {p.highlight && (
            <span style={{ position: "absolute", top: -12, left: 28, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#fff", background: "var(--accent)", borderRadius: 999, padding: "4px 12px" }}>
              Most popular
            </span>
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.name}</div>
          <div className="cs-display" style={{ fontSize: 38, fontWeight: 800, marginTop: 8, lineHeight: 1 }}>
            {p.price}
            {p.per && <span style={{ fontSize: 14, fontWeight: 500, color: "var(--muted)", fontFamily: "var(--font-sans)" }}>{p.per}</span>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10, lineHeight: 1.5, minHeight: 72 }}>{p.desc}</div>
          <div style={{ display: "grid", gap: 11, margin: "20px 0 24px" }}>
            {p.features.map((f) => (
              <div key={f} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.45 }}>
                <Check size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} /> {f}
              </div>
            ))}
          </div>
          <button
            onClick={() => onChoose?.(p.id)}
            className="cs-raise"
            style={{
              marginTop: "auto",
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "13px 0",
              fontSize: 15,
              fontWeight: 700,
              borderRadius: 12,
              cursor: "pointer",
              border: p.highlight ? "none" : "1px solid var(--line)",
              background: p.highlight ? "var(--accent)" : "transparent",
              color: p.highlight ? "#fff" : "var(--foreground)",
            }}
          >
            {ctaLabel ?? (p.id === "starter" ? "Start free" : "Choose " + p.name)} <ArrowRight size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
