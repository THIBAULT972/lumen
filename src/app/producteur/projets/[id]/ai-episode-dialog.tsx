"use client";

import { useState, useTransition } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Wand2,
  RefreshCcw,
  Calendar,
  MapPin,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PollinationsImage } from "@/components/ai/pollinations-image";
import {
  createEpisodeFromAiDraft,
  generateEpisodeForProject,
} from "../ai-actions";
import type { EpisodeFullDraft } from "@/lib/ai/episode-generator";

type Phase =
  | { kind: "idea" }
  | { kind: "generating" }
  | { kind: "preview"; draft: EpisodeFullDraft };

export function AiEpisodeDialog({
  projectId,
  onSuccess,
}: {
  projectId: string;
  onSuccess: (episodeId: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idea" });
  const [idea, setIdea] = useState("");
  const [draftEdit, setDraftEdit] = useState<EpisodeFullDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();
  const [creating, startCreating] = useTransition();

  function generate() {
    setError(null);
    startGenerating(async () => {
      setPhase({ kind: "generating" });
      const r = await generateEpisodeForProject({
        projectId,
        idea,
      });
      if (!r.ok) {
        setError(r.error);
        setPhase({ kind: "idea" });
        return;
      }
      setDraftEdit(r.draft);
      setPhase({ kind: "preview", draft: r.draft });
    });
  }

  function create() {
    if (!draftEdit) return;
    setError(null);
    startCreating(async () => {
      const r = await createEpisodeFromAiDraft({
        projectId,
        draft: draftEdit,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onSuccess(r.episodeId);
    });
  }

  // ─── PHASE IDEA ─────────────────────────────────────────────────────────
  if (phase.kind === "idea" || phase.kind === "generating") {
    return (
      <DialogContent className="border-foreground/10 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-2xl font-light">
            <Sparkles className="h-5 w-5 text-primary" />
            Nouvelle émission — avec l'IA
          </DialogTitle>
          <DialogDescription>
            Décris brièvement ton idée d'émission. Gemini reprend le contexte
            du projet (thème, ton, approche de tournage) et sort un brouillon
            complet : script + shot list + visuels.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="ai-ep-idea">Idée d'émission</Label>
          <textarea
            id="ai-ep-idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={5}
            placeholder="Ex : Le pouvoir des maires en Martinique — pourquoi ils n'ont pas la même marge de manœuvre qu'en métropole."
            className="w-full rounded-lg border border-foreground/10 bg-foreground/[0.03] p-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
            disabled={generating}
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            Tu peux être très court (un sujet en une phrase) ou très précis (un
            angle, un invité type, une accroche). L'IA s'adapte.
          </p>
        </div>

        {error ? (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            disabled={!idea.trim() || generating}
            onClick={generate}
            className="bg-gradient-neon text-white"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gemini détaille l'émission… (~15 s)
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Générer l'émission
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  // ─── PHASE PREVIEW ───────────────────────────────────────────────────────
  if (!draftEdit) return null;

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto border-foreground/10 sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-heading text-2xl font-light">
          <Sparkles className="h-5 w-5 text-primary" />
          Brouillon d'émission
        </DialogTitle>
        <DialogDescription>
          Édite ce que tu veux avant de créer. Une fois validé, l'émission
          sera ajoutée au projet avec son brief complet.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        {/* Header : nom + format + durée */}
        <div className="space-y-2">
          <Label htmlFor="ai-ep-name">Titre</Label>
          <Input
            id="ai-ep-name"
            value={draftEdit.name}
            onChange={(e) =>
              setDraftEdit({ ...draftEdit, name: e.target.value })
            }
            className="h-11 bg-foreground/[0.03] font-medium"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select
              value={draftEdit.format}
              onValueChange={(v) =>
                setDraftEdit({
                  ...draftEdit,
                  format: (v ?? "Reportage") as typeof draftEdit.format,
                })
              }
            >
              <SelectTrigger className="h-10 bg-foreground/[0.03]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    "Reportage",
                    "Interview",
                    "Capsule",
                    "Documentaire",
                    "Live",
                    "Tutoriel",
                    "Autre",
                  ] as const
                ).map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-ep-duration">Durée (min)</Label>
            <Input
              id="ai-ep-duration"
              type="number"
              min={1}
              max={120}
              value={draftEdit.duration_minutes}
              onChange={(e) =>
                setDraftEdit({
                  ...draftEdit,
                  duration_minutes: Number(e.target.value) || 0,
                })
              }
              className="h-10 bg-foreground/[0.03]"
            />
          </div>
        </div>

        {/* Synopsis */}
        <div className="space-y-1.5">
          <Label htmlFor="ai-ep-desc">Synopsis</Label>
          <textarea
            id="ai-ep-desc"
            value={draftEdit.description}
            onChange={(e) =>
              setDraftEdit({ ...draftEdit, description: e.target.value })
            }
            rows={2}
            className="w-full rounded-lg border border-foreground/10 bg-foreground/[0.03] p-3 text-sm focus:border-primary/60 focus:outline-none"
          />
        </div>

        {/* Meta line */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="ai-ep-location"
              className="flex items-center gap-1.5 text-xs"
            >
              <MapPin className="h-3.5 w-3.5" />
              Lieu suggéré
            </Label>
            <Input
              id="ai-ep-location"
              value={draftEdit.location_suggestion}
              onChange={(e) =>
                setDraftEdit({
                  ...draftEdit,
                  location_suggestion: e.target.value,
                })
              }
              className="h-10 bg-foreground/[0.03]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              Plateformes
            </Label>
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-foreground/10 bg-foreground/[0.03] p-2 min-h-10">
              {draftEdit.platforms.length > 0 ? (
                draftEdit.platforms.map((p) => (
                  <Badge key={p} variant="secondary" className="text-[10px]">
                    {p}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Aucune</span>
              )}
            </div>
          </div>
        </div>

        {/* Guests */}
        {draftEdit.guests_suggestion.length > 0 ? (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              Profils d'intervenants suggérés
            </Label>
            <div className="flex flex-wrap gap-1">
              {draftEdit.guests_suggestion.map((g, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">
                  {g}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {/* Visuals (Pollinations) */}
        {draftEdit.visual_prompts.length > 0 ? (
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Visuels d'illustration (Pollinations)
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {draftEdit.visual_prompts.map((p, i) => (
                <PollinationsImage
                  key={i}
                  prompt={p}
                  aspect="video"
                  title={p}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Script */}
        <details
          open
          className="group rounded-md border border-primary/30 bg-primary/[0.04] open:bg-primary/[0.06]"
        >
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
            <span className="text-muted-foreground transition-transform group-open:rotate-90">
              ▸
            </span>
            Script
            <span className="ml-auto text-[10px] text-muted-foreground">
              {draftEdit.script.sections.length} section
              {draftEdit.script.sections.length > 1 ? "s" : ""}
            </span>
          </summary>
          <div className="space-y-3 px-3 pb-3 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-primary">
                Hook (10-15 s)
              </p>
              <p className="mt-1 italic">{draftEdit.script.hook}</p>
            </div>
            {draftEdit.script.sections.map((s, si) => (
              <div
                key={si}
                className="rounded-md border-l-2 border-primary/40 pl-3"
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Section {si + 1}
                </p>
                <p className="font-medium">{s.heading}</p>
                <p className="mt-1 text-muted-foreground">{s.content}</p>
                {s.b_roll && s.b_roll.length > 0 ? (
                  <div className="mt-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      B-roll
                    </p>
                    <ul className="mt-0.5 space-y-0.5">
                      {s.b_roll.map((b, bi) => (
                        <li key={bi} className="text-[11px] text-muted-foreground">
                          · {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ))}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-primary">
                CTA (fin)
              </p>
              <p className="mt-1 italic">{draftEdit.script.cta}</p>
            </div>
          </div>
        </details>

        {/* Shot list */}
        <details className="group rounded-md border border-foreground/10 bg-foreground/[0.02] open:bg-foreground/[0.04]">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
            <span className="text-muted-foreground transition-transform group-open:rotate-90">
              ▸
            </span>
            Shot list
            <span className="ml-auto text-[10px] text-muted-foreground">
              {draftEdit.shots.length} plan{draftEdit.shots.length > 1 ? "s" : ""}
            </span>
          </summary>
          <ul className="space-y-1.5 px-3 pb-3 text-xs">
            {draftEdit.shots.map((s, si) => (
              <li
                key={si}
                className="flex items-start gap-2 rounded-md bg-foreground/[0.02] px-2 py-1.5"
              >
                <span className="shrink-0 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                  {s.type}
                </span>
                <span className="min-w-0 flex-1">{s.description}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>

      {error ? (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      ) : null}

      <DialogFooter className="flex-col-reverse sm:flex-row">
        <Button
          type="button"
          variant="ghost"
          disabled={creating || generating}
          onClick={() => {
            setPhase({ kind: "idea" });
            setDraftEdit(null);
          }}
        >
          <RefreshCcw className="mr-2 h-3.5 w-3.5" />
          Recommencer
        </Button>
        <Button
          type="button"
          className="bg-gradient-neon text-white"
          disabled={creating || !draftEdit.name.trim()}
          onClick={create}
        >
          {creating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Création…
            </>
          ) : (
            "Créer cette émission"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
