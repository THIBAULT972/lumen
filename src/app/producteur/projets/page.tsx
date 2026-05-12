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
  producteur_ids: string[];
  created_at: string;
};

export type ClientOption = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

export type ProducteurOption = {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user!.id;

  const [
    projectsRes,
    clientsRes,
    producteursRes,
    episodesRes,
    missionsRes,
    ppRes,
  ] = await Promise.all([
    // RLS filters to projects where the current user is assigned (or is
    // a client of the project — irrelevant here since we're on /producteur).
    supabase
      .from("projects")
      .select("id, name, description, client_id, archived_at, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .eq("role", "client")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .eq("role", "producteur")
      .order("first_name", { ascending: true }),
    supabase.from("episodes").select("id, project_id"),
    supabase.from("missions").select("id, episode_id"),
    supabase.from("project_producteurs").select("project_id, user_id"),
  ]);

  const rawProjects = projectsRes.data ?? [];
  const clients: ClientOption[] = clientsRes.data ?? [];
  const producteurs: ProducteurOption[] = producteursRes.data ?? [];
  const episodes = episodesRes.data ?? [];
  const missions = missionsRes.data ?? [];
  const pp = ppRes.data ?? [];

  const episodeIdsByProject = new Map<string, Set<string>>();
  for (const ep of episodes) {
    if (!episodeIdsByProject.has(ep.project_id)) {
      episodeIdsByProject.set(ep.project_id, new Set());
    }
    episodeIdsByProject.get(ep.project_id)!.add(ep.id);
  }

  const producteurIdsByProject = new Map<string, string[]>();
  for (const row of pp) {
    if (!producteurIdsByProject.has(row.project_id)) {
      producteurIdsByProject.set(row.project_id, []);
    }
    producteurIdsByProject.get(row.project_id)!.push(row.user_id);
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
      producteur_ids: producteurIdsByProject.get(p.id) ?? [],
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
        producteurs={producteurs}
        currentUserId={currentUserId}
        showArchived={showArchived}
        archivedCount={projects.filter((p) => p.archived_at !== null).length}
        activeCount={projects.filter((p) => p.archived_at === null).length}
      />
    </>
  );
}
