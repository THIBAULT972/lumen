"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
  Video,
  Briefcase,
  CalendarDays,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createEpisode,
  deleteEpisode,
  moveEpisode,
  updateEpisode,
  type CreateEpisodeState,
  type UpdateEpisodeState,
} from "../actions";
import type { Episode } from "./page";

export function ProjetDetail({
  projectId,
  episodes,
}: {
  projectId: string;
  episodes: Episode[];
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-xl font-light tracking-wide">
          Émissions
          <span className="ml-2 text-xs text-muted-foreground">
            · {episodes.length}
          </span>
        </h2>
        <Button
          className="bg-gradient-neon text-white"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle émission
        </Button>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <AddEpisodeDialog
            projectId={projectId}
            onSuccess={() => setAddOpen(false)}
          />
        </Dialog>
      </div>

      {episodes.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <Video className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-4 font-heading text-xl font-light">
            Aucune émission pour l'instant
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Crée une émission pour commencer à organiser tes tournages et
            assigner des missions à tes prestataires.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {episodes.map((ep, idx) => (
            <EpisodeCard
              key={ep.id}
              episode={ep}
              projectId={projectId}
              isFirst={idx === 0}
              isLast={idx === episodes.length - 1}
            />
          ))}
        </div>
      )}
    </>
  );
}

function EpisodeCard({
  episode,
  projectId,
  isFirst,
  isLast,
}: {
  episode: Episode;
  projectId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(() => moveEpisode(episode.id, projectId, direction));
  }

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              #{episode.order_index + 1}
            </span>
            <h3 className="font-heading text-lg font-medium leading-tight">
              {episode.name}
            </h3>
          </div>

          {episode.description ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {episode.description}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <DateInfo
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Tournage"
              value={episode.production_date}
            />
            <DateInfo
              icon={<Send className="h-3.5 w-3.5" />}
              label="Parution"
              value={episode.publication_date}
            />
            <span className="inline-flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" />
              {episode.mission_count} mission
              {episode.mission_count > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={isFirst || pending}
            onClick={() => move("up")}
            className="rounded-md p-2 transition-colors hover:bg-white/[0.06] disabled:opacity-30"
            aria-label="Déplacer vers le haut"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={isLast || pending}
            onClick={() => move("down")}
            className="rounded-md p-2 transition-colors hover:bg-white/[0.06] disabled:opacity-30"
            aria-label="Déplacer vers le bas"
          >
            <ArrowDown className="h-4 w-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-md p-2 transition-colors hover:bg-white/[0.06]"
              aria-label="Actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="glass-panel border-white/10"
            >
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <EditEpisodeDialog
          episode={episode}
          projectId={projectId}
          onSuccess={() => setEditOpen(false)}
        />
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DeleteEpisodeDialog
          episode={episode}
          projectId={projectId}
          onOpenChange={setDeleteOpen}
        />
      </Dialog>
    </div>
  );
}

function DateInfo({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      {label} :{" "}
      <span className={value ? "text-foreground" : "text-muted-foreground/60"}>
        {value ? formatDate(value) : "à définir"}
      </span>
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    timeZone: "America/Martinique",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toInputDate(iso: string | null): string {
  if (!iso) return "";
  const dt = new Date(iso);
  // Render in Martinique TZ; HTML date input expects YYYY-MM-DD.
  const fmt = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "America/Martinique",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(dt);
}

function AddEpisodeDialog({
  projectId,
  onSuccess,
}: {
  projectId: string;
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    CreateEpisodeState,
    FormData
  >(async (prev, fd) => {
    const result = await createEpisode(projectId, prev, fd);
    if (result?.ok) onSuccess();
    return result;
  }, null);

  return (
    <DialogContent className="glass-panel border-white/10 sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl font-light">
          Nouvelle émission
        </DialogTitle>
        <DialogDescription>
          Une émission regroupe ce qui se passe pour un contenu donné :
          missions, fichiers, briefs.
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="episode-name">Nom</Label>
          <Input
            id="episode-name"
            name="name"
            autoFocus
            required
            placeholder="Ex: Épisode 4"
            className="h-11 bg-white/[0.03]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="production-date">Date de tournage</Label>
            <Input
              id="production-date"
              name="production_date"
              type="date"
              className="h-11 bg-white/[0.03]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="publication-date">Date de parution</Label>
            <Input
              id="publication-date"
              name="publication_date"
              type="date"
              className="h-11 bg-white/[0.03]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="episode-description">Description (optionnel)</Label>
          <textarea
            id="episode-description"
            name="description"
            rows={3}
            placeholder="Sujet, lieu, intervenants…"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {state && !state.ok ? (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {state.error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création…
              </>
            ) : (
              "Créer l'émission"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function EditEpisodeDialog({
  episode,
  projectId,
  onSuccess,
}: {
  episode: Episode;
  projectId: string;
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    UpdateEpisodeState,
    FormData
  >(async (prev, fd) => {
    const result = await updateEpisode(episode.id, projectId, prev, fd);
    if (result?.ok) onSuccess();
    return result;
  }, null);

  return (
    <DialogContent className="glass-panel border-white/10 sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl font-light">
          Modifier l'émission
        </DialogTitle>
      </DialogHeader>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-episode-name">Nom</Label>
          <Input
            id="edit-episode-name"
            name="name"
            defaultValue={episode.name}
            required
            className="h-11 bg-white/[0.03]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="edit-production-date">Date de tournage</Label>
            <Input
              id="edit-production-date"
              name="production_date"
              type="date"
              defaultValue={toInputDate(episode.production_date)}
              className="h-11 bg-white/[0.03]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-publication-date">Date de parution</Label>
            <Input
              id="edit-publication-date"
              name="publication_date"
              type="date"
              defaultValue={toInputDate(episode.publication_date)}
              className="h-11 bg-white/[0.03]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-episode-description">Description</Label>
          <textarea
            id="edit-episode-description"
            name="description"
            rows={3}
            defaultValue={episode.description ?? ""}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {state && !state.ok ? (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {state.error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function DeleteEpisodeDialog({
  episode,
  projectId,
  onOpenChange,
}: {
  episode: Episode;
  projectId: string;
  onOpenChange: (v: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await deleteEpisode(episode.id, projectId);
      if (!r.ok) setError(r.error);
      else onOpenChange(false);
    });
  }

  return (
    <DialogContent className="glass-panel border-white/10 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl font-light">
          Supprimer l'émission ?
        </DialogTitle>
        <DialogDescription>
          <strong className="text-foreground">{episode.name}</strong> et toutes
          ses missions / fichiers seront supprimés. Action irréversible.
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          Annuler
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={submit}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Suppression…
            </>
          ) : (
            "Supprimer"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
