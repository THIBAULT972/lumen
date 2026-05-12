import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import type { EpisodeStatus } from "../episode-types";
import { ProjetWorkspace } from "./projet-workspace";

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
};

export type Platform = { id: string; name: string };

export default async function ProjetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [projectRes, episodesRes, missionsRes, clientsRes, platformsRes] =
    await Promise.all([
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
      supabase.from("missions").select("id, episode_id"),
      supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .eq("role", "client"),
      supabase
        .from("platforms")
        .select("id, name")
        .order("name", { ascending: true }),
    ]);

  if (!projectRes.data) notFound();
  const project = projectRes.data;

  const missions = missionsRes.data ?? [];
  const platforms: Platform[] = platformsRes.data ?? [];
  const episodes: Episode[] = (episodesRes.data ?? []).map((e) => ({
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
    mission_count: missions.filter((m) => m.episode_id === e.id).length,
  }));

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
      </section>

      <ProjetWorkspace
        projectId={project.id}
        episodes={episodes}
        availablePlatforms={platforms}
      />
    </>
  );
}
