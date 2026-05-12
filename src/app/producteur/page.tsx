import {
  Briefcase,
  FolderOpen,
  Users,
  UserCircle,
  CalendarDays,
  Bell,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";

export default async function ProducteurPage() {
  const supabase = await createClient();

  // Auth + role guard handled by /producteur/layout.tsx.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileRes, projectsRes, missionsRes, prestatairesRes, clientsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", user!.id)
        .single(),
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null),
      supabase
        .from("missions")
        .select("id", { count: "exact", head: true })
        .in("status", ["broadcast", "accepted", "in_progress"]),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "prestataire"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "client"),
    ]);

  const displayName =
    [profileRes.data?.first_name, profileRes.data?.last_name]
      .filter(Boolean)
      .join(" ") || profileRes.data?.email || "Producteur";

  return (
    <>
      <section className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
          Studio · Vue d'ensemble
        </p>
        <h1 className="mt-3 font-heading text-4xl font-light tracking-tight">
          Bienvenue, <span className="text-gradient-neon">{displayName}</span>.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Pilote tes projets, dispatche tes missions et garde un œil sur toute
          l'équipe depuis cet espace.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FolderOpen}
          label="Projets actifs"
          value={String(projectsRes.count ?? 0)}
          hint={(projectsRes.count ?? 0) === 0 ? "Aucun projet pour l'instant" : undefined}
        />
        <StatCard
          icon={Briefcase}
          label="Missions en cours"
          value={String(missionsRes.count ?? 0)}
          hint={(missionsRes.count ?? 0) === 0 ? "Aucune mission active" : undefined}
        />
        <StatCard
          icon={Users}
          label="Prestataires"
          value={String(prestatairesRes.count ?? 0)}
        />
        <StatCard
          icon={UserCircle}
          label="Clients"
          value={String(clientsRes.count ?? 0)}
        />
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-3">
        <PlaceholderCard
          icon={CalendarDays}
          title="Calendrier"
          body="Visualise tes dates de production et de parution, filtrées par projet."
          eta="Phase 4"
        />
        <PlaceholderCard
          icon={Briefcase}
          title="Dispatch de missions"
          body="Crée une mission, choisis la compétence requise, envoie-la à tous les prestataires concernés."
          eta="Phase 2.3"
        />
        <PlaceholderCard
          icon={Bell}
          title="Notifications temps réel"
          body="Sois alerté dès qu'un prestataire accepte ou refuse une mission."
          eta="Phase 4"
        />
      </section>
    </>
  );
}

function PlaceholderCard({
  icon: Icon,
  title,
  body,
  eta,
}: {
  icon: typeof CalendarDays;
  title: string;
  body: string;
  eta: string;
}) {
  return (
    <div className="glass-panel relative overflow-hidden rounded-2xl p-6">
      <div className="absolute right-4 top-4 rounded-full border border-foreground/10 bg-foreground/[0.03] px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {eta}
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/[0.03]">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <h3 className="mt-5 font-heading text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
