"use client";
// Lightweight EN/ES UI translation. English strings double as keys, so wrapping
// existing copy in t("…") is enough — no rekeying. Listings/content stay English;
// this only translates the app's own chrome. Choice persists in localStorage.
import React from "react";

export type Lang = "en" | "es";

// English → Spanish for the app's UI chrome. Anything missing falls back to the
// English key, so partial coverage degrades gracefully.
const ES: Record<string, string> = {
  // Sidebar sections + nav
  "Marketplace": "Mercado",
  "My shop": "Mi taller",
  "Assist": "Asistencia",
  "Overview": "Resumen",
  "Browse market": "Explorar mercado",
  "Vehicles posted": "Vehículos publicados",
  "Parts posted": "Piezas publicadas",
  "Add vehicle / parts": "Añadir vehículo / piezas",
  "Interchange": "Intercambio",
  "Analytics": "Analíticas",
  "AI assistant": "Asistente IA",
  "Export & posting": "Exportar y publicar",
  "Messages": "Mensajes",
  "Sign out": "Cerrar sesión",
  "Owner": "Propietario",
  "members": "miembros",
  // Page subtitles
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
  // Account menu
  "Account settings": "Configuración de cuenta",
  "Shop profile": "Perfil del taller",
  "Team & roles": "Equipo y roles",
  "Billing": "Facturación",
  "Notifications": "Notificaciones",
  // Common
  "Language": "Idioma",
  "Dark mode": "Modo oscuro",
  "Light mode": "Modo claro",
  "Save changes": "Guardar cambios",
  "Message seller": "Mensaje al vendedor",
  "Good": "Bueno",
  "Poor": "Malo",
};

const DICT: Record<Lang, Record<string, string>> = { en: {}, es: ES };

interface I18nCtx { lang: Lang; setLang: (l: Lang) => void; t: (s: string) => string }
const Ctx = React.createContext<I18nCtx>({ lang: "en", setLang: () => {}, t: (s) => s });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>("en");

  React.useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("cs-lang")) as Lang | null;
    if (saved === "es" || saved === "en") setLangState(saved);
  }, []);

  const setLang = React.useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("cs-lang", l); } catch {}
  }, []);

  const t = React.useCallback((s: string) => DICT[lang][s] ?? s, [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() { return React.useContext(Ctx); }
export function useT() { return React.useContext(Ctx).t; }
