"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

export function DealAgent({ shopId, shopName }: { shopId: string; shopName: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: `Hi! I'm ${shopName}'s parts assistant. Tell me what you're looking for and your vehicle, and I'll check what we have in stock and the price.`,
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/deal-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, messages: next }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = res.ok && data.reply ? data.reply : data.error || "Sorry, something went wrong. Try again.";
      setMessages((m) => [
        ...m,
        { role: "assistant", content: reply },
        ...(data.dealCaptured
          ? [{ role: "assistant" as const, content: "✓ Sent to the shop. They'll reach out to confirm." }]
          : []),
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't reach the assistant. Check your connection." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat about inventory"
          style={{
            position: "fixed",
            bottom: 22,
            right: 22,
            zIndex: 50,
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            padding: "13px 18px",
            borderRadius: 999,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 14.5,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 8px 26px rgba(0,0,0,0.22)",
          }}
        >
          <MessageCircle size={19} /> Ask about parts
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 22,
            right: 22,
            zIndex: 50,
            width: "min(380px, calc(100vw - 32px))",
            height: "min(560px, calc(100vh - 90px))",
            display: "flex",
            flexDirection: "column",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "13px 16px",
              background: "var(--accent)",
              color: "#fff",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <span style={{ fontSize: 14.5, fontWeight: 800 }}>{shopName}</span>
              <span style={{ fontSize: 12, opacity: 0.85 }}>Parts assistant · live inventory</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", padding: 4 }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "84%",
                  padding: "9px 13px",
                  borderRadius: 13,
                  fontSize: 14,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  background: m.role === "user" ? "var(--accent)" : "var(--background)",
                  color: m.role === "user" ? "#fff" : "var(--foreground)",
                  border: m.role === "user" ? "none" : "1px solid var(--line)",
                }}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div style={{ alignSelf: "flex-start", padding: "9px 13px", fontSize: 13, color: "var(--muted)" }}>
                Checking inventory…
              </div>
            )}
          </div>

          {/* Composer */}
          <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="e.g. alternator for a 2016 Camry?"
              disabled={busy}
              style={{
                flex: 1,
                padding: "10px 13px",
                borderRadius: 11,
                border: "1px solid var(--line)",
                background: "var(--background)",
                color: "var(--foreground)",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              aria-label="Send"
              style={{
                display: "grid",
                placeItems: "center",
                width: 42,
                borderRadius: 11,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                cursor: busy || !input.trim() ? "default" : "pointer",
                opacity: busy || !input.trim() ? 0.5 : 1,
              }}
            >
              <Send size={17} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
