import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { BrandChip } from "@/components/BrandMark";
import { normalizeGrade } from "@/lib/grade";

export const dynamic = "force-dynamic";

// Public, no-auth storefront for a single shop — everything they have live.
// Reachable from any listing's shop name in Browse, and shareable as a link.

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  try {
    const db = supabaseAdmin();
    const { data: shop } = await db.from("shops").select("name, location").eq("id", id).single();
    if (shop) return { title: `${shop.name} · Ahlam`, description: `Used parts & vehicles from ${shop.name}${shop.location ? ` in ${shop.location}` : ""}.` };
  } catch {}
  return { title: "Shop · Ahlam" };
}

function fmtFit(fit: any): string {
  if (!fit) return "";
  if (typeof fit === "string") return fit;
  if (Array.isArray(fit)) {
    return fit.map((f: any) => {
      if (typeof f === "string") return f;
      const yr = f.yearStart && f.yearEnd && f.yearStart !== f.yearEnd ? `${f.yearStart}–${f.yearEnd}` : (f.yearStart || "");
      return [yr, f.make, f.model].filter(Boolean).join(" ").trim();
    }).filter(Boolean).join(", ");
  }
  return "";
}

export default async function ShopStorefront({ params }: Params) {
  const { id } = await params;
  let shop: any = null;
  let listingRows: any[] = [];
  let vehicleRows: any[] = [];
  try {
    const db = supabaseAdmin();
    const res = await db.from("shops").select("*").eq("id", id).single();
    shop = res.data;
    if (shop) {
      const [l, v] = await Promise.all([
        db.from("listings").select("*").eq("shop_id", id).eq("status", "active").order("created_at", { ascending: false }),
        db.from("vehicles").select("*").eq("shop_id", id).in("sell_mode", ["whole", "both"]).eq("status", "active").order("created_at", { ascending: false }),
      ]);
      listingRows = l.data || [];
      vehicleRows = (v.data || []).filter((x: any) => x.status === "active");
    }
  } catch {
    // fall through to notFound below if shop never loaded
  }
  if (!shop) notFound();

  const parts = listingRows.map((l: any) => {
    const c = l.corrected || l.ai_output || {};
    return {
      id: l.id,
      part: c.partName || c.part_name || "Used Part",
      grade: normalizeGrade(c.condition),
      price: l.price_usd ?? c.suggestedPriceUsd ?? 0,
      fitment: fmtFit(c.fitment),
      category: c.partCategory || c.part_category || "",
    };
  });
  const vehicles = vehicleRows.map((v: any) => ({
    id: v.id, year: v.year, make: v.make, model: v.model, trim: v.trim || "",
    body: v.body || "", color: v.color || "", sellMode: v.sell_mode || "whole", askingPrice: v.asking_price,
  }));

  const initials = (shop.name || "S").split(" ").map((s: string) => s[0]).join("").toUpperCase().slice(0, 2);
  const count = parts.length + vehicles.length;

  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      {/* Header / cover */}
      <div className="grain" style={{ borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--muted)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}><BrandChip size={24} /> Ahlam</Link>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 18, flexWrap: "wrap" }}>
            {shop.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logo_url} alt={shop.name} style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover", border: "1px solid var(--line)" }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: 16, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 26, fontWeight: 800 }}>{initials}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{shop.name}</h1>
              <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
                {shop.location && <span>📍 {shop.location}</span>}
                <span>{count} active listing{count === 1 ? "" : "s"}</span>
                {shop.website && <a href={shop.website} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>Website ↗</a>}
              </div>
            </div>
          </div>
          {shop.description && <p style={{ margin: "18px 0 0", maxWidth: 720, color: "var(--foreground)", fontSize: 14.5, lineHeight: 1.6, opacity: 0.9 }}>{shop.description}</p>}
          {(shop.business_phone || shop.email || shop.hours) && (
            <div style={{ display: "flex", gap: 22, marginTop: 16, flexWrap: "wrap", fontSize: 13, color: "var(--muted)" }}>
              {shop.business_phone && <span>☎ {shop.business_phone}</span>}
              {shop.email && <span>✉ {shop.email}</span>}
              {shop.hours && <span>🕑 {shop.hours}</span>}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 24px 60px" }}>
        {count === 0 && (
          <div style={{ padding: 60, textAlign: "center", color: "var(--muted)", border: "1px dashed var(--line)", borderRadius: 16 }}>
            This shop has no active listings right now.
          </div>
        )}

        {vehicles.length > 0 && (
          <>
            <h2 style={sectionH}>Vehicles ({vehicles.length})</h2>
            <div style={grid}>
              {vehicles.map((v) => (
                <div key={v.id} style={card}>
                  <div className="photo-cell" style={{ height: 150, borderRadius: 0 }} />
                  <div style={{ padding: 14 }}>
                    {v.askingPrice ? <div style={{ fontSize: 19, fontWeight: 800 }}>${Number(v.askingPrice).toLocaleString()}</div> : <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>Parting out</div>}
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{v.year} {v.make} {v.model} {v.trim}</div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{[v.body, v.color].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {parts.length > 0 && (
          <>
            <h2 style={sectionH}>Parts ({parts.length})</h2>
            <div style={grid}>
              {parts.map((p) => (
                <div key={p.id} style={card}>
                  <div className="photo-cell" style={{ height: 140, borderRadius: 0 }} />
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--success)" }}>${p.price}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>{p.part}</div>
                    {p.fitment && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Fits {p.fitment}</div>}
                    {p.category && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{p.category}</div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 40, padding: 20, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)", textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Want to message this seller or list your own inventory?</div>
          <Link href="/" style={{ display: "inline-flex", marginTop: 12, padding: "10px 20px", borderRadius: 11, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>Open Ahlam</Link>
        </div>
      </div>
    </main>
  );
}

const sectionH: React.CSSProperties = { fontSize: 15, fontWeight: 700, margin: "26px 0 14px" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 };
const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden" };
