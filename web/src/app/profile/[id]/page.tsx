import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { PublicHeader } from "@/components/PublicHeader";
import { normalizeGrade } from "@/lib/grade";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  try {
    const db = supabaseAdmin();
    const { data: p } = await db.from("profiles").select("display_name").eq("id", id).single();
    if (p) return { title: `${p.display_name} · Ahlam`, description: `Listings by ${p.display_name} on Ahlam.` };
  } catch {}
  return { title: "Profile · Ahlam" };
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

function timeAgo(t: string | null): string {
  if (!t) return "";
  const d = new Date(t);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export default async function ProfilePage({ params }: Params) {
  const { id } = await params;
  let profile: any = null;
  let listingRows: any[] = [];
  try {
    const db = supabaseAdmin();
    const { data: p } = await db.from("profiles").select("*").eq("id", id).single();
    profile = p;
    if (profile) {
      const { data: l } = await db
        .from("listings")
        .select("*, shops(name, location)")
        .or(`seller_id.eq.${id},created_by.eq.${id}`)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      listingRows = l || [];
    }
  } catch {
    // fall through
  }
  if (!profile) notFound();

  const name = profile.display_name || "Ahlam User";
  const initials = name.split(" ").map((s: string) => s[0]).join("").toUpperCase().slice(0, 2);

  const parts = listingRows.map((l: any) => {
    const c = l.corrected || l.ai_output || {};
    return {
      id: l.id,
      part: c.partName || c.part_name || "Used Part",
      grade: normalizeGrade(c.condition),
      price: l.price_usd ?? c.suggestedPriceUsd ?? 0,
      fitment: fmtFit(c.fitment),
      category: c.partCategory || c.part_category || "",
      shopName: l.shops?.name || "Independent seller",
    };
  });

  const online = profile.is_online;
  const lastSeen = profile.last_seen;

  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <PublicHeader />
      <div className="grain" style={{ borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={name} style={{ width: 72, height: 72, borderRadius: 999, objectFit: "cover", border: "1px solid var(--line)" }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: 999, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 26, fontWeight: 800 }}>{initials}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{name}</h1>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: online ? "var(--success)" : "var(--muted)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: online ? "var(--success)" : "var(--line)", display: "inline-block" }} />
                  {online ? "Online" : lastSeen ? `Offline · ${timeAgo(lastSeen)}` : "Offline"}
                </span>
              </div>
              {profile.bio && <p style={{ margin: "8px 0 0", maxWidth: 600, color: "var(--muted)", fontSize: 14, lineHeight: 1.5 }}>{profile.bio}</p>}
              <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
                {parts.length} listing{parts.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 24px 60px" }}>
        {parts.length === 0 && (
          <div style={{ padding: 60, textAlign: "center", color: "var(--muted)", border: "1px dashed var(--line)", borderRadius: 16 }}>
            This user has no active listings right now.
          </div>
        )}

        {parts.length > 0 && (
          <>
            <h2 style={sectionH}>Listings ({parts.length})</h2>
            <div style={grid}>
              {parts.map((p) => (
                <div key={p.id} style={card}>
                  <div className="photo-cell" style={{ height: 140, borderRadius: 0 }} />
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--success)" }}>${p.price}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>{p.part}</div>
                    {p.fitment && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Fits {p.fitment}</div>}
                    {p.shopName && <div style={{ fontSize: 11.5, color: "var(--accent)", marginTop: 2 }}>{p.shopName}</div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const sectionH: React.CSSProperties = { fontSize: 15, fontWeight: 700, margin: "26px 0 14px" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 };
const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden" };
