"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Camera, Tag, Send, MessageSquare, PlayCircle } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { Reveal, RevealStagger, RevealItem } from "@/components/Reveal";

// How-to hub. Hosts the English and Spanish walkthrough videos plus a written
// step-by-step so a brand new seller can learn Ahlam in a few minutes. The video
// slots read from VIDEOS below: drop in the YouTube/Mux/Vercel Blob URL per
// language and the embed appears; until then a friendly placeholder shows.
//
// Copy rule: no em dashes in any user-facing string.

type Lang = "en" | "es";

// Set these to the published video URLs (YouTube embed, Mux, or Blob mp4) once
// the EN/ES tutorials are produced. Leave null to show the "coming soon" slot.
const VIDEOS: Record<Lang, string | null> = {
  en: null,
  es: null,
};

const COPY: Record<Lang, {
  eyebrow: string;
  title: string;
  titleAccent: string;
  sub: string;
  watch: string;
  comingSoon: string;
  comingSoonNote: string;
  stepsHeading: string;
  steps: { icon: React.ComponentType<{ size?: number }>; title: string; body: string }[];
  ctaTitle: string;
  ctaSub: string;
  ctaBtn: string;
}> = {
  en: {
    eyebrow: "How it works",
    title: "Learn Ahlam in",
    titleAccent: "five minutes",
    sub: "Watch the full walkthrough, then follow the four steps below. From a photo to a live listing on every marketplace you sell on.",
    watch: "Watch the walkthrough",
    comingSoon: "Walkthrough video coming soon",
    comingSoonNote: "We are filming it now. In the meantime, the steps below cover the whole flow.",
    stepsHeading: "The four steps",
    steps: [
      { icon: Camera, title: "1. Photograph the part", body: "Snap the part or the whole car. Ahlam identifies it, reads the VIN if it can see one, and grades the condition." },
      { icon: Tag, title: "2. Review the price", body: "Ahlam suggests a price from live eBay comps and condition. Adjust if you want, then approve." },
      { icon: Send, title: "3. Post everywhere", body: "Publish to eBay in one click. Prefill Facebook, OfferUp, and Craigslist in your own browser, then hit Post." },
      { icon: MessageSquare, title: "4. Reply to buyers", body: "Buyer messages reach you by email and in the app. Answer fast and close the sale." },
    ],
    ctaTitle: "Ready to list your first part?",
    ctaSub: "It takes about a minute from photo to live listing.",
    ctaBtn: "Get started",
  },
  es: {
    eyebrow: "Como funciona",
    title: "Aprende Ahlam en",
    titleAccent: "cinco minutos",
    sub: "Mira el recorrido completo y luego sigue los cuatro pasos. De una foto a una publicacion activa en cada mercado donde vendes.",
    watch: "Mira el recorrido",
    comingSoon: "Video del recorrido proximamente",
    comingSoonNote: "Lo estamos grabando ahora. Mientras tanto, los pasos de abajo cubren todo el proceso.",
    stepsHeading: "Los cuatro pasos",
    steps: [
      { icon: Camera, title: "1. Fotografia la pieza", body: "Toma una foto de la pieza o del carro completo. Ahlam la identifica, lee el VIN si lo ve, y califica la condicion." },
      { icon: Tag, title: "2. Revisa el precio", body: "Ahlam sugiere un precio segun ventas reales de eBay y la condicion. Ajustalo si quieres y aprueba." },
      { icon: Send, title: "3. Publica en todos lados", body: "Publica en eBay con un clic. Llena Facebook, OfferUp y Craigslist en tu propio navegador y presiona Publicar." },
      { icon: MessageSquare, title: "4. Responde a compradores", body: "Los mensajes te llegan por correo y en la app. Responde rapido y cierra la venta." },
    ],
    ctaTitle: "Listo para publicar tu primera pieza?",
    ctaSub: "Toma alrededor de un minuto de la foto a la publicacion.",
    ctaBtn: "Comenzar",
  },
};

export default function GuidancePage() {
  const [lang, setLang] = React.useState<Lang>("en");
  const t = COPY[lang];
  const video = VIDEOS[lang];

  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", position: "relative" }}>
      <div className="aurora" aria-hidden="true">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <PublicHeader />

        {/* Hero + language toggle */}
        <section style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 24px 40px" }}>
            <Reveal>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div className="cs-eyebrow">{t.eyebrow}</div>
                  <h1 className="cs-display" style={{ margin: "10px 0 12px", fontSize: "clamp(38px, 5vw, 52px)", fontWeight: 600, letterSpacing: "-0.02em" }}>
                    {t.title} <span style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 500 }}>{t.titleAccent}</span>.
                  </h1>
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: 16.5, lineHeight: 1.6, maxWidth: 580 }}>{t.sub}</p>
                </div>
                <div role="tablist" aria-label="Language" style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 999, border: "1px solid var(--line)", background: "var(--card)" }}>
                  {(["en", "es"] as Lang[]).map((l) => (
                    <button
                      key={l}
                      role="tab"
                      aria-selected={lang === l}
                      onClick={() => setLang(l)}
                      style={{
                        padding: "7px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
                        background: lang === l ? "var(--accent)" : "transparent",
                        color: lang === l ? "#fff" : "var(--muted)",
                      }}
                    >
                      {l === "en" ? "English" : "Espanol"}
                    </button>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Video */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 16px" }}>
          <Reveal>
            <div className="cs-eyebrow" style={{ marginBottom: 14 }}>{t.watch}</div>
            <div style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--line)", background: "var(--card)" }}>
              {video ? (
                <iframe
                  src={video}
                  title={t.watch}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                />
              ) : (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, gap: 10 }}>
                  <PlayCircle size={48} style={{ color: "var(--accent)", opacity: 0.85 }} />
                  <div className="cs-display" style={{ fontSize: 20, fontWeight: 600 }}>{t.comingSoon}</div>
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, maxWidth: 420 }}>{t.comingSoonNote}</p>
                </div>
              )}
            </div>
          </Reveal>
        </section>

        {/* Steps */}
        <section style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 24px 24px" }}>
          <Reveal><div className="cs-eyebrow" style={{ marginBottom: 16 }}>{t.stepsHeading}</div></Reveal>
          <RevealStagger style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {t.steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <RevealItem key={i} style={{ height: "100%" }}>
                  <div className="cs-glass" style={{ borderRadius: "var(--radius-lg)", padding: 22, height: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                    <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--accent-tint)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon size={20} /></span>
                    <div className="cs-display" style={{ fontSize: 17, fontWeight: 600 }}>{s.title}</div>
                    <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>{s.body}</p>
                  </div>
                </RevealItem>
              );
            })}
          </RevealStagger>
        </section>

        {/* CTA */}
        <section style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 24px 72px" }}>
          <Reveal>
            <div className="cs-glass" style={{ padding: 32, borderRadius: "var(--radius-xl)", textAlign: "center", border: "1.5px solid color-mix(in srgb, var(--accent) 40%, var(--line))" }}>
              <h2 className="cs-display" style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 600 }}>{t.ctaTitle}</h2>
              <p style={{ margin: "0 0 18px", color: "var(--muted)", fontSize: 14.5 }}>{t.ctaSub}</p>
              <Link href="/" className="cs-raise" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 12, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 14.5, fontWeight: 600 }}>{t.ctaBtn} <ArrowRight size={16} /></Link>
            </div>
          </Reveal>
        </section>
      </div>
    </main>
  );
}
