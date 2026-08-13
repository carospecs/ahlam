import { MessageSeller } from "./MessageSeller";

// A real small-business homepage for a shop's own subdomain — hero, what they
// offer, about, contact — not just an empty "no listings" catalog view.
// Falls back to sensible defaults for anything the owner hasn't filled in yet
// (they can overwrite all of this by logging in and editing their profile).

const DEFAULT_SERVICES = [
  { title: "Used OEM Parts", desc: "Quality-checked used parts pulled from a wide range of makes and models." },
  { title: "Engines & Transmissions", desc: "Tested drivetrain components with mileage and condition noted." },
  { title: "Body Parts & Accessories", desc: "Doors, bumpers, mirrors, glass, and trim at a fraction of new price." },
  { title: "We Buy Junk Cars", desc: "Sell your non-running or damaged vehicle for cash — free pickup." },
];

export function ShopSite({ shop, listingCount }: { shop: any; listingCount: number }) {
  const phone = shop.business_phone as string | null;
  const address = [shop.address_line, shop.location].filter(Boolean).join(", ");
  const mapQuery = encodeURIComponent(address || shop.name);

  return (
    <>
      {/* Hero */}
      <div className="grain" style={{ borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 24px 48px", textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 800, letterSpacing: "-0.03em" }}>
            {shop.name}
          </h1>
          <p style={{ margin: "14px auto 0", maxWidth: 620, fontSize: 16, lineHeight: 1.6, color: "var(--muted)" }}>
            {shop.description || `Quality used auto parts and vehicle dismantling${shop.location ? ` serving ${shop.location}` : ""}.`}
          </p>
          <div style={{ marginTop: 26, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {phone && (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} style={btn(true)}>
                ☎ Call {phone}
              </a>
            )}
            <MessageSeller shopId={shop.id} subject="your inventory" sellerName={shop.name} />
          </div>
        </div>
      </div>

      {/* What we offer */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 20px" }}>What We Offer</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {DEFAULT_SERVICES.map((s) => (
            <div key={s.title} style={{ padding: 20, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
        {listingCount > 0 && (
          <p style={{ marginTop: 18, fontSize: 13.5, color: "var(--muted)" }}>
            {listingCount} item{listingCount === 1 ? "" : "s"} currently listed — see below.
          </p>
        )}
      </div>

      {/* Contact */}
      <div style={{ borderTop: "1px solid var(--line)", background: "var(--surface)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 16px" }}>Visit or Contact Us</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14.5 }}>
              {address && <div>📍 {address}</div>}
              {phone && <div>☎ <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} style={{ color: "inherit" }}>{phone}</a></div>}
              {shop.email && <div>✉ <a href={`mailto:${shop.email}`} style={{ color: "inherit" }}>{shop.email}</a></div>}
              {shop.hours && <div>🕑 {shop.hours}</div>}
              {shop.website && <div>🔗 <a href={shop.website} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Full catalog ↗</a></div>}
            </div>
          </div>
          {address && (
            <iframe
              title="Map"
              style={{ width: "100%", minHeight: 220, border: "1px solid var(--line)", borderRadius: 14 }}
              loading="lazy"
              src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
            />
          )}
        </div>
      </div>
    </>
  );
}

function btn(solid: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "11px 22px",
    borderRadius: 999,
    fontSize: 14.5,
    fontWeight: 700,
    textDecoration: "none",
    border: solid ? "none" : "1px solid var(--line)",
    background: solid ? "var(--accent)" : "transparent",
    color: solid ? "#fff" : "var(--foreground)",
  } as const;
}
