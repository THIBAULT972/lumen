import { createClient } from "@/lib/supabase/server";
import { ProjetsManager } from "./projets-manager";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  client_id: string | null;
  client_name: string | null;
  archived_at: string | null;
  episode_count: number;
  mission_count: number;
  created_at: string;
};

export type ClientOption = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

export default async function ProjetsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const sp = await searchParams;
  const showArchived = sp.archived === "1";

  const supabase = await createClient();

  const [projectsRes, clientsRes, episodesRes, missionsRes] = await Promise.all(
    [
      supabase
        .from("projects")
        .select("id, name, description, client_id, archived_at, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .eq("role", "client")
        .order("created_at", { ascending: false }),
      supabase.from("episodes").select("id, project_id"),
      supabase.from("missions").select("id, episode_id"),
    ],
  );

  const rawProjects = projectsRes.data ?? [];
  const clients: ClientOption[] = clientsRes.data ?? [];
  const episodes = episodesRes.data ?? [];
  const missions = missionsRes.data ?? [];

  const episodeIdsByProject = new Map<string, Set<string>>();
  for (const ep of episodes) {
    if (!episodeIdsByProject.has(ep.project_id)) {
      episodeIdsByProject.set(ep.project_id, new Set());
    }
    episodeIdsByProject.get(ep.project_id)!.add(ep.id);
  }

  const projects: Project[] = rawProjects.map((p) => {
    const epIds = episodeIdsByProject.get(p.id) ?? new Set<string>();
    const client = p.client_id
      ? clients.find((c) => c.id === p.client_id)
      : null;
    const clientName = client
      ? [client.first_name, client.last_name].filter(Boolean).join(" ") ||
        client.email
      : null;

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      client_id: p.client_id,
      client_name: clientName,
      archived_at: p.archived_at,
      episode_count: epIds.size,
      mission_count: missions.filter((m) => epIds.has(m.episode_id)).length,
      created_at: p.created_at,
    };
  });

  const visible = projects.filter((p) =>
    showArchived ? p.archived_at !== null : p.archived_at === null,
  );

  return (
    <>
      <section className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
          Studio · Production
        </p>
        <h1 className="mt-3 font-heading text-4xl font-light tracking-tight">
          Projets
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Chaque projet regroupe une série d'émissions, leurs dates, leurs
          missions et leurs livrables. Lie-le à un client, ou garde-le interne
          pour vos propres médias.
        </p>
      </section>

      <ProjetsManager
        projects={visible}
        clients={clients}
        showArchived={showArchived}
        archivedCount={projects.filter((p) => p.archived_at !== null).length}
        activeCount={projects.filter((p) => p.archived_at === null).length}
      />
    </>
  );
}
