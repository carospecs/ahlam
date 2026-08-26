import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/site/LanguageToggle";
import { LayoutDashboard } from "lucide-react";

// Sticky branded header for the Ultimate personal sites ({slug}.ahlam.io).
// Server component — everything here comes off the shop's public row.

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ahlam.io";

function starString(value: number): string {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
}

export function ShopSiteHeader({ shop, isOwner }: { shop: any; isOwner?: boolean }) {
  const initials = (shop.name || "S").split(" ").map((s: string) => s[0]).join("").toUpperCase().slice(0, 2);
  const ratingAvg = Number(shop.rating_avg || 0);
  const ratingCount = shop.rating_count || 0;
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, background: "color-mix(in srgb, var(--background) 88%, transparent)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit", minWidth: 0 }}>
          {shop.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logo_url} alt={shop.name} style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 800, flexShrink: 0 }}>{initials}</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{shop.name}</span>
              {shop.verified && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--success)", background: "color-mix(in srgb, var(--success) 12%, transparent)", borderRadius: 999, padding: "2.5px 8px", letterSpacing: "0.04em", flexShrink: 0 }}>✓ VERIFIED</span>}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {[shop.location, ratingCount > 0 ? `${starString(ratingAvg)} ${ratingAvg.toFixed(1)} (${ratingCount})` : ""].filter(Boolean).join(" · ")}
            </div>
          </div>
        </a>
        <nav className="cs-site-nav" style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
          <a href="/#inventory" style={navLink}>Parts</a>
          <a href="/#vehicles" style={navLink}>Vehicles</a>
          <a href="/#sold" style={navLink}>Recently sold</a>
          <a href="/#about" style={navLink}>About</a>
          {shop.business_phone && (
            <a href={`tel:${String(shop.business_phone).replace(/[^\d+]/g, "")}`} style={{ ...navLink, background: "var(--accent)", color: "#fff", fontWeight: 700, borderRadius: 10, padding: "8px 16px" }}>
              {shop.business_phone}
            </a>
          )}
          {isOwner && (
            <a href={APP_URL} style={{ ...navLink, display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid var(--line)", borderRadius: 9 }}>
              <LayoutDashboard size={13} /> Dashboard
            </a>
          )}
          <LanguageToggle />
          <span style={{ marginLeft: 6 }}><ThemeToggle size={34} /></span>
        </nav>
      </div>
    </header>
  );
}

const navLink: React.CSSProperties = { fontSize: 13.5, fontWeight: 600, color: "var(--muted)", textDecoration: "none", padding: "7px 12px", borderRadius: 9 };
