"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  createSkill,
  deleteSkill,
  renameSkill,
  type CreateSkillState,
} from "./actions";
import type { SkillWithUsage } from "./page";

export function CompetencesManager({ skills }: { skills: SkillWithUsage[] }) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {skills.length} compétence{skills.length > 1 ? "s" : ""}
        </p>
        <Button
          className="bg-gradient-neon text-white"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une compétence
        </Button>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <AddSkillDialog onSuccess={() => setAddOpen(false)} />
        </Dialog>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead>Nom</TableHead>
              <TableHead>Prestataires</TableHead>
              <TableHead>Missions</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skills.length === 0 ? (
              <TableRow className="border-white/[0.06]">
                <TableCell
                  colSpan={4}
                  className="py-12 text-center text-muted-foreground"
                >
                  Aucune compétence pour le moment.
                </TableCell>
              </TableRow>
            ) : (
              skills.map((s) => <SkillRow key={s.id} skill={s} />)
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function AddSkillDialog({ onSuccess }: { onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState<
    CreateSkillState,
    FormData
  >(async (prev, fd) => {
    const result = await createSkill(prev, fd);
    if (result?.ok) {
      onSuccess();
    }
    return result;
  }, null);

  return (
    <DialogContent className="glass-panel border-white/10 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl font-light">
          Nouvelle compétence
        </DialogTitle>
        <DialogDescription>
          Visible dans la liste des compétences attribuables aux prestataires.
        </DialogDescription>
      </DialogHeader>
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="skill-name">Nom</Label>
          <Input
            id="skill-name"
            name="name"
            placeholder="Ex: Cadreur 4K"
            autoFocus
            required
            maxLength={60}
            className="h-11 bg-white/[0.03]"
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
              "Créer"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function SkillRow({ skill }: { skill: SkillWithUsage }) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <TableRow className="border-white/[0.06] hover:bg-white/[0.02]">
      <TableCell className="font-medium">{skill.name}</TableCell>
      <TableCell>
        {skill.prestataire_count > 0 ? (
          <Badge variant="secondary">{skill.prestataire_count}</Badge>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </TableCell>
      <TableCell>
        {skill.mission_count > 0 ? (
          <Badge variant="secondary">{skill.mission_count}</Badge>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-md p-2 transition-colors hover:bg-white/[0.06]"
            aria-label="Actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-panel border-white/10">
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Renommer
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <RenameDialog
          skill={skill}
          open={renameOpen}
          onOpenChange={setRenameOpen}
        />
        <DeleteDialog
          skill={skill}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      </TableCell>
    </TableRow>
  );
}

function RenameDialog({
  skill,
  open,
  onOpenChange,
}: {
  skill: SkillWithUsage;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState(skill.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await renameSkill(skill.id, name);
      if (!r.ok) setError(r.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-light">
            Renommer la compétence
          </DialogTitle>
          <DialogDescription>
            « {skill.name} » deviendra le nouveau nom partout dans l'app.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-name">Nouveau nom</Label>
            <Input
              id="rename-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              maxLength={60}
              className="h-11 bg-white/[0.03]"
            />
          </div>
          {error ? (
            <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending || name === skill.name}>
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
    </Dialog>
  );
}

function DeleteDialog({
  skill,
  open,
  onOpenChange,
}: {
  skill: SkillWithUsage;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await deleteSkill(skill.id);
      if (!r.ok) setError(r.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-light">
            Supprimer « {skill.name} » ?
          </DialogTitle>
          <DialogDescription>
            Action irréversible. La compétence ne sera supprimée que si elle
            n'est plus liée à aucun prestataire ni à aucune mission.
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
            onClick={submit}
            disabled={pending}
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
    </Dialog>
  );
}
