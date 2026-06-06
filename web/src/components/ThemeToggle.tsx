"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

// Light/dark switch. Reads + writes the same `data-theme` attribute and
// `cs-theme` localStorage key used everywhere, so all toggles stay in sync.
export function ThemeToggle({ size = 38 }: { size?: number }) {
  const [light, setLight] = useState(false);
  useEffect(() => { setLight(document.documentElement.getAttribute("data-theme") === "light"); }, []);
  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.setAttribute("data-theme", next ? "light" : "dark");
    try { localStorage.setItem("cs-theme", next ? "light" : "dark"); } catch {}
  }
  return (
    <button
      onClick={toggle}
      className="cs-icon-btn"
      title={light ? "Switch to dark mode" : "Switch to light mode"}
      aria-label="Toggle light or dark mode"
      style={{ width: size, height: size, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0, cursor: "pointer" }}
    >
      {light ? <Moon size={18} color="var(--muted)" /> : <Sun size={18} color="var(--muted)" />}
    </button>
  );
}
