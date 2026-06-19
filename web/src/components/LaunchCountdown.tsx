"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Launch moment: the Monday right after the Fourth of July weekend, 2026,
// 9am Pacific (we're starting with California + Texas yards).
const LAUNCH = new Date("2026-07-06T09:00:00-07:00").getTime();

function parts(msLeft: number) {
  const s = Math.floor(Math.max(0, msLeft) / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins: Math.floor((s % 3600) / 60),
    secs: s % 60,
  };
}

// Animated countdown to launch. Each unit fades/slides only when ITS value
// changes, so the seconds tick every second while days sit still. Renders
// neutral placeholders until mounted to avoid an SSR/client time mismatch.
export function LaunchCountdown() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(LAUNCH);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const t = parts(LAUNCH - now);
  const units: { val: number; label: string }[] = [
    { val: t.days, label: "Days" },
    { val: t.hours, label: "Hours" },
    { val: t.mins, label: "Min" },
    { val: t.secs, label: "Sec" },
  ];

  if (mounted && LAUNCH - now <= 0) {
    return (
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>
        We&apos;re live. Welcome to Ahlam.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 9, alignItems: "stretch" }} aria-label="Countdown to launch" role="timer">
      {units.map((u) => (
        <div
          key={u.label}
          style={{
            minWidth: 62,
            padding: "10px 6px 8px",
            borderRadius: 12,
            background: "var(--accent-tint)",
            border: "1px solid color-mix(in srgb, var(--accent) 26%, transparent)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
          }}
        >
          <div style={{ position: "relative", height: 30, width: "100%", overflow: "hidden" }}>
            <AnimatePresence initial={false}>
              <motion.span
                key={mounted ? u.val : "placeholder"}
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 14 }}
                transition={{ duration: 0.28, ease: [0.22, 0.8, 0.26, 1] }}
                className="cs-display tnum"
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 24,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: "var(--foreground)",
                }}
              >
                {mounted ? String(u.val).padStart(2, "0") : "--"}
              </motion.span>
            </AnimatePresence>
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)" }}>
            {u.label}
          </span>
        </div>
      ))}
    </div>
  );
}
