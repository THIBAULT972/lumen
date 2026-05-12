"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import {
  Plus,
  Video,
  Loader2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Trash2,
  ChevronRight,
  GripVertical,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  createEpisode,
  deleteEpisode,
  moveEpisode,
} from "../actions";
import type { Episode, Platform } from "./page";
import {
  EpisodeDetailPanel,
  type PanelHandle,
} from "./episode-detail-panel";
import { StatusBadge } from "./status-badge";

const DEFAULT_PANEL_WIDTH = 640;
const MIN_PANEL_WIDTH = 420;

export function ProjetWorkspace({
  projectId,
  episodes,
  availablePlatforms,
}: {
  projectId: string;
  episodes: Episode[];
  availablePlatforms: Platform[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const panelRef = useRef<PanelHandle>(null);

  const selected = selectedId
    ? episodes.find((e) => e.id === selectedId) ?? null
    : null;

  // Resize logic ---------------------------------------------------------
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );
  const onDragStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragStateRef.current = {
        startX: e.clientX,
        startWidth: panelWidth,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [panelWidth],
  );

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const st = dragStateRef.current;
      if (!st) return;
      const max = Math.max(
        MIN_PANEL_WIDTH,
        window.innerWidth - 320, // leave at least 320px for the list
      );
      const next = Math.min(
        Math.max(st.startWidth + (st.startX - e.clientX), MIN_PANEL_WIDTH),
        max,
      );
      setPanelWidth(next);
    }
    function onUp() {
      if (dragStateRef.current) {
        dragStateRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Switch / close logic -------------------------------------------------
  const requestSelect = useCallback(
    (newId: string | null) => {
      if (!panelRef.current) {
        setSelectedId(newId);
        return;
      }
      panelRef.current.tryAction(() => setSelectedId(newId));
    },
    [],
  );

  // ESC closes the panel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedId) {
        requestSelect(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, requestSelect]);

  // Layout ---------------------------------------------------------------
  // When a side-panel is open on desktop, we pad the page so the list
  // is never hidden behind it.
  const pagePadding: CSSProperties =
    selected && !fullscreen
      ? ({ "--lumen-panel-w": `${panelWidth}px` } as CSSProperties)
      : ({ "--lumen-panel-w": "0px" } as CSSProperties);

  return (
    <div style={pagePadding}>
      <div className="mb-4 flex items-center justify-between md:pr-[var(--lumen-panel-w,0px)]">
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
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <AddEpisodeDialog
          projectId={projectId}
          onSuccess={(id) => {
            setAddOpen(false);
            requestSelect(id);
          }}
        />
      </Dialog>

      {episodes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="md:pr-[var(--lumen-panel-w,0px)]">
          <EpisodeList
            projectId={projectId}
            episodes={episodes}
            selectedId={selectedId}
            onSelect={requestSelect}
            compact={selected !== null}
          />
        </div>
      )}

      {/* DETAIL PANEL --------------------------------------------------- */}
      {selected ? (
        <aside
          className={cn(
            // mobile : plein écran
            "fixed inset-0 z-40 overflow-y-auto bg-background",
            // desktop : fenêtre à droite
            "md:left-auto md:right-0 md:top-0 md:h-screen md:border-l md:border-foreground/[0.08] md:shadow-[-24px_0_60px_-30px_oklch(0_0_0/0.8)]",
            // fullscreen : prend tout l'écran sur desktop
            fullscreen
              ? "md:left-0 md:right-0 md:w-full md:border-l-0"
              : "",
          )}
          style={
            fullscreen
              ? undefined
              : ({ width: `${panelWidth}px` } as CSSProperties)
          }
        >
          {/* Drag handle (desktop, side mode only) */}
          {!fullscreen ? (
            <div
              onMouseDown={onDragStart}
              className="group/handle absolute left-0 top-0 hidden h-full w-2 cursor-col-resize md:flex"
              aria-label="Redimensionner le panneau"
              role="separator"
            >
              <div className="my-auto h-12 w-1 rounded-r-full bg-foreground/10 transition-colors group-hover/handle:bg-primary/40" />
              <GripVertical className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-foreground/30 opacity-0 transition-opacity group-hover/handle:opacity-100" />
            </div>
          ) : null}

          <EpisodeDetailPanel
            ref={panelRef}
            key={selected.id}
            episode={selected}
            projectId={projectId}
            availablePlatforms={availablePlatforms}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen(!fullscreen)}
            onClose={() => requestSelect(null)}
          />
        </aside>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-panel rounded-2xl p-12 text-center">
      <Video className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-4 font-heading text-xl font-light">
        Aucune émission pour l'instant
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Crée une émission pour commencer à organiser tes tournages.
      </p>
    </div>
  );
}

function EpisodeList({
  projectId,
  episodes,
  selectedId,
  onSelect,
  compact,
}: {
  projectId: string;
  episodes: Episode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  compact: boolean;
}) {
  return (
    <ul className="glass-panel divide-y divide-white/[0.06] overflow-hidden rounded-2xl">
      {episodes.map((ep, idx) => (
        <EpisodeListItem
          key={ep.id}
          episode={ep}
          projectId={projectId}
          isSelected={selectedId === ep.id}
          onSelect={onSelect}
          isFirst={idx === 0}
          isLast={idx === episodes.length - 1}
          compact={compact}
        />
      ))}
    </ul>
  );
}

function EpisodeListItem({
  episode,
  projectId,
  isSelected,
  onSelect,
  isFirst,
  isLast,
  compact,
}: {
  episode: Episode;
  projectId: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
  compact: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  function move(direction: "up" | "down") {
    startTransition(() => moveEpisode(episode.id, projectId, direction));
  }

  return (
    <li
      className={cn(
        "group/item flex items-center gap-3 px-4 py-3 transition-colors",
        isSelected
          ? "bg-primary/10"
          : "cursor-pointer hover:bg-foreground/[0.03]",
      )}
      onClick={() => onSelect(episode.id)}
    >
      <span className="rounded-md border border-foreground/10 bg-foreground/[0.03] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        #{episode.order_index + 1}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-tight">{episode.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <StatusBadge status={episode.status} compact />
          {episode.production_date ? (
            <span>
              {new Date(episode.production_date).toLocaleDateString("fr-FR", {
                timeZone: "America/Martinique",
                day: "2-digit",
                month: "short",
              })}
            </span>
          ) : null}
          {!compact && episode.mission_count > 0 ? (
            <span>
              · {episode.mission_count} mission
              {episode.mission_count > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      </div>

      {!compact ? (
        <div
          className="flex items-center gap-1 opacity-0 transition-opacity group-hover/item:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={isFirst || pending}
            onClick={() => move("up")}
            className="rounded-md p-1.5 transition-colors hover:bg-foreground/[0.06] disabled:opacity-30"
            aria-label="Monter"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={isLast || pending}
            onClick={() => move("down")}
            className="rounded-md p-1.5 transition-colors hover:bg-foreground/[0.06] disabled:opacity-30"
            aria-label="Descendre"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-md p-1.5 transition-colors hover:bg-foreground/[0.06]"
              aria-label="Actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="glass-panel border-foreground/10"
            >
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
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DeleteEpisodeDialog
          episode={episode}
          projectId={projectId}
          onOpenChange={setDeleteOpen}
        />
      </Dialog>
    </li>
  );
}

function AddEpisodeDialog({
  projectId,
  onSuccess,
}: {
  projectId: string;
  onSuccess: (newEpisodeId: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await createEpisode(projectId, name);
      if (!r.ok) {
        setError(r.error);
      } else {
        setName("");
        onSuccess(r.episodeId);
      }
    });
  }

  return (
    <DialogContent className="glass-panel border-foreground/10 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl font-light">
          Nouvelle émission
        </DialogTitle>
        <DialogDescription>
          Donne juste un nom pour commencer. Tu pourras détailler tout le reste
          (lieu, dates, équipe, équipement…) après création.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-episode-name">Nom</Label>
          <Input
            id="new-episode-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
            placeholder="Ex: Épisode 4 — Sainte-Anne"
            className="h-11 bg-foreground/[0.03]"
          />
        </div>

        {error ? (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création…
              </>
            ) : (
              "Créer et éditer"
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
    <DialogContent className="glass-panel border-foreground/10 sm:max-w-md">
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
