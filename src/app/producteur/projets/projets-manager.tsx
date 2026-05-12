"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  Loader2,
  AlertCircle,
  FolderOpen,
  Users,
  Video,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  archiveProject,
  createProject,
  deleteProject,
  restoreProject,
  updateProject,
  type CreateProjectState,
  type UpdateProjectState,
} from "./actions";
import type { Project, ClientOption } from "./page";

type Kind = "client" | "media";

export function ProjetsManager({
  projects,
  clients,
  showArchived,
  archivedCount,
  activeCount,
}: {
  projects: Project[];
  clients: ClientOption[];
  showArchived: boolean;
  archivedCount: number;
  activeCount: number;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.02] p-1 text-xs">
          <FilterPill
            href="/producteur/projets"
            active={!showArchived}
            label="Actifs"
            count={activeCount}
          />
          <FilterPill
            href="/producteur/projets?archived=1"
            active={showArchived}
            label="Archivés"
            count={archivedCount}
          />
        </div>

        {!showArchived ? (
          <Button
            className="bg-gradient-neon text-white"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouveau projet
          </Button>
        ) : null}

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <AddProjectDialog
            clients={clients}
            onSuccess={() => setAddOpen(false)}
          />
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <EmptyState archived={showArchived} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} clients={clients} />
          ))}
        </div>
      )}
    </>
  );
}

function FilterPill({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-white/[0.06] px-3 py-1.5 font-medium text-foreground"
          : "rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      {label} <span className="ml-1 text-[10px] opacity-60">{count}</span>
    </Link>
  );
}

function EmptyState({ archived }: { archived: boolean }) {
  return (
    <div className="glass-panel rounded-2xl p-12 text-center">
      <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground" />
      <h3 className="mt-4 font-heading text-2xl font-light">
        {archived ? "Aucun projet archivé" : "Aucun projet pour l'instant"}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        {archived
          ? "Les projets que tu archives apparaîtront ici. Ils sont récupérables tant qu'ils ne sont pas supprimés définitivement."
          : "Crée ton premier projet : choisis s'il est lié à un client ou s'il est interne (média)."}
      </p>
    </div>
  );
}

function ProjectCard({
  project,
  clients,
}: {
  project: Project;
  clients: ClientOption[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleArchive() {
    startTransition(() => archiveProject(project.id));
  }
  function handleRestore() {
    startTransition(() => restoreProject(project.id));
  }

  return (
    <div className="glass-panel relative rounded-2xl p-5 transition-all hover:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/producteur/projets/${project.id}`} className="min-w-0 flex-1">
          <Badge
            variant="secondary"
            className={
              project.client_id
                ? "border-[oklch(0.55_0.25_258/0.5)] bg-[oklch(0.55_0.25_258/0.15)] text-[oklch(0.85_0.15_258)]"
                : "border-[oklch(0.55_0.28_310/0.5)] bg-[oklch(0.55_0.28_310/0.15)] text-[oklch(0.85_0.18_310)]"
            }
          >
            {project.client_id ? (
              <>
                <Users className="mr-1 h-3 w-3" />
                Client
              </>
            ) : (
              <>
                <Video className="mr-1 h-3 w-3" />
                Média
              </>
            )}
          </Badge>
          <h3 className="mt-3 font-heading text-xl font-light leading-tight tracking-tight">
            {project.name}
          </h3>
          {project.client_name ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {project.client_name}
            </p>
          ) : null}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            className="rounded-md p-2 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            aria-label="Actions"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="glass-panel border-white/10"
          >
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            {project.archived_at ? (
              <DropdownMenuItem onClick={handleRestore}>
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Restaurer
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="mr-2 h-4 w-4" />
                Archiver
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer définitivement
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {project.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
          {project.description}
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Video className="h-3.5 w-3.5" />
          {project.episode_count} émission{project.episode_count > 1 ? "s" : ""}
        </span>
        <span className="inline-flex items-center gap-1">
          <Briefcase className="h-3.5 w-3.5" />
          {project.mission_count} mission{project.mission_count > 1 ? "s" : ""}
        </span>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <EditProjectDialog
          project={project}
          clients={clients}
          onSuccess={() => setEditOpen(false)}
        />
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DeleteProjectDialog
          project={project}
          onOpenChange={setDeleteOpen}
        />
      </Dialog>
    </div>
  );
}

function AddProjectDialog({
  clients,
  onSuccess,
}: {
  clients: ClientOption[];
  onSuccess: () => void;
}) {
  const [kind, setKind] = useState<Kind>("media");
  const [clientId, setClientId] = useState<string>("");

  const [state, formAction, pending] = useActionState<
    CreateProjectState,
    FormData
  >(async (prev, fd) => {
    fd.set("kind", kind);
    fd.set("client_id", kind === "client" ? clientId : "");
    const result = await createProject(prev, fd);
    if (result?.ok) {
      onSuccess();
      setKind("media");
      setClientId("");
    }
    return result;
  }, null);

  return (
    <DialogContent className="glass-panel border-white/10 sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl font-light">
          Nouveau projet
        </DialogTitle>
        <DialogDescription>
          Choisis s'il est lié à un client ou destiné à votre propre média.
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label>Type de projet</Label>
          <div className="grid grid-cols-2 gap-2">
            <TypeChip
              active={kind === "media"}
              onClick={() => setKind("media")}
              icon={<Video className="h-4 w-4" />}
              label="Média (interne)"
              hint="Pas de client, production pour vos propres médias"
            />
            <TypeChip
              active={kind === "client"}
              onClick={() => setKind("client")}
              icon={<Users className="h-4 w-4" />}
              label="Client"
              hint="Livré dans le hub d'un client"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-name">Nom du projet</Label>
          <Input
            id="project-name"
            name="name"
            autoFocus
            required
            placeholder="Ex: Histwa, Saison 2"
            className="h-11 bg-white/[0.03]"
          />
        </div>

        {kind === "client" ? (
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-11 bg-white/[0.03]">
                <SelectValue placeholder="Sélectionne un client…" />
              </SelectTrigger>
              <SelectContent>
                {clients.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Aucun client. Crée-en un depuis l'onglet Équipe.
                  </div>
                ) : (
                  clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                        c.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="project-description">Description (optionnel)</Label>
          <textarea
            id="project-description"
            name="description"
            rows={3}
            placeholder="Contexte, brief général, notes…"
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
              "Créer le projet"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function EditProjectDialog({
  project,
  clients,
  onSuccess,
}: {
  project: Project;
  clients: ClientOption[];
  onSuccess: () => void;
}) {
  const [kind, setKind] = useState<Kind>(project.client_id ? "client" : "media");
  const [clientId, setClientId] = useState<string>(project.client_id ?? "");

  const [state, formAction, pending] = useActionState<
    UpdateProjectState,
    FormData
  >(async (prev, fd) => {
    fd.set("kind", kind);
    fd.set("client_id", kind === "client" ? clientId : "");
    const result = await updateProject(project.id, prev, fd);
    if (result?.ok) onSuccess();
    return result;
  }, null);

  return (
    <DialogContent className="glass-panel border-white/10 sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl font-light">
          Modifier le projet
        </DialogTitle>
      </DialogHeader>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label>Type de projet</Label>
          <div className="grid grid-cols-2 gap-2">
            <TypeChip
              active={kind === "media"}
              onClick={() => setKind("media")}
              icon={<Video className="h-4 w-4" />}
              label="Média (interne)"
            />
            <TypeChip
              active={kind === "client"}
              onClick={() => setKind("client")}
              icon={<Users className="h-4 w-4" />}
              label="Client"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-project-name">Nom</Label>
          <Input
            id="edit-project-name"
            name="name"
            defaultValue={project.name}
            required
            className="h-11 bg-white/[0.03]"
          />
        </div>

        {kind === "client" ? (
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-11 bg-white/[0.03]">
                <SelectValue placeholder="Sélectionne un client…" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                      c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="edit-project-description">Description</Label>
          <textarea
            id="edit-project-description"
            name="description"
            rows={3}
            defaultValue={project.description ?? ""}
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

function DeleteProjectDialog({
  project,
  onOpenChange,
}: {
  project: Project;
  onOpenChange: (v: boolean) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirmed = confirmation.trim().toLowerCase() === "supprimer";

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await deleteProject(project.id);
      if (!r.ok) setError(r.error);
      else {
        setConfirmation("");
        onOpenChange(false);
      }
    });
  }

  return (
    <DialogContent className="glass-panel border-white/10 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl font-light">
          Supprimer définitivement ?
        </DialogTitle>
        <DialogDescription>
          <strong className="text-foreground">{project.name}</strong>, ses
          émissions, ses missions et tous ses fichiers seront perdus.
          Action irréversible.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="confirm-del-project">
          Tape <span className="font-mono text-foreground">supprimer</span> pour
          confirmer
        </Label>
        <Input
          id="confirm-del-project"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          className="h-11 bg-white/[0.03]"
          autoComplete="off"
          autoFocus
        />
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
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          Annuler
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending || !confirmed}
          onClick={submit}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Suppression…
            </>
          ) : (
            "Supprimer définitivement"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function TypeChip({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-xl border border-primary/60 bg-primary/10 p-3 text-left transition-all"
          : "rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition-all hover:border-white/20 hover:bg-white/[0.04]"
      }
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </div>
      {hint ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </button>
  );
}

