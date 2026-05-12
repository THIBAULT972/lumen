"use client";

import { motion } from "motion/react";

/**
 * Decorative animated orbs behind the main content.
 * Pure visual — no interactivity, no semantic role.
 */
export function BackgroundOrbs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        className="absolute left-1/2 top-1/3 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[oklch(0.55_0.25_258)] opacity-[0.28] blur-[180px]"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.2 }}
        className="absolute right-1/4 bottom-1/4 h-[34rem] w-[34rem] translate-x-1/3 translate-y-1/3 rounded-full bg-[oklch(0.55_0.28_310)] opacity-[0.22] blur-[180px]"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.4 }}
        className="absolute left-1/4 top-2/3 h-[28rem] w-[28rem] -translate-x-1/3 rounded-full bg-[oklch(0.6_0.2_200)] opacity-[0.14] blur-[160px]"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,oklch(0_0_0/0.6)_70%,oklch(0_0_0)_100%)]" />
    </div>
  );
}
