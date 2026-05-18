"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

const stackVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.06,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease },
  },
};

/**
 * Wraps the hub content. Each direct `<RevealItem>` child appears in
 * sequence (fade + slide up + de-blur), driven by the stack's stagger.
 */
export function RevealStack({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={stackVariants}
      className="contents"
    >
      {children}
    </motion.div>
  );
}

/** Single animated block. Drop the original section/div inside. */
export function RevealItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * Subtle animated glow behind the greeting heading.
 * Sits absolutely; the parent must be relative.
 */
export function GreetingGlow() {
  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 0.55, scale: 1 }}
      transition={{ duration: 1.2, ease, delay: 0.1 }}
      className="pointer-events-none absolute -left-12 -top-10 -z-10 h-40 w-72 rounded-full bg-gradient-neon blur-3xl glow-pulse sm:h-56 sm:w-96"
    />
  );
}
