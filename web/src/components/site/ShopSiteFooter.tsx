import { BrandMark } from "@/components/BrandMark";

// Footer for the Ultimate personal sites: local-keyword links (SEO) computed
// from the shop's real inventory, plus the "Powered by Ahlam" attribution that
// funnels visiting sellers back to ahlam.io.

export function ShopSiteFooter({ shop, parts }: { shop: any; parts: any[] }) {
  const place = shop.location || shop.zip_code || "";
  const categories = Array.from(new Set(parts.map((p: any) => p.category).filter(Boolean))).slice(0, 5) as string[];
  const makes = Array.from(new Set(
    parts.map((p: any) => (p.fitment || "").split(" ").find((w: string) => /^[A-Z][a-z]+$/.test(w)) || "").filter(Boolean)
  )).slice(0, 4) as string[];
  const keywords: string[] = [
    place && `Used auto parts in ${place}`,
    place && `Salvage yard ${place}`,
    ...makes.map((m) => (place ? `${m} parts near ${place}` : `${m} used parts`)),
    ...categories.map((c) => (place ? `${c} in ${place}` : `Used ${c.toLowerCase()}`)),
  ].filter(Boolean) as string[];

  return (
    <footer style={{ marginTop: 56, borderTop: "1px solid var(--line)", padding: "30px 0 40px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        {keywords.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "7px 16px", marginBottom: 22 }}>
            {keywords.map((k) => (
              <a key={k} href="/#inventory" style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}>{k}</a>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            © {new Date().getFullYear()} {shop.name}{shop.address_line ? ` · ${shop.address_line}` : ""}{place ? ` · ${place}` : ""}
          </div>
          <a href="https://ahlam.io" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit", fontWeight: 800, fontSize: 13.5 }}>
            <BrandMark size={18} /> Powered by Ahlam
          </a>
        </div>
      </div>
    </footer>
  );
}
