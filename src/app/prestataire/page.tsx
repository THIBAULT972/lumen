import { redirect } from "next/navigation";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Radio,
  MapPin,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/shell";
import { StatCard } from "@/components/dashboard/stat-card";

export default async function PrestatairePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, email, banned_until")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.role !== "prestataire") redirect("/");

  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email;

  const isBanned =
    profile.banned_until && new Date(profile.banned_until) > new Date();

  return (
    <DashboardShell role="Prestataire" userName={displayName}>
      <section className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
          Hub · Espace prestataire
        </p>
        <h1 className="mt-3 font-heading text-4xl font-light tracking-tight">
          Salut, <span className="text-gradient-neon">{displayName}</span>.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Consulte tes missions à venir, accepte de nouvelles propositions et
          gère tes infos perso.
        </p>

        {isBanned ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            <span>⚠ Pénalité active jusqu'au {new Date(profile.banned_until!).toLocaleDateString("fr-FR")}</span>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Radio} label="Propositions" value="0" hint="Missions ouvertes à toi" />
        <StatCard icon={Calendar} label="À venir" value="0" hint="Missions acceptées" />
        <StatCard icon={CheckCircle2} label="Réalisées" value="0" hint="Depuis ton arrivée" />
        <StatCard icon={Wallet} label="Total facturé" value="0 €" hint="Cumul des missions" />
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-3">
        <PlaceholderCard
          icon={Radio}
          title="Missions à accepter"
          body="Une notification dès qu'une mission correspond à tes compétences. Premier arrivé, premier servi."
          eta="Phase 2"
        />
        <PlaceholderCard
          icon={MapPin}
          title="Détails mission"
          body="Lieu, horaire, durée, prix, brief — tout est centralisé pour chaque mission."
          eta="Phase 2"
        />
        <PlaceholderCard
          icon={Briefcase}
          title="Mes infos perso"
          body="RIB, contact d'urgence, coordonnées. Modifiable à tout moment, visible uniquement par la prod."
          eta="Phase 2"
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
  icon: typeof Briefcase;
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
