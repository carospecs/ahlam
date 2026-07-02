"use client";
// EN/ES UI language layer.
//
// The app is authored in English and EVERYTHING is stored/posted in English.
// Spanish is a pure DISPLAY layer: when the user picks ES we translate every
// visible string on the fly via /api/translate (Groq), cache the result in
// localStorage, and keep watching the DOM so new/dynamic content translates too.
// A curated dictionary seeds the cache for instant, high-quality common strings.
import React from "react";

export type Lang = "en" | "es";

// Curated seeds — instant + high quality. The rest is filled by the API.
const SEED: Record<string, string> = {
  "Marketplace": "Mercado", "My shop": "Mi taller", "Assist": "Asistencia",
  "Sell": "Vender", "Business": "Negocio", "Discover": "Descubrir", "Library": "Biblioteca",
  "New scan": "Nuevo escaneo", "Orders": "Pedidos", "Yard": "Patio", "Gallery": "Galería", "Files": "Archivos",
  "Overview": "Resumen", "Browse market": "Explorar mercado", "Vehicles posted": "Vehículos publicados",
  "Parts posted": "Piezas publicadas", "Add vehicle / parts": "Añadir vehículo / piezas",
  "Interchange": "Intercambio", "Analytics": "Analíticas", "AI assistant": "Asistente IA",
  "Export & posting": "Exportar y publicar", "Messages": "Mensajes", "Sign out": "Cerrar sesión",
  "Language": "Idioma", "Dark mode": "Modo oscuro", "Light mode": "Modo claro",
  "Your shop at a glance": "Tu taller de un vistazo",
  "Good": "Bueno", "Poor": "Malo", "Draft": "Borrador", "Posted": "Publicado", "Sold": "Vendido",
};

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT", "CODE", "PRE"]);
const CACHE_KEY = "cs-i18n-es";
const MAX_CACHE = 6000;

// en → es. Seeded, grown by the API, persisted to localStorage.
let cache: Record<string, string> = { ...SEED };
let inverse: Record<string, string> = {};
function rebuildInverse() { inverse = {}; for (const k in cache) inverse[cache[k]] = k; }
rebuildInverse();

function loadCache() {
  try {
    const raw = typeof localStorage !== "undefined" && localStorage.getItem(CACHE_KEY);
    if (raw) { cache = { ...SEED, ...JSON.parse(raw) }; rebuildInverse(); }
  } catch {}
}
function saveCache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

// Worth translating? Has real letters, isn't an email/url/pure-number, and we
// don't already know it (as a source or an existing translation).
function translatable(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 600) return false;
  if (!/[a-zA-Z]{2,}/.test(t)) return false;
  if (/^[\w.+-]+@[\w.-]+\.\w+$/.test(t)) return false;        // email
  if (/^https?:\/\//.test(t) || /^www\./.test(t)) return false; // url
  if (cache[t] || inverse[t]) return false;                    // known
  return true;
}

const pending = new Set<string>();
let flushTimer: any = null;
let onApplied: (() => void) | null = null;

function queue(s: string) {
  const t = s.trim();
  if (translatable(t)) pending.add(t);
}

async function flush() {
  if (!pending.size) return;
  const batch = Array.from(pending).slice(0, 60);
  batch.forEach((s) => pending.delete(s));
  try {
    const res = await fetch("/api/translate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: batch }),
    });
    const d = await res.json();
    if (d.ok && Array.isArray(d.translations)) {
      batch.forEach((en, i) => { const es = d.translations[i]; if (es && es !== en) cache[en] = es; });
      if (Object.keys(cache).length < MAX_CACHE) saveCache();
      rebuildInverse();
      onApplied?.();
    }
  } catch {}
  if (pending.size) scheduleFlush();
}
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; flush(); }, 250);
}

function swapText(map: Record<string, string>, root: Node, collect: boolean) {
  if (typeof document === "undefined") return;
  const start = root.nodeType === Node.TEXT_NODE ? (root.parentNode || root) : root;
  const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = (n as Text).parentElement;
      if (!p || SKIP_TAGS.has(p.tagName) || p.isContentEditable || p.closest("[data-no-i18n]")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  if (root.nodeType === Node.TEXT_NODE) {
    const p = (root as Text).parentElement;
    if (p && !SKIP_TAGS.has(p.tagName) && !p.isContentEditable && !p.closest("[data-no-i18n]")) nodes.push(root as Text);
  } else { let c: Node | null; while ((c = walker.nextNode())) nodes.push(c as Text); }
  for (const t of nodes) {
    const raw = t.nodeValue; if (!raw) continue;
    const key = raw.trim(); if (!key) continue;
    const hit = map[key];
    if (hit && hit !== key) t.nodeValue = raw.replace(key, hit);
    else if (collect) queue(key);
  }
}

function swapAttrs(map: Record<string, string>, root: ParentNode, collect: boolean) {
  if (typeof document === "undefined") return;
  const els = (root as Element).querySelectorAll?.("[placeholder],[aria-label],[title]") || [];
  els.forEach((el) => {
    for (const attr of ["placeholder", "aria-label", "title"]) {
      const v = el.getAttribute(attr); if (!v) continue;
      const key = v.trim();
      if (map[key]) el.setAttribute(attr, map[key]);
      else if (collect) queue(key);
    }
  });
}

let observer: MutationObserver | null = null;

function applyAll() {
  swapText(cache, document.body, false);
  swapAttrs(cache, document.body, false);
}

function startTranslating() {
  if (typeof document === "undefined") return;
  onApplied = applyAll;
  swapText(cache, document.body, true);     // apply known + collect unknown
  swapAttrs(cache, document.body, true);
  scheduleFlush();
  if (observer) return;
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData" && m.target.nodeType === Node.TEXT_NODE) swapText(cache, m.target, true);
      else m.addedNodes.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) swapText(cache, n, true);
        else if (n.nodeType === Node.ELEMENT_NODE) { swapText(cache, n, true); swapAttrs(cache, n as Element, true); }
      });
    }
    scheduleFlush();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function stopTranslating() {
  onApplied = null;
  if (observer) { observer.disconnect(); observer = null; }
  if (typeof document !== "undefined") { swapText(inverse, document.body, false); swapAttrs(inverse, document.body, false); }
}

interface I18nCtx { lang: Lang; setLang: (l: Lang) => void; t: (s: string) => string }
const Ctx = React.createContext<I18nCtx>({ lang: "en", setLang: () => {}, t: (s) => s });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>("en");

  React.useEffect(() => {
    loadCache();
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("cs-lang")) as Lang | null;
    if (saved === "es") setLangState("es");
  }, []);

  React.useEffect(() => {
    if (lang === "es") startTranslating(); else stopTranslating();
    return () => { if (observer) { observer.disconnect(); observer = null; } };
  }, [lang]);

  const setLang = React.useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("cs-lang", l); } catch {}
  }, []);

  const t = React.useCallback((s: string) => (lang === "es" ? cache[s] ?? s : s), [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() { return React.useContext(Ctx); }
export function useT() { return React.useContext(Ctx).t; }
