"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  X,
  CalendarDays,
  Clock,
  Timer,
  MapPin,
  Users as UsersIcon,
  Wrench,
  Send,
  StickyNote,
  Plus,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  EPISODE_STATUSES,
  saveEpisode,
  type EpisodePayload,
  type EpisodeStatus,
} from "../actions";
import type { Episode } from "./page";
import { statusLabel } from "./status-badge";

const FORMAT_OPTIONS = [
  "Reportage",
  "Interview",
  "Capsule",
  "Documentaire",
  "Live",
  "Tutoriel",
  "Autre",
];

function isoToInputDate(iso: string | null): string {
  if (!iso) return "";
  const dt = new Date(iso);
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "America/Martinique",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

function formStateFromEpisode(ep: Episode): EpisodePayload {
  return {
    name: ep.name,
    format: ep.format ?? "",
    status: ep.status,
    production_date: ep.production_date ? isoToInputDate(ep.production_date) : null,
    production_time: ep.production_time ?? null,
    duration_minutes: ep.duration_minutes,
    publication_date: ep.publication_date ? isoToInputDate(ep.publication_date) : null,
    location: ep.location ?? "",
    guests: [...ep.guests],
    equipment: [...ep.equipment],
    platform: ep.platform ?? "",
    notes: ep.notes ?? "",
    description: ep.description ?? "",
  };
}

function payloadsEqual(a: EpisodePayload, b: EpisodePayload): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function EpisodeDetailPanel({
  episode,
  projectId,
  fullscreen,
  onToggleFullscreen,
  onClose,
}: {
  episode: Episode;
  projectId: string;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
}) {
  const initial = formStateFromEpisode(episode);
  const [form, setForm] = useState<EpisodePayload>(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = !payloadsEqual(form, initial);

  function update<K extends keyof EpisodePayload>(
    key: K,
    value: EpisodePayload[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await saveEpisode(episode.id, projectId, form);
      if (!r.ok) {
        setError(r.error);
      } else {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1800);
      }
    });
  }

  return (
    <div className="glass-panel relative flex flex-col gap-6 rounded-2xl p-5 md:p-7">
      <DetailHeader
        episode={episode}
        dirty={dirty}
        savedFlash={savedFlash}
        pending={pending}
        fullscreen={fullscreen}
        onToggleFullscreen={onToggleFullscreen}
        onClose={onClose}
        onSave={save}
      />

      {error ? (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      ) : null}

      {/* Name */}
      <FieldRow label="Titre" required>
        <Input
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          required
          className="h-11 bg-white/[0.03] text-base font-medium"
        />
      </FieldRow>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FieldRow label="Statut">
          <Select
            value={form.status}
            onValueChange={(v) => update("status", v as EpisodeStatus)}
          >
            <SelectTrigger className="h-11 bg-white/[0.03]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EPISODE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Format">
          <Select
            value={form.format ?? ""}
            onValueChange={(v) => update("format", v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="h-11 bg-white/[0.03]">
              <SelectValue placeholder="Choisis un format…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Non défini</SelectItem>
              {FORMAT_OPTIONS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
      </div>

      {/* Dates */}
      <FieldRow
        icon={<CalendarDays className="h-3.5 w-3.5" />}
        label="Tournage"
      >
        <div className="grid grid-cols-3 gap-3">
          <Input
            type="date"
            value={form.production_date ?? ""}
            onChange={(e) =>
              update("production_date", e.target.value || null)
            }
            className="h-11 bg-white/[0.03]"
            aria-label="Date de tournage"
          />
          <Input
            type="time"
            value={form.production_time ?? ""}
            onChange={(e) =>
              update("production_time", e.target.value || null)
            }
            className="h-11 bg-white/[0.03]"
            aria-label="Heure de tournage"
          />
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={1440}
              value={form.duration_minutes ?? ""}
              onChange={(e) =>
                update(
                  "duration_minutes",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              placeholder="Durée"
              className="h-11 bg-white/[0.03] pr-12"
              aria-label="Durée en minutes"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
              min
            </span>
          </div>
        </div>
      </FieldRow>

      <FieldRow
        icon={<Send className="h-3.5 w-3.5" />}
        label="Parution"
      >
        <Input
          type="date"
          value={form.publication_date ?? ""}
          onChange={(e) =>
            update("publication_date", e.target.value || null)
          }
          className="h-11 bg-white/[0.03] md:max-w-xs"
        />
      </FieldRow>

      {/* Location */}
      <FieldRow icon={<MapPin className="h-3.5 w-3.5" />} label="Lieu">
        <Input
          value={form.location ?? ""}
          onChange={(e) => update("location", e.target.value)}
          placeholder="Sainte-Anne · Plage des Salines"
          className="h-11 bg-white/[0.03]"
        />
      </FieldRow>

      {/* Platform */}
      <FieldRow
        icon={<Send className="h-3.5 w-3.5" />}
        label="Plateforme de diffusion"
      >
        <Input
          value={form.platform ?? ""}
          onChange={(e) => update("platform", e.target.value)}
          placeholder="YouTube, Instagram, France 3, …"
          className="h-11 bg-white/[0.03] md:max-w-md"
        />
      </FieldRow>

      {/* Guests */}
      <FieldRow icon={<UsersIcon className="h-3.5 w-3.5" />} label="Intervenants">
        <ChipsInput
          items={form.guests}
          onChange={(v) => update("guests", v)}
          placeholder="Nom + Entrée pour ajouter"
        />
      </FieldRow>

      {/* Equipment */}
      <FieldRow icon={<Wrench className="h-3.5 w-3.5" />} label="Équipement">
        <ChipsInput
          items={form.equipment}
          onChange={(v) => update("equipment", v)}
          placeholder="Caméra A7S III, Drone, Steadicam…"
        />
      </FieldRow>

      {/* Description */}
      <FieldRow label="Synopsis / description">
        <textarea
          value={form.description ?? ""}
          onChange={(e) => update("description", e.target.value)}
          rows={3}
          placeholder="Sujet, angle, lieu, contexte…"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </FieldRow>

      {/* Notes */}
      <FieldRow icon={<StickyNote className="h-3.5 w-3.5" />} label="Notes de prod">
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
          rows={5}
          placeholder="Brief technique, contacts utiles, points d'attention…"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </FieldRow>

      <DetailFooter
        dirty={dirty}
        pending={pending}
        savedFlash={savedFlash}
        onSave={save}
        onReset={() => setForm(initial)}
      />
    </div>
  );
}

function DetailHeader({
  episode,
  dirty,
  savedFlash,
  pending,
  fullscreen,
  onToggleFullscreen,
  onClose,
  onSave,
}: {
  episode: Episode;
  dirty: boolean;
  savedFlash: boolean;
  pending: boolean;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      {/* Mobile : back arrow */}
      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-2 transition-colors hover:bg-white/[0.06] md:hidden"
        aria-label="Retour"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
          Émission #{episode.order_index + 1}
        </p>
        <h2 className="mt-1 truncate font-heading text-2xl font-light leading-tight">
          {episode.name}
        </h2>
        {dirty ? (
          <p className="mt-1 text-[11px] uppercase tracking-wider text-amber-400/90">
            ● Modifications non enregistrées
          </p>
        ) : savedFlash ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-emerald-400/90">
            <Check className="h-3 w-3" />
            Enregistré
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        {/* Mobile + desktop : quick save button */}
        <Button
          size="sm"
          className="bg-gradient-neon text-white"
          disabled={!dirty || pending}
          onClick={onSave}
        >
          {pending ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              <span className="hidden md:inline">Enregistrement…</span>
            </>
          ) : (
            "Enregistrer"
          )}
        </Button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          className="hidden rounded-md p-2 transition-colors hover:bg-white/[0.06] md:inline-flex"
          aria-label={fullscreen ? "Réduire" : "Agrandir"}
        >
          {fullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="hidden rounded-md p-2 transition-colors hover:bg-white/[0.06] md:inline-flex"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function DetailFooter({
  dirty,
  pending,
  savedFlash,
  onSave,
  onReset,
}: {
  dirty: boolean;
  pending: boolean;
  savedFlash: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 flex items-center justify-between gap-3 rounded-b-2xl border-t border-white/10 bg-background/80 px-5 py-4 backdrop-blur-md md:-mx-7 md:-mb-7 md:px-7">
      <div className="text-xs text-muted-foreground">
        {dirty ? (
          <span className="text-amber-400/90">
            ● Modifications en attente
          </span>
        ) : savedFlash ? (
          <span className="inline-flex items-center gap-1 text-emerald-400/90">
            <Check className="h-3 w-3" />
            Enregistré
          </span>
        ) : (
          "Tout est à jour"
        )}
      </div>
      <div className="flex items-center gap-2">
        {dirty ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={pending}
          >
            Annuler les modifs
          </Button>
        ) : null}
        <Button
          type="button"
          className="bg-gradient-neon text-white"
          disabled={!dirty || pending}
          onClick={onSave}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement…
            </>
          ) : (
            "Enregistrer"
          )}
        </Button>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  required,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function ChipsInput({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (items.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...items, v]);
    setDraft("");
  }

  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-11 bg-white/[0.03]"
        />
        <Button
          type="button"
          variant="ghost"
          onClick={add}
          disabled={!draft.trim()}
          className="h-11 px-3"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, idx) => (
            <span
              key={`${item}-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-3 pr-1 text-xs"
            >
              {item}
              <button
                type="button"
                onClick={() => remove(idx)}
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                aria-label={`Retirer ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

void Clock;
void Timer;
