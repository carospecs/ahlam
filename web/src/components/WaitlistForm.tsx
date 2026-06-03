"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";

export function WaitlistForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [shopName, setShopName] = useState("");
  const [partsPerDay, setPartsPerDay] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          shopName: shopName || undefined,
          partsPerDay: partsPerDay || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-2xl border border-accent/40 bg-accent/10 p-6 text-center">
        <CheckCircle2 className="mx-auto text-accent" size={28} />
        <p className="mt-2 text-lg font-semibold">You&apos;re on the list.</p>
        <p className="mt-1 text-sm text-muted">
          We&apos;ll email you when your free pilot invite is ready.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-line bg-surface2/60 px-4 py-3 text-foreground placeholder-muted outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40";

  return (
    <form onSubmit={submit} className="w-full space-y-3" noValidate>
      <label htmlFor="wl-email" className="sr-only">
        Work email
      </label>
      <input
        id="wl-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@yourshop.com"
        className={inputClass}
      />
      {!compact && (
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Shop name (optional)"
            aria-label="Shop name (optional)"
            className={inputClass}
          />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={partsPerDay}
            onChange={(e) => setPartsPerDay(e.target.value)}
            placeholder="Parts listed / day (optional)"
            aria-label="Parts listed per day (optional)"
            className={inputClass}
          />
        </div>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-semibold text-white transition hover:bg-accenthover disabled:opacity-60"
      >
        {status === "loading" && <Loader2 size={18} className="animate-spin" />}
        {status === "loading" ? "Joining…" : "Join the free pilot waitlist"}
      </button>
      {status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
      <p className="text-center text-xs text-muted">
        Free 30–60 day pilot for early shops. No card required.
      </p>
    </form>
  );
}
