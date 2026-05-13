import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Video, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import type { EpisodeStatus } from "../episode-types";
import type { MissionStatus } from "../mission-types";
import type { FileRecord, FileTarget } from "../file-types";
import { ProjetWorkspace } from "./projet-workspace";
import type { Mission } from "./missions-section";

export type Episode = {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  status: EpisodeStatus;
  format: string | null;
  production_date: string | null;
  production_time: string | null;
  duration_minutes: number | null;
  publication_date: string | null;
  location: string | null;
  guests: string[];
  equipment: string[];
  platforms: string[];
  notes: string | null;
  mission_count: number;
  missions: Mission[];
  files: FileRecord[];
};

export type Platform = { id: string; name: string };
export type Skill = { id: string; name: string };

export default async function ProjetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    projectRes,
    episodesRes,
    missionsRes,
    clientsRes,
    platformsRes,
    skillsRes,
    filesRes,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, description, client_id, archived_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("episodes")
      .select(
        "id, name, description, order_index, status, format, production_date, production_time, duration_minutes, publication_date, location, guests, equipment, platforms, notes",
      )
      .eq("project_id", id)
      .order("order_index", { ascending: true }),
    supabase
      .from("missions")
      .select(
        "id, episode_id, required_skill_id, title, description, location, scheduled_at, duration_minutes, price_cents, status, contact_name, contact_phone, accepted_by",
      )
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .eq("role", "client"),
    supabase
      .from("platforms")
      .select("id, name")
      .order("name", { ascending: true }),
    supabase.from("skills").select("id, name").order("name"),
    supabase
      .from("files")
      .select(
        "id, storage_path, filename, mime_type, size_bytes, target, project_id, episode_id, mission_id, destination_user_id, uploaded_by, created_at",
      )
      .eq("target", "episode")
      .order("created_at", { ascending: false }),
  ]);

  if (!projectRes.data) notFound();
  const project = projectRes.data;

  if (episodesRes.error) {
    console.error(
      "[page projet] failed to load episodes:",
      episodesRes.error.message,
      episodesRes.error.hint,
    );
  }
  if (platformsRes.error) {
    console.error(
      "[page projet] failed to load platforms:",
      platformsRes.error.message,
    );
  }

  const missionsRaw = missionsRes.data ?? [];
  const platforms: Platform[] = platformsRes.data ?? [];
  const skills: Skill[] = skillsRes.data ?? [];
  const allFiles: FileRecord[] = (filesRes.data ?? []).map((f) => ({
    id: f.id,
    storage_path: f.storage_path,
    filename: f.filename,
    mime_type: f.mime_type,
    size_bytes: f.size_bytes,
    target: f.target as FileTarget,
    project_id: f.project_id,
    episode_id: f.episode_id,
    mission_id: f.mission_id,
    destination_user_id: f.destination_user_id,
    uploaded_by: f.uploaded_by,
    created_at: f.created_at,
  }));
  const episodesError = episodesRes.error?.message ?? null;
  const missions: Mission[] = missionsRaw.map((m) => ({
    id: m.id,
    episode_id: m.episode_id,
    required_skill_id: m.required_skill_id,
    title: m.title,
    description: m.description,
    location: m.location,
    scheduled_at: m.scheduled_at,
    duration_minutes: m.duration_minutes,
    price_cents: m.price_cents ?? 0,
    status: (m.status ?? "draft") as MissionStatus,
    contact_name: m.contact_name ?? null,
    contact_phone: m.contact_phone ?? null,
    accepted_by: m.accepted_by ?? null,
  }));
  const episodes: Episode[] = (episodesRes.data ?? []).map((e) => {
    const episodeMissions = missions.filter((m) => m.episode_id === e.id);
    const episodeFiles = allFiles.filter((f) => f.episode_id === e.id);
    return {
      id: e.id,
      name: e.name,
      description: e.description,
      order_index: e.order_index,
      status: (e.status ?? "idea") as EpisodeStatus,
      format: e.format,
      production_date: e.production_date,
      production_time: e.production_time,
      duration_minutes: e.duration_minutes,
      publication_date: e.publication_date,
      location: e.location,
      guests: Array.isArray(e.guests) ? e.guests : [],
      equipment: Array.isArray(e.equipment) ? e.equipment : [],
      platforms: Array.isArray(e.platforms) ? e.platforms : [],
      notes: e.notes,
      mission_count: episodeMissions.length,
      missions: episodeMissions,
      files: episodeFiles,
    };
  });

  const clients = clientsRes.data ?? [];
  const client = project.client_id
    ? clients.find((c) => c.id === project.client_id) ?? null
    : null;
  const clientName = client
    ? [client.first_name, client.last_name].filter(Boolean).join(" ") ||
      client.email
    : null;

  return (
    <>
      <Link
        href="/producteur/projets"
        className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Retour aux projets
      </Link>

      <section className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
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
                Projet client
              </>
            ) : (
              <>
                <Video className="mr-1 h-3 w-3" />
                Projet média (interne)
              </>
            )}
          </Badge>

          {project.archived_at ? (
            <Badge variant="secondary" className="ml-2">
              Archivé
            </Badge>
          ) : null}

          <h1 className="mt-3 font-heading text-4xl font-light tracking-tight">
            {project.name}
          </h1>
          {clientName ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Client : <span className="text-foreground">{clientName}</span>
            </p>
          ) : null}
          {project.description ? (
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              {project.description}
            </p>
          ) : null}
        </div>

        <Link
          href={`/producteur/projets/${project.id}/board`}
          className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-md border border-border bg-secondary/40 px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <Sparkles className="h-4 w-4" />
          Espace de création
        </Link>
      </section>

      {episodesError ? (
        <div className="glass-panel rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
          <p className="font-medium text-destructive">
            Impossible de charger les émissions.
          </p>
          <p className="mt-1 text-muted-foreground">
            <code className="font-mono">{episodesError}</code>
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Si tu viens d'ajouter une nouvelle fonctionnalité côté code, une
            migration SQL est probablement à appliquer dans Supabase
            (dossier <code className="font-mono">db/migrations/</code>).
          </p>
        </div>
      ) : (
        <ProjetWorkspace
          projectId={project.id}
          episodes={episodes}
          availablePlatforms={platforms}
          availableSkills={skills}
        />
      )}
    </>
  );
}
