"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Send } from "lucide-react";

// Feedback form → POST /api/feedback → email to both founders. Mirrors the
// WaitlistForm's visual language (cs-wl-input, accent success card).
const TOPICS = ["General", "Scanning & AI", "Pricing", "Listings & posting", "Bug report", "Feature request"];

export function FeedbackForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — humans never see it
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, email: email || undefined, topic, message, website: website || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "done") {
    return (
      <div style={{ borderRadius: 16, border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)", background: "var(--accent-tint)", padding: 24, textAlign: "center" }}>
        <CheckCircle2 style={{ margin: "0 auto", color: "var(--accent)" }} size={30} />
        <p style={{ margin: "10px 0 0", fontSize: 17, fontWeight: 700 }}>Thank you — we read every note.</p>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>
          Your feedback just landed in both founders&apos; inboxes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }} noValidate>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" aria-label="Your name (optional)" className="cs-wl-input" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourshop.com (optional)" aria-label="Your email (optional)" autoComplete="email" className="cs-wl-input" />
      </div>
      <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic" className="cs-wl-input" style={{ appearance: "none" }}>
        {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <textarea
        required
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What should we improve? What's working? What's missing?"
        aria-label="Your feedback"
        rows={6}
        className="cs-wl-input"
        style={{ resize: "vertical", minHeight: 130, lineHeight: 1.55 }}
      />
      {/* Honeypot: visually hidden, tabbed past by humans, filled by bots */}
      <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
      <button
        type="submit"
        disabled={status === "loading" || message.trim().length < 5}
        className="cs-raise"
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 22px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: status === "loading" ? "wait" : "pointer", opacity: message.trim().length < 5 ? 0.65 : 1 }}
      >
        {status === "loading" ? <><Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Sending…</> : <><Send size={16} /> Send feedback</>}
      </button>
      {status === "error" && <p role="alert" style={{ margin: 0, fontSize: 13, color: "#d4553d" }}>{error}</p>}
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
        Goes straight to Andy and Mohammad. Leave your email if you&apos;d like a reply.
      </p>
    </form>
  );
}
