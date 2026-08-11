// Branded 404 for the personal sites: unknown paths on a live tenant host.
export default function ShopSiteNotFound() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "96px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em" }}>404</div>
      <p style={{ marginTop: 10, color: "var(--muted)", fontSize: 15 }}>
        That page isn&apos;t here. The part may have sold, or the link is old.
      </p>
      <a href="/" style={{ display: "inline-flex", marginTop: 20, padding: "11px 22px", borderRadius: 11, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
        Browse our inventory
      </a>
    </div>
  );
}
