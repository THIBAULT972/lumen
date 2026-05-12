"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Bouton de switch dark/light. Le SSR rend toujours la même chose
 * (placeholder neutre) — l'icône réelle n'apparaît qu'après mount côté
 * client, pour éviter un mismatch d'hydratation sur aria-label.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const baseClasses = cn(
    "relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary/40 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
    className,
  );

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Changer de thème"
        className={baseClasses}
        disabled
      >
        <span className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      className={baseClasses}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
