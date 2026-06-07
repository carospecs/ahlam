// Turn a shop's ZIP / location text into lat/lng so the marketplace can sort by
// distance ("Recommended = nearest"). Uses free, key-less services and never
// throws — returns null if it can't resolve, so saving a shop still succeeds.

export async function geocode(opts: { zip?: string | null; location?: string | null }): Promise<{ lat: number; lng: number } | null> {
  const zip = (opts.zip || "").trim();

  // 1) US ZIP via Zippopotam (most reliable, no key).
  if (/^\d{5}$/.test(zip)) {
    try {
      const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (r.ok) {
        const d = await r.json();
        const p = d.places?.[0];
        if (p) return { lat: parseFloat(p.latitude), lng: parseFloat(p.longitude) };
      }
    } catch { /* fall through */ }
  }

  // 2) Free-text location (e.g. "Long Beach, CA") via OpenStreetMap Nominatim.
  const q = (opts.location || "").trim() || zip;
  if (q) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`, {
        headers: { "User-Agent": "ahlam-marketplace/1.0 (shop geocoding)" },
      });
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d) && d[0]) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
      }
    } catch { /* fall through */ }
  }
  return null;
}
