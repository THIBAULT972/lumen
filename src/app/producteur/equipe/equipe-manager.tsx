"use client";

import {
  useActionState,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  KeyRound,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Users,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createMember,
  deleteMember,
  regeneratePassword,
  updateMember,
  type CreateMemberState,
  type UpdateMemberState,
} from "./actions";
import type { Member, Skill } from "./page";

type GeneratedPassword = {
  email: string;
  password: string;
  source: "create" | "regen";
};

export function EquipeManager({
  prestataires,
  clients,
  skills,
}: {
  prestataires: Member[];
  clients: Member[];
  skills: Skill[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [generated, setGenerated] = useState<GeneratedPassword | null>(null);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {prestataires.length} prestataire{prestataires.length > 1 ? "s" : ""}{" "}
          · {clients.length} client{clients.length > 1 ? "s" : ""}
        </p>
        <Button
          className="bg-gradient-neon text-white"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un membre
        </Button>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <AddMemberDialog
            skills={skills}
            onSuccess={(generated) => {
              setAddOpen(false);
              setGenerated(generated);
            }}
          />
        </Dialog>
      </div>

      <TeamSection
        icon={<Users className="h-4 w-4" />}
        title="Prestataires"
        members={prestataires}
        skills={skills}
        showSkills
        onPasswordRegenerated={setGenerated}
      />

      <div className="mt-10">
        <TeamSection
          icon={<UserCircle className="h-4 w-4" />}
          title="Clients"
          members={clients}
          skills={skills}
          showSkills={false}
          onPasswordRegenerated={setGenerated}
        />
      </div>

      <PasswordDialog
        generated={generated}
        onClose={() => setGenerated(null)}
      />
    </>
  );
}

function TeamSection({
  icon,
  title,
  members,
  skills,
  showSkills,
  onPasswordRegenerated,
}: {
  icon: ReactNode;
  title: string;
  members: Member[];
  skills: Skill[];
  showSkills: boolean;
  onPasswordRegenerated: (g: GeneratedPassword) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="font-heading text-lg font-light tracking-wide">
          {title}
        </h2>
        <span className="ml-1 text-xs text-muted-foreground">
          · {members.length}
        </span>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              {showSkills ? <TableHead>Compétences</TableHead> : null}
              <TableHead>Ajouté le</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow className="border-white/[0.06]">
                <TableCell
                  colSpan={showSkills ? 5 : 4}
                  className="py-12 text-center text-muted-foreground"
                >
                  Aucun membre dans cette catégorie.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  skills={skills}
                  showSkills={showSkills}
                  onPasswordRegenerated={onPasswordRegenerated}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function MemberRow({
  member,
  skills,
  showSkills,
  onPasswordRegenerated,
}: {
  member: Member;
  skills: Skill[];
  showSkills: boolean;
  onPasswordRegenerated: (g: GeneratedPassword) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenPending, startRegen] = useTransition();

  const displayName =
    [member.first_name, member.last_name].filter(Boolean).join(" ") || "—";

  const memberSkills = member.skill_ids
    .map((id) => skills.find((s) => s.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  const isBanned =
    member.banned_until && new Date(member.banned_until) > new Date();

  function handleRegen() {
    if (regenPending) return;
    startRegen(async () => {
      const r = await regeneratePassword(member.id);
      if (r.ok) {
        onPasswordRegenerated({
          email: member.email,
          password: r.password,
          source: "regen",
        });
      } else {
        alert(r.error);
      }
    });
  }

  return (
    <TableRow className="border-white/[0.06] hover:bg-white/[0.02]">
      <TableCell className="font-medium">
        {displayName}
        {isBanned ? (
          <span className="ml-2 inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive">
            Pénalité
          </span>
        ) : null}
      </TableCell>
      <TableCell className="text-muted-foreground">{member.email}</TableCell>
      {showSkills ? (
        <TableCell>
          {memberSkills.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {memberSkills.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </TableCell>
      ) : null}
      <TableCell className="text-muted-foreground">
        {new Date(member.created_at).toLocaleDateString("fr-FR")}
      </TableCell>
      <TableCell>
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
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={regenPending}
              onSelect={(e) => {
                e.preventDefault();
                handleRegen();
              }}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {regenPending ? "Génération…" : "Régénérer le mot de passe"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <EditMemberDialog
          member={member}
          skills={skills}
          showSkills={showSkills}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
        <DeleteMemberDialog
          member={member}
          displayName={displayName === "—" ? member.email : displayName}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      </TableCell>
    </TableRow>
  );
}

function AddMemberDialog({
  skills,
  onSuccess,
}: {
  skills: Skill[];
  onSuccess: (g: GeneratedPassword) => void;
}) {
  const [role, setRole] = useState<"prestataire" | "client">("prestataire");
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());

  const [state, formAction, pending] = useActionState<
    CreateMemberState,
    FormData
  >(async (prev, fd) => {
    // Inject role + skills from local state since Select doesn't natively post.
    fd.set("role", role);
    fd.delete("skill_ids");
    if (role === "prestataire") {
      for (const id of selectedSkills) fd.append("skill_ids", id);
    }
    const result = await createMember(prev, fd);
    if (result?.ok) {
      onSuccess({
        email: result.email,
        password: result.password,
        source: "create",
      });
      setSelectedSkills(new Set());
      setRole("prestataire");
    }
    return result;
  }, null);

  function toggleSkill(id: string) {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <DialogContent className="glass-panel border-white/10 sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl font-light">
          Nouveau membre
        </DialogTitle>
        <DialogDescription>
          Le mot de passe sera généré et affiché une seule fois après création.
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="first_name">Prénom</Label>
            <Input
              id="first_name"
              name="first_name"
              autoComplete="off"
              className="h-11 bg-white/[0.03]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Nom</Label>
            <Input
              id="last_name"
              name="last_name"
              autoComplete="off"
              className="h-11 bg-white/[0.03]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="prenom@exemple.com"
            className="h-11 bg-white/[0.03]"
          />
        </div>

        <div className="space-y-2">
          <Label>Rôle</Label>
          <Select
            value={role}
            onValueChange={(v) => setRole(v as "prestataire" | "client")}
          >
            <SelectTrigger className="h-11 bg-white/[0.03]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prestataire">Prestataire</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {role === "prestataire" ? (
          <div className="space-y-2">
            <Label>Compétences</Label>
            <div className="glass-panel max-h-48 space-y-2 overflow-y-auto rounded-lg p-3">
              {skills.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucune compétence définie. Ajoute-en depuis l'onglet
                  Compétences.
                </p>
              ) : (
                skills.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedSkills.has(s.id)}
                      onCheckedChange={() => toggleSkill(s.id)}
                    />
                    {s.name}
                  </label>
                ))
              )}
            </div>
          </div>
        ) : null}

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
              "Créer le compte"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function EditMemberDialog({
  member,
  skills,
  showSkills,
  open,
  onOpenChange,
}: {
  member: Member;
  skills: Skill[];
  showSkills: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(
    new Set(member.skill_ids),
  );

  const [state, formAction, pending] = useActionState<
    UpdateMemberState,
    FormData
  >(async (prev, fd) => {
    fd.delete("skill_ids");
    if (showSkills) {
      for (const id of selectedSkills) fd.append("skill_ids", id);
    }
    const result = await updateMember(member.id, prev, fd);
    if (result?.ok) onOpenChange(false);
    return result;
  }, null);

  function toggleSkill(id: string) {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-white/10 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-light">
            Modifier le membre
          </DialogTitle>
          <DialogDescription>
            {member.email} — l'email et le rôle ne sont pas modifiables.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit_first_name">Prénom</Label>
              <Input
                id="edit_first_name"
                name="first_name"
                defaultValue={member.first_name ?? ""}
                className="h-11 bg-white/[0.03]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_last_name">Nom</Label>
              <Input
                id="edit_last_name"
                name="last_name"
                defaultValue={member.last_name ?? ""}
                className="h-11 bg-white/[0.03]"
              />
            </div>
          </div>

          {showSkills ? (
            <div className="space-y-2">
              <Label>Compétences</Label>
              <div className="glass-panel max-h-48 space-y-2 overflow-y-auto rounded-lg p-3">
                {skills.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedSkills.has(s.id)}
                      onCheckedChange={() => toggleSkill(s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

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
    </Dialog>
  );
}

function DeleteMemberDialog({
  member,
  displayName,
  open,
  onOpenChange,
}: {
  member: Member;
  displayName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await deleteMember(member.id);
      if (!r.ok) setError(r.error);
      else {
        setConfirmation("");
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setConfirmation("");
          setError(null);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="glass-panel border-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-light">
            Supprimer ce membre ?
          </DialogTitle>
          <DialogDescription>
            <strong className="text-foreground">{displayName}</strong> (
            {member.email}) sera définitivement supprimé. Son accès, ses
            compétences et son historique seront perdus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm">
            Tape <span className="font-mono text-foreground">supprimer</span>{" "}
            pour confirmer
          </Label>
          <Input
            id="confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="h-11 bg-white/[0.03]"
            autoComplete="off"
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
            disabled={pending || confirmation !== "supprimer"}
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
    </Dialog>
  );
}

function PasswordDialog({
  generated,
  onClose,
}: {
  generated: GeneratedPassword | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!generated) return null;

  async function copy() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail on non-HTTPS or unsupported browsers;
      // fall back: select the text instead.
    }
  }

  const title =
    generated.source === "create"
      ? "Compte créé"
      : "Nouveau mot de passe généré";

  return (
    <Dialog open={Boolean(generated)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-panel border-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-light">
            {title}
          </DialogTitle>
          <DialogDescription>
            Copie le mot de passe maintenant et transmets-le à{" "}
            <strong className="text-foreground">{generated.email}</strong>. Il
            ne sera <strong>plus jamais affiché</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-3">
          <code className="flex-1 font-mono text-base text-foreground select-all">
            {generated.password}
          </code>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={copy}
            aria-label="Copier"
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copié
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copier
              </>
            )}
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            J'ai copié, fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
