import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand palette wired to CSS variables so utility classes
        // (bg-background, text-foreground, …) follow the active theme.
        // Tokens are defined in globals.css for dark + [data-theme="light"].
        background: "var(--background)",
        surface: "var(--surface)",
        surface2: "var(--surface2)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        line: "var(--line)",
        accent: "var(--accent)",
        accenthover: "var(--accent-hover)",
        signal: "var(--signal)",
        "signal-bg": "var(--signal-bg)",
        caution: "var(--caution)",
        success: "var(--success)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
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
