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

// Theme-aware brand chip. Dark theme: the gold aperture on the midnight badge
// ("Badge · Primary"). Light theme: the flat "ink" mark — navy aperture, no badge
// box ("Flat · Ink") — which reads cleanly on a light ground. Only one renders at
// a time, toggled by CSS on :root[data-theme="light"] (see globals.css), so it's
// still a pure server/client component with no theme flash.
// Small "BETA" pill shown beside the wordmark while the product is in development.
// Mirrors the grade/accent pill styling used elsewhere (uppercase, rounded, accent
// tint) so it reads as part of the brand, not a banner. Size scales the type.
export function BetaBadge({ size = 10 }: { size?: number }) {
  return (
    <span
      style={{
        fontSize: size,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        lineHeight: 1,
        padding: `${size * 0.32}px ${size * 0.66}px`,
        borderRadius: 999,
        color: "var(--accent)",
        background: "color-mix(in srgb, var(--accent) 14%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
      aria-label="Beta — product in development"
      title="Ahlam is in beta — still in active development"
    >
      Beta
    </span>
  );
}

export function BrandChip({ size = 34 }: { size?: number }) {
  return (
    <span className="brand-chip" style={{ width: size, height: size, flexShrink: 0, display: "inline-grid", placeItems: "center" }}>
      <span className="brand-chip__dark" style={{ width: size, height: size, borderRadius: size * 0.29, background: "#101A2C", placeItems: "center" }}>
        <BrandMark size={Math.round(size * 0.74)} />
      </span>
      <span className="brand-chip__light" style={{ width: size, height: size, placeItems: "center" }}>
        <BrandMark size={size} gold="#101A2C" goldDark="#1E2A40" ring="#101A2C" iris="#D8392E" />
      </span>
    </span>
  );
}
