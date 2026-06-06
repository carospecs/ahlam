// Ahlam brand mark — the tachometer: an open "C" gauge with a redline needle.
// `color` sets the C stroke (needle + hub stay redline). No "use client" needed —
// it's a pure SVG, usable from server and client components alike.
export function BrandMark({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M81.4 39.8 A33 33 0 1 1 43.1 17.7" stroke={color} strokeWidth={9} strokeLinecap="round" />
      <line x1="50" y1="50" x2="66.2" y2="26" stroke="#DC2626" strokeWidth={6.5} strokeLinecap="round" />
      <circle cx="50" cy="50" r="4" fill="#DC2626" />
    </svg>
  );
}

// The mark inside the standard midnight "chip" used in nav/brand lockups —
// sand C on a dark tile so it reads in both light and dark themes.
export function BrandChip({ size = 34 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.29, background: "#0F172A", display: "grid", placeItems: "center", flexShrink: 0 }}>
      <BrandMark size={Math.round(size * 0.66)} color="#D0B98B" />
    </span>
  );
}
