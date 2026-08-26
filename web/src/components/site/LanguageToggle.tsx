"use client";

import { useI18n } from "@/lib/i18n";

// EN/ES switch for the Ultimate personal sites — same mechanism as the
// ahlam.io dashboard toggle, so Spanish-speaking customers can read a shop's
// site (including its live inventory) translated on the fly.
export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <span title="Language" style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 9, overflow: "hidden", flexShrink: 0 }}>
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-label={l === "en" ? "English" : "Español"}
          style={{ padding: "6px 10px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: lang === l ? "var(--accent)" : "transparent", color: lang === l ? "#fff" : "var(--muted)" }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </span>
  );
}
