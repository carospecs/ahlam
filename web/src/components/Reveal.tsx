"use client";

import React from "react";
import { motion, type Variants } from "framer-motion";

// Shared scroll-reveal helpers for the public marketing/content pages (guides,
// waitlist). Client component so server pages can drop in real entrance motion.
// All motion is gated by the global prefers-reduced-motion guard.

const EASE = [0.22, 0.8, 0.26, 1] as const;

export function Reveal({
  children,
  delay = 0,
  y = 22,
  className,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const item: Variants = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } };

// Staggered container: direct children wrapped in <RevealItem> animate in sequence.
export function RevealStagger({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className={className} style={style}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div variants={item} whileHover={{ y: -4 }} className={className} style={style}>
      {children}
    </motion.div>
  );
}
