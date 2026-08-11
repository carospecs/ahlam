import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

// Header for a shop's own subdomain (<slug>.ahlam.io) — reads as their site,
// not ours: shop name/logo instead of the Ahlam brand, no sign-in/get-started
// pills, no link back to ahlam.io. Just a small "Powered by Ahlam" credit,
// since we manage the site for them behind the scenes.
export function ShopHeader({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const initials = (name || "S").split(" ").map((s) => s[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div style={{ position: "sticky", top: 14, zIndex: 30, display: "flex", justifyContent: "center", padding: "0 16px" }}>
      <header className="cs-pill is-scrolled" style={{ borderRadius: 999, padding: "8px 14px 8px 10px", display: "inline-flex", alignItems: "center", gap: 9 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none", color: "var(--foreground)" }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={name} style={{ width: 28, height: 28, borderRadius: 8, objectFit: "cover" }} />
          ) : (
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800 }}>{initials}</span>
          )}
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>{name}</span>
        </Link>
        <span style={{ width: 1, height: 18, background: "color-mix(in srgb, var(--foreground) 14%, transparent)", margin: "0 3px", flexShrink: 0 }} />
        <ThemeToggle size={31} />
      </header>
    </div>
  );
}

export function ShopFooterCredit() {
  return (
    <div style={{ textAlign: "center", padding: "18px 24px 30px", fontSize: 12, color: "var(--muted)" }}>
      Site powered by{" "}
      <a href="https://ahlam.io" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
        Ahlam
      </a>
    </div>
  );
}
