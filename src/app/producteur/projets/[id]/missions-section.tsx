"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Briefcase,
  CalendarDays,
  Clock,
  MapPin,
  Wallet,
  Phone,
  User,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  MoreHorizontal,
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
  createMission,
  updateMission,
  deleteMission,
} from "../actions";
import type { MissionPayload, MissionStatus } from "../mission-types";
import type { Skill } from "./page";
import { MissionStatusBadge } from "./mission-status-badge";

export type Mission = {
  id: string;
  episode_id: string;
  required_skill_id: string;
  title: string;
  description: string | null;
  location: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  price_cents: number;
  status: MissionStatus;
  contact_name: string | null;
  contact_phone: string | null;
  accepted_by: string | null;
};

function isoToDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "America/Martinique",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function isoToTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "America/Martinique",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function MissionsSection({
  episodeId,
  projectId,
  missions,
  skills,
}: {
  episodeId: string;
  projectId: string;
  missions: Mission[];
  skills: Skill[];
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <Briefcase className="h-3.5 w-3.5" />
          Missions
          <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">
            · {missions.length}
          </span>
        </Label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setAddOpen(true)}
          className="h-8 gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Mandater un prestataire
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <MissionDialog
          mode="create"
          episodeId={episodeId}
          projectId={projectId}
          skills={skills}
          onSuccess={() => setAddOpen(false)}
        />
      </Dialog>

      {missions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-foreground/[0.02] p-6 text-center">
          <Briefcase className="mx-auto h-5 w-5 text-muted-foreground/60" />
          <p className="mt-2 text-xs text-muted-foreground">
            Aucune mission pour cette émission. Mandate un prestataire pour
            organiser le tournage.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {missions.map((m) => (
            <MissionCard
              key={m.id}
              mission={m}
              projectId={projectId}
              skills={skills}
              episodeId={episodeId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MissionCard({
  mission,
  projectId,
  skills,
  episodeId,
}: {
  mission: Mission;
  projectId: string;
  skills: Skill[];
  episodeId: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const skill = skills.find((s) => s.id === mission.required_skill_id);
  const skillName = skill?.name ?? "—";

  return (
    <li className="rounded-xl border border-border bg-foreground/[0.02] p-3 transition-colors hover:bg-foreground/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <MissionStatusBadge status={mission.status} compact />
            <span className="text-[11px] uppercase tracking-wider text-foreground/80">
              {skillName}
            </span>
          </div>
          <p className="mt-1.5 truncate text-sm font-medium leading-tight">
            {mission.title}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {new Date(mission.scheduled_at).toLocaleDateString("fr-FR", {
                timeZone: "America/Martinique",
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isoToTime(mission.scheduled_at)}
              {mission.duration_minutes
                ? ` · ${mission.duration_minutes} min`
                : ""}
            </span>
            {mission.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {mission.location}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              {formatPrice(mission.price_cents)}
            </span>
          </div>

          {mission.contact_name || mission.contact_phone ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {mission.contact_name ? (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {mission.contact_name}
                </span>
              ) : null}
              {mission.contact_phone ? (
                <a
                  href={`tel:${mission.contact_phone}`}
                  className="inline-flex items-center gap-1 text-foreground/80 transition-colors hover:text-primary"
                >
                  <Phone className="h-3 w-3" />
                  {mission.contact_phone}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled
            title="Bientôt : envoyer aux prestataires de la compétence"
            className="hidden h-8 gap-1.5 text-xs md:inline-flex"
          >
            <Send className="h-3 w-3" />
            Envoyer
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-md p-1.5 transition-colors hover:bg-foreground/[0.06]"
              aria-label="Actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-foreground/10"
            >
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
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
        </div>
      </div>

      {mission.description ? (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {mission.description}
        </p>
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <MissionDialog
          mode="edit"
          episodeId={episodeId}
          projectId={projectId}
          skills={skills}
          existing={mission}
          onSuccess={() => setEditOpen(false)}
        />
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DeleteMissionDialog
          mission={mission}
          projectId={projectId}
          onOpenChange={setDeleteOpen}
        />
      </Dialog>
    </li>
  );
}

function MissionDialog({
  mode,
  episodeId,
  projectId,
  skills,
  existing,
  onSuccess,
}: {
  mode: "create" | "edit";
  episodeId: string;
  projectId: string;
  skills: Skill[];
  existing?: Mission;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<MissionPayload>(() =>
    existing
      ? {
          required_skill_id: existing.required_skill_id,
          title: existing.title,
          description: existing.description,
          location: existing.location,
          scheduled_date: isoToDate(existing.scheduled_at),
          scheduled_time: isoToTime(existing.scheduled_at),
          duration_minutes: existing.duration_minutes,
          price_euros:
            existing.price_cents > 0 ? existing.price_cents / 100 : null,
          contact_name: existing.contact_name,
          contact_phone: existing.contact_phone,
        }
      : {
          required_skill_id: skills[0]?.id ?? "",
          title: "",
          description: null,
          location: null,
          scheduled_date: "",
          scheduled_time: null,
          duration_minutes: null,
          price_euros: null,
          contact_name: null,
          contact_phone: null,
        },
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof MissionPayload>(
    key: K,
    value: MissionPayload[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const r =
        mode === "create"
          ? await createMission(episodeId, projectId, form)
          : existing
            ? await updateMission(existing.id, projectId, form)
            : { ok: false as const, error: "État invalide." };
      if (!r.ok) {
        setError(r.error);
      } else {
        onSuccess();
      }
    });
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto border-foreground/10 sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl font-light">
          {mode === "create" ? "Mandater un prestataire" : "Modifier la mission"}
        </DialogTitle>
        <DialogDescription>
          Les infos saisies ici seront partagées avec le prestataire qui accepte
          la mission.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Compétence requise" required>
            <Select
              value={form.required_skill_id}
              onValueChange={(v) => update("required_skill_id", v ?? "")}
            >
              <SelectTrigger className="h-11 bg-foreground/[0.03]">
                <SelectValue placeholder="Choisis…" />
              </SelectTrigger>
              <SelectContent>
                {skills.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Aucune compétence. Ajoute-en depuis l'onglet Compétences.
                  </div>
                ) : (
                  skills.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Titre" required>
            <Input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Ex: Captation drone Sainte-Anne"
              required
              className="h-11 bg-foreground/[0.03]"
            />
          </Field>
        </div>

        <Field label="Date et heure de tournage" required>
          <div className="grid grid-cols-3 gap-2">
            <Input
              type="date"
              value={form.scheduled_date}
              onChange={(e) => update("scheduled_date", e.target.value)}
              className="h-11 bg-foreground/[0.03]"
              required
            />
            <Input
              type="time"
              value={form.scheduled_time ?? ""}
              onChange={(e) =>
                update("scheduled_time", e.target.value || null)
              }
              className="h-11 bg-foreground/[0.03]"
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
                className="h-11 bg-foreground/[0.03] pr-12"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                min
              </span>
            </div>
          </div>
        </Field>

        <Field label="Lieu de tournage">
          <Input
            value={form.location ?? ""}
            onChange={(e) => update("location", e.target.value)}
            placeholder="Adresse ou nom du lieu"
            className="h-11 bg-foreground/[0.03]"
          />
        </Field>

        <Field label="Prix de la prestation (€)">
          <Input
            type="number"
            min={0}
            step={1}
            value={form.price_euros ?? ""}
            onChange={(e) =>
              update(
                "price_euros",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            placeholder="100"
            className="h-11 bg-foreground/[0.03] sm:max-w-[10rem]"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact sur place — nom">
            <Input
              value={form.contact_name ?? ""}
              onChange={(e) => update("contact_name", e.target.value)}
              placeholder="Référent producteur"
              className="h-11 bg-foreground/[0.03]"
            />
          </Field>
          <Field label="Contact sur place — téléphone">
            <Input
              type="tel"
              value={form.contact_phone ?? ""}
              onChange={(e) => update("contact_phone", e.target.value)}
              placeholder="+596 696 …"
              className="h-11 bg-foreground/[0.03]"
            />
          </Field>
        </div>

        <Field label="Brief / informations de tournage">
          <textarea
            value={form.description ?? ""}
            onChange={(e) => update("description", e.target.value)}
            rows={4}
            placeholder="Ce qu'il faut tourner, ambiance, contraintes, équipement particulier…"
            className="w-full rounded-lg border border-foreground/10 bg-foreground/[0.03] p-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>

        {error ? (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <Button
          type="button"
          className="bg-gradient-neon text-white"
          disabled={pending}
          onClick={submit}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === "create" ? "Création…" : "Enregistrement…"}
            </>
          ) : mode === "create" ? (
            "Créer la mission"
          ) : (
            "Enregistrer"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function DeleteMissionDialog({
  mission,
  projectId,
  onOpenChange,
}: {
  mission: Mission;
  projectId: string;
  onOpenChange: (v: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await deleteMission(mission.id, projectId);
      if (!r.ok) setError(r.error);
      else onOpenChange(false);
    });
  }

  return (
    <DialogContent className="border-foreground/10 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl font-light">
          Supprimer la mission ?
        </DialogTitle>
        <DialogDescription>
          <strong className="text-foreground">{mission.title}</strong> sera
          supprimée. Action irréversible.
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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
