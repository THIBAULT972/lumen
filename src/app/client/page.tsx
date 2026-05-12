import { redirect } from "next/navigation";
import { FolderOpen, Video, CalendarDays, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/shell";
import { StatCard } from "@/components/dashboard/stat-card";

export default async function ClientPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, email")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.role !== "client") redirect("/");

  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email;

  // RLS filters automatically: this client only sees their own projects.
  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, name, description, archived_at, created_at, episodes(id, name, production_date, publication_date)",
    )
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const projectsList = projects ?? [];
  const totalEpisodes = projectsList.reduce(
    (acc, p) => acc + (p.episodes?.length ?? 0),
    0,
  );

  return (
    <DashboardShell role="Client" userName={displayName}>
      <section className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
          Hub · Espace client
        </p>
        <h1 className="mt-3 font-heading text-4xl font-light tracking-tight">
          Bonjour, <span className="text-gradient-neon">{displayName}</span>.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Suis l'avancement de tes productions et récupère tes livrables ici.
        </p>
      </section>

      <section className="mb-10 grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={FolderOpen}
          label="Projets en cours"
          value={String(projectsList.length)}
        />
        <StatCard
          icon={Video}
          label="Émissions planifiées"
          value={String(totalEpisodes)}
        />
      </section>

      {projectsList.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center">
          <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-4 font-heading text-xl font-light">
            Aucun projet à afficher
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            L'équipe LUMEN te rattachera à un projet dès qu'une production
            commencera pour toi.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-light tracking-wide">
            Tes projets
          </h2>
          {projectsList.map((p) => (
            <div key={p.id} className="glass-panel rounded-2xl p-5">
              <h3 className="font-heading text-lg font-medium">{p.name}</h3>
              {p.description ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.description}
                </p>
              ) : null}

              {p.episodes && p.episodes.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {p.episodes.map((ep) => (
                    <div
                      key={ep.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{ep.name}</span>
                      {ep.production_date ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(ep.production_date).toLocaleDateString(
                            "fr-FR",
                            { timeZone: "America/Martinique" },
                          )}
                        </span>
                      ) : null}
                      {ep.publication_date ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Send className="h-3 w-3" />
                          {new Date(ep.publication_date).toLocaleDateString(
                            "fr-FR",
                            { timeZone: "America/Martinique" },
                          )}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Aucune émission planifiée pour l'instant.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
