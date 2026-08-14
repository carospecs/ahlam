import type { Metadata } from "next";
import { Store, MapPin } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Reveal } from "@/components/Reveal";
import { SHOP_SUBDOMAINS } from "@/lib/shop-subdomains";
import { siteOrigin } from "@/lib/slug";
import * as shopProfiles from "@/lib/shop-static-profiles";

// Apex directory of every shop with its own {slug}.ahlam.io storefront. Plain
// server-rendered <a> anchors (not next/link — the targets are other hosts) so
// crawlers discover the subdomains from a page Google already indexes, with
// keyword-rich anchor text ("<name> — used auto parts in <city>").

export const metadata: Metadata = {
  title: "Shops on Ahlam · Used Auto Parts & Salvage Yards",
  description:
    "Browse salvage yards and auto dismantlers selling used OEM parts on Ahlam. Every shop has live inventory, honest condition grades, and its own storefront.",
  alternates: { canonical: "https://ahlam.io/shops" },
};

// Best-effort display data: prefer the static profile row (name/location), fall
// back to a prettified slug. Wildcard import + runtime checks so this compiles
// regardless of the profiles module's exact export shape.
function shopDisplay(slug: string): { name: string; city: string } {
  const profile: any = (shopProfiles as any).SHOP_STATIC_PROFILES?.[slug];
  const name = profile?.name || prettifySlug(slug);
  const city = profile?.location || "";
  return { name, city };
}

function prettifySlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export default function ShopsDirectoryPage() {
  const shops = Object.keys(SHOP_SUBDOMAINS).map((slug) => ({ slug, ...shopDisplay(slug) }));

  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", position: "relative" }}>
      <div className="aurora" aria-hidden="true">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <PublicHeader />

        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 32px" }}>
            <Reveal>
              <div className="cs-eyebrow">Directory</div>
              <h1 className="cs-display" style={{ margin: "10px 0 10px", fontSize: "clamp(34px, 4.6vw, 46px)", fontWeight: 600, letterSpacing: "-0.02em" }}>Shops on Ahlam</h1>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 15.5, lineHeight: 1.7, maxWidth: 560 }}>
                Salvage yards and auto dismantlers selling used OEM parts through Ahlam. Each shop runs its own storefront with live inventory, honest condition grades, and real warranties.
              </p>
            </Reveal>
          </div>
        </section>

        <section style={{ maxWidth: 760, margin: "0 auto", padding: "36px 24px 64px" }}>
          <div className="cs-faq-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {shops.map((s) => (
              <Reveal key={s.slug}>
                <a
                  href={`${siteOrigin(s.slug)}/`}
                  style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%", padding: 20, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)", textDecoration: "none", color: "var(--foreground)" }}
                >
                  <span style={{ display: "inline-grid", placeItems: "center", width: 38, height: 38, borderRadius: 10, background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>
                    <Store size={18} />
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>
                    {s.name} — used auto parts{s.city ? ` in ${s.city}` : ""}
                  </span>
                  {s.city && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, color: "var(--muted)" }}>
                      <MapPin size={14} /> {s.city}
                    </span>
                  )}
                  <span style={{ marginTop: "auto", fontSize: 13.5, fontWeight: 700, color: "var(--accent)" }}>{s.slug}.ahlam.io →</span>
                </a>
              </Reveal>
            ))}
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
