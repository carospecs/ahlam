import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Check, ArrowRight, CalendarCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BrandMark } from "@/components/BrandMark";
import { COMPARE } from "@/components/site-nav";

// Compare page — a fair, filled-out comparison of Ahlam against the four
// alternatives small yards actually weigh: Car-Part.com, listing on eBay by
// hand, legacy yard-management systems, and a spreadsheet. Server component
// (static, no client handlers) with exported metadata. Matches the editorial
// design language: solid surfaces, hairline structure, mono kickers.

const CAL_DEMO_URL = "https://cal.com/team/ahlam-team";

export const metadata: Metadata = {
  title: "Compare Ahlam: vs Car-Part.com, eBay, Hollander & spreadsheets",
  description:
    "How Ahlam compares to Car-Part.com, listing on eBay by hand, Hollander/Checkmate yard systems, and spreadsheets. Ahlam identifies, grades, and prices every part from a photo, then writes and posts the listing. A fair, side-by-side look.",
  alternates: { canonical: "/compare" },
  openGraph: {
    title: "Compare Ahlam vs Car-Part.com, eBay, Hollander & spreadsheets",
    description:
      "Ahlam identifies, grades, and prices a part from a photo, then writes and posts the listing. See how that compares to the tools small yards use today.",
    type: "website",
  },
};

// --- The capability matrix -------------------------------------------------
// Columns are Ahlam (highlighted) + the four alternatives. Each cell is one of
// three honest states so the table reads as fair, not as a hit piece.
type Cell = "yes" | "part" | "no";

const COLUMNS: { name: string; brand?: boolean }[] = [
  { name: "Ahlam", brand: true },
  { name: "Car-Part.com" },
  { name: "eBay Motors" },
  { name: "Hollander / Checkmate" },
  { name: "Spreadsheets" },
];

const MATRIX: { label: string; vals: Cell[] }[] = [
  { label: "Identifies the part from a photo", vals: ["yes", "no", "no", "no", "no"] },
  { label: "Grades condition (A / B / C)", vals: ["yes", "no", "no", "no", "no"] },
  { label: "Prices from real market comps", vals: ["yes", "part", "part", "part", "no"] },
  { label: "Writes the listing for you", vals: ["yes", "no", "no", "no", "no"] },
  { label: "Posts to eBay + more in one tap", vals: ["yes", "no", "part", "part", "no"] },
  { label: "Built for a two-person yard", vals: ["yes", "part", "no", "part", "part"] },
  { label: "Starts free", vals: ["yes", "no", "part", "no", "yes"] },
];

// --- Expanded, fair contrast for each alternative (keyed by COMPARE slug) ---
const DETAIL: Record<string, { blurb: string[]; theirs: string[]; ours: string[] }> = {
  "car-part": {
    blurb: [
      "Car-Part.com is the largest used-parts locator in the trade, the place buyers and yards have searched for decades to find a specific part sitting in stock somewhere.",
      "But it shows what you have already typed up and priced. You bring the part name, the fitment, the grade, and the number, then it lists and locates it.",
      "Ahlam works a step earlier. It reads a photo, identifies the part, grades its condition, and prices it from real comps, then hands you a finished listing you can push to Car-Part.com and everywhere else you sell.",
    ],
    theirs: [
      "Decades of buyer trust and reach across the industry",
      "Deep interchange and fitment data for hard-to-find parts",
      "The go-to network when a buyer needs one specific part",
    ],
    ours: [
      "Identifies and grades the part for you, straight from a photo",
      "Prices from live market comps, not your own guess",
      "Posts to eBay, Facebook, OfferUp, and your own storefront too",
    ],
  },
  "ebay-motors": {
    blurb: [
      "eBay is where a huge share of used-parts buyers already shop, and its sold-listing history is a genuine pricing signal.",
      "The catch is the work. Listing by hand means you already know what the part is, which cars it fits, what condition to call it, and what to charge, then you type all of it in, one part at a time.",
      "Ahlam does the knowing for you. It names the part, grades it, prices it from the median of real sales, writes the listing, and posts it to eBay in a tap, with Facebook and OfferUp next.",
    ],
    theirs: [
      "An enormous buyer base actively searching for parts",
      "Sold-listing history is a real pricing reference",
      "Built-in payments, shipping, and buyer protection",
    ],
    ours: [
      "No parts expertise needed: the AI identifies and grades",
      "Median-of-comps pricing instead of a manual lookup per part",
      "One scan becomes listings on eBay and four more channels",
    ],
  },
  hollander: {
    blurb: [
      "Hollander and Checkmate are the backbone of large, established dismantlers: serious inventory databases with interchange numbers, tear-down tracking, and multi-yard reporting.",
      "That power comes with a price tag, a learning curve, and a workflow built around a full back office. It is a lot of system for a yard run by one or two people.",
      "Ahlam is not trying to replace that for a 40-person operation. It is the photo-to-listing tool a small yard can open today, scan a car, and have priced, posted listings by lunch, with no implementation project.",
    ],
    theirs: [
      "Mature inventory control for high-volume yards",
      "Industry-standard interchange and tear-down tracking",
      "Multi-location reporting and established integrations",
    ],
    ours: [
      "Live in minutes, with no setup or training project",
      "The AI does the identifying, grading, and pricing",
      "Priced for a two-person yard, and free to start",
    ],
  },
  spreadsheets: {
    blurb: [
      "A spreadsheet is free, familiar, and completely under your control, which is exactly why most small yards still run on one.",
      "But a spreadsheet only records a part after you have done the hard parts: figuring out what it is, what shape it is in, and what it should sell for.",
      "Ahlam does that work and keeps the record itself, so your inventory, grades, prices, and live listings all live in one place that also posts them for sale.",
    ],
    theirs: [
      "Free, flexible, and nothing new to learn",
      "Total control over your own columns and notes",
      "Fine for a handful of parts a week",
    ],
    ours: [
      "Identifies, grades, and prices, so you just review",
      "Inventory and live listings in one system, not two",
      "Scales to a whole car in minutes, not an afternoon",
    ],
  },
};

export default function ComparePage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <SiteHeader />
      <main style={{ position: "relative", zIndex: 1 }}>
        {/* Hero */}
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div
            className="cs-hero-grid"
            style={{ maxWidth: 1080, margin: "0 auto", padding: "70px 24px 64px", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 52, alignItems: "center" }}
          >
            <div>
              <div className="cs-kicker">Compare</div>
              <h1 className="cs-display" style={{ margin: "14px 0 0", fontSize: "clamp(36px, 4.6vw, 52px)", fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.06 }}>
                The deal brain for parts. <span className="accent">Not a database, not a listing form.</span>
              </h1>
              <p style={{ margin: "20px 0 0", fontSize: 17, color: "var(--muted)", lineHeight: 1.62, maxWidth: 520 }}>
                Most tools start after the hard part is done. They store a part you already identified, or list a price you already set. Ahlam starts at the photo: it identifies every sellable part, grades its condition, prices it from real market comps, then writes the listing and posts it. Here is how that compares to the tools small yards use today.
              </p>
              <div style={{ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap", alignItems: "center" }}>
                <Link href="/waitlist" className="cs-raise" style={solidBtn}>
                  Join the waitlist <ArrowRight size={17} />
                </Link>
                <a href={CAL_DEMO_URL} target="_blank" rel="noopener noreferrer" style={ghostBtn}>
                  <CalendarCheck size={16} /> Book a demo
                </a>
              </div>
              <div style={{ marginTop: 22, display: "flex", gap: 18, flexWrap: "wrap" }}>
                {["Free first month, no card", "Posts to eBay today", "Built for two-person yards"].map((t) => (
                  <span key={t} style={{ fontSize: 13, color: "var(--muted)", display: "inline-flex", gap: 7, alignItems: "center" }}>
                    <Check size={14} color="var(--success)" /> {t}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ position: "relative" }}>
              <span aria-hidden style={{ position: "absolute", top: -14, right: -14, width: 150, height: 150, background: "var(--sand)", borderRadius: 6, opacity: 0.9, zIndex: 0 }} />
              <div style={{ position: "relative", zIndex: 1 }} className="cs-frame">
                <div className="cs-frame__bar">
                  <span className="cs-frame__dot" style={{ background: "#ff5f57" }} />
                  <span className="cs-frame__dot" style={{ background: "#febc2e" }} />
                  <span className="cs-frame__dot" style={{ background: "#28c840" }} />
                  <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600 }}>Ahlam vs the rest</span>
                </div>
                <div className="cs-photo" style={{ height: 300, borderRadius: 0, border: "none" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/img/compare.webp" alt="Comparing how Ahlam prices and lists a part against the manual way" loading="lazy" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The comparison table */}
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "78px 24px" }}>
            <div style={{ maxWidth: 700 }}>
              <div className="cs-kicker">Side by side</div>
              <h2 className="cs-display" style={h2}>
                What each one actually <span className="accent">does for you</span>
              </h2>
              <p style={{ color: "var(--muted)", fontSize: 16.5, marginTop: 12, lineHeight: 1.6, maxWidth: 640 }}>
                The same seven jobs, across every option. Most tools handle the storing and the listing. Ahlam is the only one that does the identifying, grading, and pricing first.
              </p>
            </div>

            <div className="cs-panel" style={{ marginTop: 34, padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={{ ...thCell, textAlign: "left", width: "26%" }}>
                      <span className="cs-kicker" style={{ fontSize: 11 }}>Capability</span>
                    </th>
                    {COLUMNS.map((c, i) => (
                      <th
                        key={c.name}
                        style={{
                          ...thCell,
                          textAlign: "center",
                          background: i === 0 ? "var(--accent-tint)" : "transparent",
                          borderLeft: i === 0 ? "1px solid color-mix(in srgb, var(--accent) 32%, transparent)" : "1px solid var(--line)",
                          borderRight: i === 0 ? "1px solid color-mix(in srgb, var(--accent) 32%, transparent)" : "none",
                        }}
                      >
                        <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                          {c.brand ? (
                            <>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                                <BrandMark size={18} />
                                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>{c.name}</span>
                              </span>
                              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)" }}>The deal brain</span>
                            </>
                          ) : (
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--muted)", lineHeight: 1.3 }}>{c.name}</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MATRIX.map((row, ri) => (
                    <tr key={row.label}>
                      <td style={{ ...tdCell, textAlign: "left", fontWeight: 600, color: "var(--foreground)", borderTop: ri === 0 ? "1px solid var(--line)" : "1px solid var(--line)" }}>
                        {row.label}
                      </td>
                      {row.vals.map((v, ci) => (
                        <td
                          key={ci}
                          style={{
                            ...tdCell,
                            textAlign: "center",
                            background: ci === 0 ? "var(--accent-tint)" : "transparent",
                            borderLeft: ci === 0 ? "1px solid color-mix(in srgb, var(--accent) 32%, transparent)" : "1px solid var(--line)",
                            borderRight: ci === 0 ? "1px solid color-mix(in srgb, var(--accent) 32%, transparent)" : "none",
                          }}
                        >
                          <Mark v={v} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 18 }}>
              <span style={legendItem}><Check size={15} color="var(--success)" /> Built in</span>
              <span style={legendItem}><Check size={14} color="var(--muted)" /> Limited or manual</span>
              <span style={legendItem}><span style={dashMark} /> Not offered</span>
            </div>
          </div>
        </section>

        {/* Per-alternative deep dives */}
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "78px 24px" }}>
            <div style={{ maxWidth: 700 }}>
              <div className="cs-kicker">The honest version</div>
              <h2 className="cs-display" style={h2}>
                Where each one fits, and where <span className="accent">Ahlam wins</span>
              </h2>
              <p style={{ color: "var(--muted)", fontSize: 16.5, marginTop: 12, lineHeight: 1.6, maxWidth: 640 }}>
                Every option here earns its place for someone. The question is whether it does the part that actually slows you down: knowing what a part is, what it is worth, and getting it listed.
              </p>
            </div>

            <div style={{ display: "grid", gap: 22, marginTop: 44 }}>
              {COMPARE.map((row, i) => {
                const d = DETAIL[row.slug];
                if (!d) return null;
                return (
                  <article key={row.slug} className="cs-panel" style={{ padding: "30px 30px 32px", position: "relative", overflow: "hidden" }}>
                    <span aria-hidden style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: "var(--accent)" }} />
                    <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                      <span className="cs-index" style={{ fontSize: 24 }}>{String(i + 1).padStart(2, "0")}</span>
                      <span className="cs-kicker">{row.kind}</span>
                    </div>
                    <h3 className="cs-display" style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-0.02em", margin: "12px 0 0", lineHeight: 1.18 }}>
                      Ahlam vs {row.them}
                    </h3>
                    <div style={{ marginTop: 13, maxWidth: 820 }}>
                      {d.blurb.map((p, pi) => (
                        <p key={pi} style={{ margin: pi === 0 ? 0 : "10px 0 0", fontSize: 15.5, color: "var(--muted)", lineHeight: 1.65 }}>{p}</p>
                      ))}
                    </div>

                    <div className="cs-feat-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
                      <div className="cs-well" style={{ padding: "18px 20px" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>
                          Where {row.them} fits
                        </div>
                        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 9 }}>
                          {d.theirs.map((t) => (
                            <li key={t} style={{ display: "flex", gap: 10, fontSize: 14, color: "var(--foreground)", lineHeight: 1.5 }}>
                              <span aria-hidden style={{ ...dotMark, marginTop: 7 }} /> {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="cs-well" style={{ padding: "18px 20px", borderColor: "color-mix(in srgb, var(--accent) 35%, var(--line))", background: "var(--accent-tint)" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 12 }}>
                          Where Ahlam wins
                        </div>
                        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 9 }}>
                          {d.ours.map((t) => (
                            <li key={t} style={{ display: "flex", gap: 10, fontSize: 14, color: "var(--foreground)", lineHeight: 1.5 }}>
                              <Check size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} /> {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Closing CTA band */}
        <section>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "76px 24px" }}>
            <div style={{ borderRadius: "var(--radius-xl)", padding: "48px 40px", background: "var(--surface)", border: "1px solid var(--line)", position: "relative", overflow: "hidden" }}>
              <span aria-hidden style={{ position: "absolute", top: 0, left: 0, width: 6, height: "100%", background: "var(--accent)" }} />
              <div className="cs-cta-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: 36, alignItems: "center" }}>
                <div>
                  <div className="cs-kicker">See it on your own cars</div>
                  <h2 className="cs-display" style={{ ...h2, margin: "10px 0 0" }}>
                    The fastest way to compare is to <span className="accent">scan one car</span>
                  </h2>
                  <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.6, margin: "12px 0 0", maxWidth: 520 }}>
                    Join the waitlist for your free first month, or book a 15-minute walkthrough and we will scan one of your vehicles live and price every part on the spot.
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Link href="/waitlist" className="cs-raise" style={{ ...solidBtn, justifyContent: "center", padding: "14px 24px", fontSize: 15.5 }}>
                    Join the waitlist <ArrowRight size={17} />
                  </Link>
                  <a href={CAL_DEMO_URL} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, justifyContent: "center", padding: "13px 22px", fontSize: 15 }}>
                    <CalendarCheck size={16} /> Book a demo
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

// --- Cell mark: yes / limited / not offered --------------------------------
function Mark({ v }: { v: Cell }) {
  if (v === "yes") return <Check size={18} color="var(--success)" aria-label="Built in" />;
  if (v === "part")
    return (
      <span title="Limited or manual" aria-label="Limited or manual" style={{ display: "inline-flex" }}>
        <Check size={15} color="var(--muted)" style={{ opacity: 0.85 }} />
      </span>
    );
  return <span aria-label="Not offered" title="Not offered" style={dashMark} />;
}

// --- Shared inline styles --------------------------------------------------
const h2: React.CSSProperties = { fontSize: 38, fontWeight: 600, letterSpacing: "-0.02em", margin: "14px 0 0", lineHeight: 1.1 };

const solidBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 10,
  border: "none", background: "var(--accent)", color: "#fff", fontSize: 15, fontWeight: 600, textDecoration: "none",
};
const ghostBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 10,
  border: "1px solid var(--line)", background: "transparent", color: "var(--foreground)", fontSize: 15, fontWeight: 600, textDecoration: "none",
};

const thCell: React.CSSProperties = { padding: "18px 16px", verticalAlign: "bottom", borderBottom: "1px solid var(--line)" };
const tdCell: React.CSSProperties = { padding: "15px 16px", borderTop: "1px solid var(--line)", verticalAlign: "middle" };

const legendItem: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", fontWeight: 500 };
const dashMark: React.CSSProperties = { display: "inline-block", width: 14, height: 2, borderRadius: 2, background: "color-mix(in srgb, var(--muted) 55%, transparent)" };
const dotMark: React.CSSProperties = { flexShrink: 0, width: 6, height: 6, borderRadius: 999, background: "var(--sand)" };
