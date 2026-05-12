import { redirect } from "next/navigation";
import { FolderOpen, Download, Video, FileText } from "lucide-react";
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
          Retrouve l'ensemble des contenus livrés par notre équipe de
          production.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={FolderOpen} label="Projets" value="0" hint="En cours de livraison" />
        <StatCard icon={Video} label="Vidéos livrées" value="0" hint="Prêtes à télécharger" />
        <StatCard icon={FileText} label="Autres fichiers" value="0" hint="Documents, photos" />
      </section>

      <section className="mt-10">
        <div className="glass-panel rounded-2xl p-10 text-center">
          <Download className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-4 font-heading text-2xl font-light">
            Aucun contenu pour l'instant
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Tes livrables apparaîtront ici dès que l'équipe les aura déposés
            dans ton hub.
          </p>
        </div>
      </section>
    </DashboardShell>
  );
}
