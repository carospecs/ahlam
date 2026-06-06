"use client";
// EN/ES UI translation.
//
// Strategy: the app is authored in English. When the user picks Spanish we
// auto-translate the rendered UI by swapping any text/placeholder/label whose
// value EXACTLY matches an entry in the dictionary below. Because seller content
// and AI output are never dictionary entries, they stay English automatically —
// which is exactly the rule: the site shows in Spanish, but everything posted
// stays in English. Switching back to English reverts via the inverse map.
import React from "react";

export type Lang = "en" | "es";

// English → Spanish for the app's UI chrome. Add phrases here to extend coverage.
const ES: Record<string, string> = {
  // Sidebar / nav
  "Marketplace": "Mercado", "My shop": "Mi taller", "Assist": "Asistencia",
  "Overview": "Resumen", "Browse market": "Explorar mercado", "Vehicles posted": "Vehículos publicados",
  "Parts posted": "Piezas publicadas", "Add vehicle / parts": "Añadir vehículo / piezas",
  "Interchange": "Intercambio", "Analytics": "Analíticas", "AI assistant": "Asistente IA",
  "Export & posting": "Exportar y publicar", "Messages": "Mensajes", "Sign out": "Cerrar sesión",
  "Owner": "Propietario", "members": "miembros", "Language": "Idioma",
  "Dark mode": "Modo oscuro", "Light mode": "Modo claro",
  "Account settings": "Configuración de cuenta", "Shop profile": "Perfil del taller",
  "Team & roles": "Equipo y roles", "Billing": "Facturación", "Notifications": "Notificaciones",
  // Page titles / subs
  "Your shop at a glance": "Tu taller de un vistazo",
  "Cars and parts other shops have listed near you": "Autos y piezas que otros talleres publicaron cerca de ti",
  "Your cars — drafts, parting out, whole, or both": "Tus autos — borradores, despiece, completo o ambos",
  "Your parts — drafts, posted, and sold": "Tus piezas — borradores, publicadas y vendidas",
  "Add a vehicle": "Añadir un vehículo",
  "Snap or upload up to 8 photos + VIN — AI does the rest": "Toma o sube hasta 8 fotos + VIN — la IA hace el resto",
  "Views, inquiries, and sales at a glance": "Vistas, consultas y ventas de un vistazo",
  "Ask about pricing, fitment, and listings": "Pregunta sobre precios, compatibilidad y publicaciones",
  "Cross-post your listings to Facebook, OfferUp, eBay & more": "Publica tus anuncios en Facebook, OfferUp, eBay y más",
  "Buyer inquiries from your listings": "Consultas de compradores de tus anuncios",
  "Parts interchange": "Intercambio de piezas",
  "Hollander-style cross-reference — search by VIN or part name": "Referencia cruzada estilo Hollander — busca por VIN o nombre de pieza",
  // Common buttons / actions
  "Save changes": "Guardar cambios", "Save as draft": "Guardar como borrador",
  "Message seller": "Mensaje al vendedor", "Add a part": "Añadir una pieza",
  "Run AI analysis": "Ejecutar análisis IA", "Edit photos": "Editar fotos",
  "Take photo": "Tomar foto", "Upload photos": "Subir fotos", "Add photos": "Añadir fotos",
  "Scan photo to fill": "Escanear foto para rellenar", "Write with AI": "Redactar con IA",
  "Post car": "Publicar auto", "Post part": "Publicar pieza", "Back": "Atrás",
  "Back to options": "Volver a las opciones", "Decode": "Decodificar", "Reset": "Restablecer",
  "Find interchange": "Buscar intercambio", "Connect eBay": "Conectar eBay",
  "List on eBay": "Publicar en eBay", "Reconnect": "Reconectar", "Cancel": "Cancelar",
  "Save": "Guardar", "Edit": "Editar", "Delete": "Eliminar", "Close": "Cerrar",
  "Copy": "Copiar", "Download": "Descargar", "Send": "Enviar", "Search": "Buscar",
  // Statuses / grades / modes
  "Draft": "Borrador", "Posted": "Publicado", "Sold": "Vendido", "Active": "Activo",
  "Good": "Bueno", "Poor": "Malo", "Parts only": "Solo piezas", "Whole car": "Auto completo",
  "Both": "Ambos", "Parting out": "Despiece", "optional": "opcional", "Open": "Abierto",
  // Filters / sorting
  "Parts": "Piezas", "Vehicles": "Vehículos", "Grade": "Grado", "Category": "Categoría",
  "Category: All": "Categoría: Todas", "Sort: Nearest": "Orden: Más cercano",
  "results": "resultados", "matches": "coincidencias", "views": "vistas",
  "Filter": "Filtro", "All parts": "Todas las piezas", "By car": "Por auto",
  // How-to-add picker + manual
  "How do you want to add this?": "¿Cómo quieres añadir esto?",
  "Let AI do it from photos, or enter a car or part yourself.": "Deja que la IA lo haga desde fotos, o ingresa un auto o pieza tú mismo.",
  "Scan with AI": "Escanear con IA", "List a car manually": "Publicar un auto manualmente",
  "List a part manually": "Publicar una pieza manualmente", "FASTEST": "MÁS RÁPIDO",
  "Listing details": "Detalles de la publicación", "Title": "Título", "Description": "Descripción",
  "Price": "Precio", "Condition": "Condición", "Vehicle": "Vehículo", "Year": "Año",
  "Make": "Marca", "Model": "Modelo", "Mileage": "Kilometraje", "Photos · optional": "Fotos · opcional",
  // Interchange page
  "Not in our shop right now — sorry about that.": "No está en nuestro taller ahora mismo — lo sentimos.",
  "Fits these vehicles": "Compatible con estos vehículos", "OEM part numbers": "Números de pieza OEM",
  "Aftermarket equivalents": "Equivalentes del mercado de repuestos", "Verify before swapping": "Verifica antes de cambiar",
  // Empty states / misc
  "Scanning your car…": "Escaneando tu auto…", "Connected": "Conectado",
  "person has viewed this": "persona ha visto esto", "people have viewed this": "personas han visto esto",
};

// Inverse for reverting ES → EN.
const ES_TO_EN: Record<string, string> = Object.fromEntries(Object.entries(ES).map(([en, es]) => [es, en]));

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT", "CODE", "PRE"]);

function swapText(map: Record<string, string>, root: Node) {
  if (typeof document === "undefined") return;
  const walker = document.createTreeWalker(root.nodeType === Node.TEXT_NODE ? root.parentNode || root : root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = (n as Text).parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(p.tagName) || p.isContentEditable) return NodeFilter.FILTER_REJECT;
      if (p.closest("[data-no-i18n]")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  if ((root as Node).nodeType === Node.TEXT_NODE) {
    const p = (root as Text).parentElement;
    if (p && !SKIP_TAGS.has(p.tagName) && !p.isContentEditable && !p.closest("[data-no-i18n]")) nodes.push(root as Text);
  } else { let cur: Node | null; while ((cur = walker.nextNode())) nodes.push(cur as Text); }
  for (const t of nodes) {
    const raw = t.nodeValue;
    if (!raw) continue;
    const key = raw.trim();
    const hit = map[key];
    if (hit && hit !== key) t.nodeValue = raw.replace(key, hit);
  }
}

function swapAttrs(map: Record<string, string>, root: ParentNode) {
  if (typeof document === "undefined") return;
  const els = (root as Element).querySelectorAll?.("[placeholder],[aria-label],[title]") || [];
  els.forEach((el) => {
    for (const attr of ["placeholder", "aria-label", "title"]) {
      const v = el.getAttribute(attr);
      if (v && map[v.trim()]) el.setAttribute(attr, map[v.trim()]);
    }
  });
}

let observer: MutationObserver | null = null;

function startTranslating() {
  if (typeof document === "undefined") return;
  swapText(ES, document.body);
  swapAttrs(ES, document.body);
  if (observer) return;
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData" && m.target.nodeType === Node.TEXT_NODE) swapText(ES, m.target);
      else m.addedNodes.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) swapText(ES, n);
        else if (n.nodeType === Node.ELEMENT_NODE) { swapText(ES, n); swapAttrs(ES, n as Element); }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function stopTranslating() {
  if (observer) { observer.disconnect(); observer = null; }
  if (typeof document !== "undefined") { swapText(ES_TO_EN, document.body); swapAttrs(ES_TO_EN, document.body); }
}

interface I18nCtx { lang: Lang; setLang: (l: Lang) => void; t: (s: string) => string }
const Ctx = React.createContext<I18nCtx>({ lang: "en", setLang: () => {}, t: (s) => s });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>("en");

  React.useEffect(() => {
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

  const t = React.useCallback((s: string) => (lang === "es" ? ES[s] ?? s : s), [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() { return React.useContext(Ctx); }
export function useT() { return React.useContext(Ctx).t; }
