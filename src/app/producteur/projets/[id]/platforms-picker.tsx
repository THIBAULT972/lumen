"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Plus, X, Check, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPlatform } from "../actions";
import type { Platform } from "./page";
import { cn } from "@/lib/utils";

/**
 * Multi-select with search + inline creation.
 *
 * - `available` is the global referential (from public.platforms).
 * - `selected` is the array of platform NAMES currently chosen for the episode.
 * - Adding a brand new platform inserts it into the referential server-side,
 *   then picks it for the current episode locally.
 */
export function PlatformsPicker({
  available,
  selected,
  onChange,
}: {
  available: Platform[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [locallyAdded, setLocallyAdded] = useState<Platform[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const merged: Platform[] = useMemo(() => {
    const map = new Map<string, Platform>();
    for (const p of available) map.set(p.name.toLowerCase(), p);
    for (const p of locallyAdded) map.set(p.name.toLowerCase(), p);
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
    );
  }, [available, locallyAdded]);

  const trimmedQuery = query.trim();
  const filtered = useMemo(() => {
    if (!trimmedQuery) return merged;
    const q = trimmedQuery.toLowerCase();
    return merged.filter((p) => p.name.toLowerCase().includes(q));
  }, [merged, trimmedQuery]);

  const exactMatchExists = useMemo(
    () =>
      merged.some(
        (p) => p.name.toLowerCase() === trimmedQuery.toLowerCase(),
      ),
    [merged, trimmedQuery],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setError(null);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, close]);

  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter((n) => n !== name));
    } else {
      onChange([...selected, name]);
    }
  }

  function remove(name: string) {
    onChange(selected.filter((n) => n !== name));
  }

  function createAndSelect() {
    if (!trimmedQuery) return;
    setError(null);
    startTransition(async () => {
      const r = await createPlatform(trimmedQuery);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setLocallyAdded((prev) => [...prev, r.platform]);
      if (!selected.includes(r.platform.name)) {
        onChange([...selected, r.platform.name]);
      }
      setQuery("");
    });
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* Selected chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 py-1 pl-3 pr-1 text-xs text-foreground"
          >
            {name}
            <button
              type="button"
              onClick={() => remove(name)}
              className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
              aria-label={`Retirer ${name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-dashed py-1 pl-2 pr-3 text-xs transition-colors",
            open
              ? "border-primary/50 bg-primary/5 text-foreground"
              : "border-foreground/15 bg-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground",
          )}
        >
          <Plus className="h-3 w-3" />
          {selected.length === 0 ? "Choisir une plateforme" : "Ajouter"}
        </button>
      </div>

      {/* Picker popover */}
      {open ? (
        <div className="glass-panel relative z-10 rounded-xl border border-foreground/10 p-2">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher ou créer…"
              className="h-10 bg-foreground/[0.03] pl-9"
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered.length === 1) {
                    toggle(filtered[0]!.name);
                    setQuery("");
                  } else if (trimmedQuery && !exactMatchExists) {
                    createAndSelect();
                  }
                }
              }}
            />
          </div>

          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {filtered.length === 0 && !trimmedQuery ? (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                Aucune plateforme. Tape un nom pour en créer une.
              </li>
            ) : (
              filtered.map((p) => {
                const isSel = selected.includes(p.name);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggle(p.name)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                        isSel
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-foreground/[0.04]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-sm border",
                          isSel
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-foreground/20",
                        )}
                      >
                        {isSel ? <Check className="h-3 w-3" /> : null}
                      </span>
                      {p.name}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {trimmedQuery && !exactMatchExists ? (
            <div className="mt-1 border-t border-foreground/[0.06] pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={createAndSelect}
                className="w-full justify-start"
              >
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Création…
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-3 w-3" />
                    Créer « {trimmedQuery} »
                  </>
                )}
              </Button>
            </div>
          ) : null}

          {error ? (
            <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
