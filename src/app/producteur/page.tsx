import Link from "next/link";
import {
  Briefcase,
  FolderOpen,
  Users,
  UserCircle,
  Video,
  FileText,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { cn } from "@/lib/utils";
import { MeetingSummaryButton } from "./meeting-summary-dialog";

const EPISODE_STATUS_LABEL: Record<string, string> = {
  idea: "Idée",
  preprod: "En préparation",
  shooting: "En tournage",
  editing: "En montage",
  delivered: "Livré",
  published: "Publié",
};
// Badge ultra-court (3-4 char) pour les feeds mobile
const EPISODE_STATUS_SHORT: Record<string, string> = {
  idea: "IDÉ",
  preprod: "PRÉ",
  shooting: "TRG",
  editing: "MTG",
  delivered: "LIV",
  published: "PUB",
};
const EPISODE_STATUS_CLASS: Record<string, string> = {
  idea: "border-foreground/15 bg-foreground/[0.04] text-muted-foreground",
  preprod: "border-[oklch(0.65_0.22_258/0.5)] bg-[oklch(0.5_0.22_258/0.18)] text-[oklch(0.88_0.18_258)]",
  shooting:
    "border-[oklch(0.65_0.22_50/0.5)] bg-[oklch(0.5_0.22_50/0.18)] text-[oklch(0.88_0.18_50)]",
  editing:
    "border-[oklch(0.7_0.22_310/0.5)] bg-[oklch(0.5_0.22_310/0.18)] text-[oklch(0.88_0.18_310)]",
  delivered:
    "border-[oklch(0.65_0.2_140/0.5)] bg-[oklch(0.5_0.18_140/0.18)] text-[oklch(0.85_0.18_140)]",
  published:
    "border-[oklch(0.7_0.22_280/0.5)] bg-[oklch(0.5_0.22_280/0.18)] text-[oklch(0.88_0.18_280)]",
};

const MISSION_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  broadcast: "Diffusée",
  accepted: "Acceptée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};
const MISSION_STATUS_SHORT: Record<string, string> = {
  draft: "BRO",
  broadcast: "DIF",
  accepted: "ACC",
  in_progress: "ENC",
  completed: "OK",
  cancelled: "ANN",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  sent: "Émise",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
};
const INVOICE_STATUS_SHORT: Record<string, string> = {
  draft: "BRO",
  sent: "ÉMI",
  paid: "OK",
  overdue: "RTD",
  cancelled: "ANN",
};
const INVOICE_STATUS_CLASS: Record<string, string> = {
  draft: "border-foreground/15 bg-foreground/[0.04] text-muted-foreground",
  sent: "border-[oklch(0.65_0.22_258/0.5)] bg-[oklch(0.5_0.22_258/0.18)] text-[oklch(0.88_0.18_258)]",
  paid: "border-[oklch(0.65_0.2_140/0.5)] bg-[oklch(0.5_0.18_140/0.18)] text-[oklch(0.85_0.18_140)]",
  overdue: "border-destructive/30 bg-destructive/10 text-destructive",
  cancelled: "border-foreground/15 bg-foreground/[0.04] text-muted-foreground",
};

function eurosFromCents(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR", {
    timeZone: "America/Martinique",
    day: "2-digit",
    month: "short",
  });
}

export default async function ProducteurPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    profileRes,
    projectsRes,
    missionsRes,
    prestatairesRes,
    clientsRes,
    recentEpisodesRes,
    recentMissionsRes,
    recentInvoicesRes,
    projectsForLookupRes,
    recentMeetingsRes,
  ] = await Promise.all([
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
    // Recent episodes (limit 3)
    supabase
      .from("episodes")
      .select("id, name, status, project_id, production_date, updated_at")
      .order("updated_at", { ascending: false })
      .limit(3),
    // Recent missions (limit 3)
    supabase
      .from("missions")
      .select("id, title, status, location, scheduled_at, updated_at, episode_id")
      .order("updated_at", { ascending: false })
      .limit(3),
    // Recent invoices (limit 3)
    supabase
      .from("invoices")
      .select(
        "id, project_id, number, status, issued_at, total_ttc_cents, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(3),
    // For looking up project names
    supabase.from("projects").select("id, name"),
    // Recent meeting reports (limit 3)
    supabase
      .from("meeting_reports")
      .select(
        "id, title, source_type, status, summary, created_at, error_message",
      )
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const displayName =
    [profileRes.data?.first_name, profileRes.data?.last_name]
      .filter(Boolean)
      .join(" ") || profileRes.data?.email || "Producteur";

  const projectNameById = new Map<string, string>(
    (projectsForLookupRes.data ?? []).map((p) => [p.id as string, p.name as string]),
  );

  // Build episode → project name lookup for missions feed
  const episodeIdToProject = new Map<string, string>();
  if (recentMissionsRes.data && recentMissionsRes.data.length > 0) {
    const episodeIds = Array.from(
      new Set(
        recentMissionsRes.data
          .map((m) => m.episode_id)
          .filter((x): x is string => Boolean(x)),
      ),
    );
    if (episodeIds.length > 0) {
      const { data: eps } = await supabase
        .from("episodes")
        .select("id, project_id")
        .in("id", episodeIds);
      for (const ep of eps ?? []) {
        episodeIdToProject.set(ep.id as string, ep.project_id as string);
      }
    }
  }

  const recentEpisodes = recentEpisodesRes.data ?? [];
  const recentMissions = recentMissionsRes.data ?? [];
  const recentInvoices = recentInvoicesRes.data ?? [];
  const recentMeetings = recentMeetingsRes.data ?? [];

  return (
    <>
      <section className="mb-6 sm:mb-10">
        <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground sm:text-[11px]">
          Studio · Vue d'ensemble
        </p>
        <h1 className="mt-2 font-heading text-2xl font-light tracking-tight sm:mt-3 sm:text-4xl">
          Bienvenue,{" "}
          <span className="text-gradient-neon">{displayName}</span>.
        </h1>
        <p className="mt-1.5 hidden max-w-xl text-sm text-muted-foreground sm:mt-2 sm:block">
          Pilote tes projets, dispatche tes missions et garde un œil sur toute
          l'équipe depuis cet espace.
        </p>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-2.5 sm:mb-10 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={FolderOpen}
          label="Projets actifs"
          value={String(projectsRes.count ?? 0)}
        />
        <StatCard
          icon={Briefcase}
          label="Missions en cours"
          value={String(missionsRes.count ?? 0)}
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

      {/* Activité récente */}
      <section className="mb-6 grid gap-3 sm:mb-10 sm:gap-4 lg:grid-cols-3">
        {/* Épisodes récents */}
        <FeedCard
          icon={Video}
          title="Émissions"
          href="/producteur/projets"
          empty="Pas encore d'émission planifiée."
          isEmpty={recentEpisodes.length === 0}
        >
          {recentEpisodes.map((ep) => (
            <Link
              key={ep.id}
              href={`/producteur/projets/${ep.project_id}`}
              className="flex min-w-0 items-center gap-2 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] p-2 transition-colors hover:bg-foreground/[0.06]"
            >
              <span
                title={EPISODE_STATUS_LABEL[ep.status] ?? ep.status}
                className={cn(
                  "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider",
                  EPISODE_STATUS_CLASS[ep.status] ?? EPISODE_STATUS_CLASS.idea,
                )}
              >
                {EPISODE_STATUS_SHORT[ep.status] ?? ep.status.slice(0, 3).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">
                  {ep.name}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {projectNameById.get(ep.project_id) ?? "—"} ·{" "}
                  {timeAgo(ep.updated_at)}
                </p>
              </div>
            </Link>
          ))}
        </FeedCard>

        {/* Missions récentes */}
        <FeedCard
          icon={Briefcase}
          title="Missions"
          href="/producteur/projets"
          empty="Aucune mission pour l'instant."
          isEmpty={recentMissions.length === 0}
        >
          {recentMissions.map((m) => {
            const projectId = m.episode_id
              ? episodeIdToProject.get(m.episode_id)
              : null;
            return (
              <Link
                key={m.id}
                href={
                  projectId ? `/producteur/projets/${projectId}` : "/producteur/projets"
                }
                className="flex min-w-0 items-center gap-2 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] p-2 transition-colors hover:bg-foreground/[0.06]"
              >
                <span
                  title={MISSION_STATUS_LABEL[m.status] ?? m.status}
                  className="shrink-0 rounded-full border border-foreground/15 bg-foreground/[0.04] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {MISSION_STATUS_SHORT[m.status] ?? m.status.slice(0, 3).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">
                    {m.title}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {m.scheduled_at
                      ? new Date(m.scheduled_at).toLocaleDateString("fr-FR", {
                          timeZone: "America/Martinique",
                          day: "2-digit",
                          month: "short",
                        })
                      : "—"}{" "}
                    · {timeAgo(m.updated_at)}
                  </p>
                </div>
              </Link>
            );
          })}
        </FeedCard>

        {/* Factures récentes */}
        <FeedCard
          icon={FileText}
          title="Factures"
          href="/producteur/projets"
          empty="Aucune facture pour l'instant."
          isEmpty={recentInvoices.length === 0}
        >
          {recentInvoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/producteur/projets/${inv.project_id}/facturation`}
              className="flex min-w-0 items-center gap-2 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] p-2 transition-colors hover:bg-foreground/[0.06]"
            >
              <span
                title={INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                className={cn(
                  "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider",
                  INVOICE_STATUS_CLASS[inv.status] ??
                    INVOICE_STATUS_CLASS.draft,
                )}
              >
                {INVOICE_STATUS_SHORT[inv.status] ?? inv.status.slice(0, 3).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs leading-tight">
                  {inv.number}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {projectNameById.get(inv.project_id) ?? "—"}
                </p>
              </div>
              <span className="shrink-0 font-mono text-xs tabular-nums">
                {eurosFromCents(inv.total_ttc_cents)}
              </span>
            </Link>
          ))}
        </FeedCard>
      </section>

      {/* Comptes-rendus de réunion (Gemini) */}
      <section className="mb-4 grid gap-3 sm:gap-4 lg:grid-cols-[1fr_2fr]">
        <MeetingSummaryButton />

        <div className="glass-panel flex flex-col rounded-xl p-3 sm:rounded-2xl sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-foreground/10 bg-foreground/[0.03] sm:h-8 sm:w-8">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <h3 className="font-heading text-sm font-medium sm:text-base">
                CR récents
              </h3>
            </div>
            <Link
              href="/producteur/meetings"
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Voir tous les comptes-rendus"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recentMeetings.length === 0 ? (
            <p className="rounded-lg border border-dashed border-foreground/10 px-3 py-6 text-center text-xs text-muted-foreground">
              Aucun compte-rendu pour l'instant.
            </p>
          ) : (
            <div className="space-y-1.5">
              {recentMeetings.map((m) => (
                <Link
                  key={m.id}
                  href={`/producteur/meetings/${m.id}`}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] p-2 transition-colors hover:bg-foreground/[0.06]"
                >
                  <span
                    title={MEETING_STATUS_LABEL[m.status] ?? m.status}
                    className={cn(
                      "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider",
                      MEETING_STATUS_TONE[m.status] ??
                        MEETING_STATUS_TONE.pending,
                    )}
                  >
                    {MEETING_STATUS_SHORT[m.status] ?? m.status.slice(0, 3).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">
                      {m.title}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {m.source_type === "audio" ? "🎙 Audio" : "📝 Texte"} ·{" "}
                      {timeAgo(m.created_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

const MEETING_STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  uploading: "Envoi audio",
  analyzing: "Analyse",
  done: "Prêt",
  error: "Erreur",
};
const MEETING_STATUS_SHORT: Record<string, string> = {
  pending: "ATT",
  uploading: "ENV",
  analyzing: "IA",
  done: "OK",
  error: "ERR",
};
const MEETING_STATUS_TONE: Record<string, string> = {
  pending: "border-foreground/15 bg-foreground/[0.04] text-muted-foreground",
  uploading:
    "border-[oklch(0.65_0.22_50/0.5)] bg-[oklch(0.5_0.22_50/0.15)] text-[oklch(0.88_0.18_50)]",
  analyzing: "border-primary/40 bg-primary/[0.08] text-primary",
  done: "border-[oklch(0.65_0.2_140/0.5)] bg-[oklch(0.5_0.18_140/0.15)] text-[oklch(0.85_0.18_140)]",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
};

function FeedCard({
  icon: Icon,
  title,
  href,
  empty,
  isEmpty,
  children,
}: {
  icon: typeof Briefcase;
  title: string;
  href: string;
  empty: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel flex flex-col rounded-xl p-3 sm:rounded-2xl sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-foreground/10 bg-foreground/[0.03] sm:h-8 sm:w-8">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <h3 className="font-heading text-sm font-medium sm:text-base">
            {title}
          </h3>
        </div>
        <Link
          href={href}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Tout voir : ${title}`}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {isEmpty ? (
        <p className="rounded-lg border border-dashed border-foreground/10 px-3 py-6 text-center text-xs text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </div>
  );
}
