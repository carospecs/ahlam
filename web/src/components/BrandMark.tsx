// Ahlam brand mark — "The Aperture": a six-point compass star in gold facets with
// a red camera-iris center. Pure SVG (no "use client"): usable from server and
// client components alike. Colors default to the brand palette but are overridable
// for monochrome lockups on coloured grounds.
export function BrandMark({
  size = 24,
  gold = "#D8BD8E",
  goldDark = "#C49A5E",
  ring = "#D3B484",
  iris = "#D8392E",
}: { size?: number; gold?: string; goldDark?: string; ring?: string; iris?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="none" stroke={ring} strokeWidth="2" />
      <path d="M32 6 L54.52 19 L32 23 Z" fill={gold} />
      <path d="M54.52 19 L54.52 45 L39.79 27.5 Z" fill={goldDark} />
      <path d="M54.52 45 L32 58 L39.79 36.5 Z" fill={gold} />
      <path d="M32 58 L9.48 45 L32 41 Z" fill={goldDark} />
      <path d="M9.48 45 L9.48 19 L24.21 36.5 Z" fill={gold} />
      <path d="M9.48 19 L32 6 L24.21 27.5 Z" fill={goldDark} />
      <circle cx="32" cy="32" r="7.6" fill="none" stroke={iris} strokeWidth="2.4" />
    </svg>
  );
}

// The mark inside the standard midnight badge ("Badge · Primary") — gold aperture
// on midnight navy, reads in both light and dark themes.
export function BrandChip({ size = 34 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.29, background: "#101A2C", display: "grid", placeItems: "center", flexShrink: 0 }}>
      <BrandMark size={Math.round(size * 0.74)} />
    </span>
  );
}
