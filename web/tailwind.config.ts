import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Automotive dark palette (see docs/DESIGN_SYSTEM.md)
        background: "#0F172A",
        surface: "#1B2336",
        surface2: "#272F42",
        foreground: "#F8FAFC",
        muted: "#94A3B8",
        line: "#334155",
        accent: "#DC2626",
        accenthover: "#B91C1C",
        signal: "#F59E0B",
        "signal-bg": "rgba(245, 158, 11, 0.12)",
        caution: "#F59E0B",
        success: "#22C55E",
        danger: "#EF4444",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
