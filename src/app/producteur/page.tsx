import { redirect } from "next/navigation";
import {
  Briefcase,
  FolderOpen,
  Users,
  UserCircle,
  CalendarDays,
  Bell,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/shell";
import { StatCard } from "@/components/dashboard/stat-card";

export default async function ProducteurPage() {
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
  if (profile.role !== "producteur") redirect("/");

  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email;

  return (
    <DashboardShell role="Producteur" userName={displayName}>
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
        <StatCard icon={FolderOpen} label="Projets actifs" value="0" hint="Aucun projet pour l'instant" />
        <StatCard icon={Briefcase} label="Missions en cours" value="0" hint="Aucune mission active" />
        <StatCard icon={Users} label="Prestataires" value="0" hint="0 disponibles" />
        <StatCard icon={UserCircle} label="Clients" value="0" hint="0 hubs créés" />
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
          eta="Phase 2"
        />
        <PlaceholderCard
          icon={Bell}
          title="Notifications temps réel"
          body="Sois alerté dès qu'un prestataire accepte ou refuse une mission."
          eta="Phase 4"
        />
      </section>
    </DashboardShell>
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
      <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {eta}
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <h3 className="mt-5 font-heading text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
