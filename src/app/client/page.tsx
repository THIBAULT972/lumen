import { redirect } from "next/navigation";
import {
  FolderOpen,
  Video,
  CalendarDays,
  Send,
  Download,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { ClientDeliverableViewer } from "./deliverable-viewer";
import type { FileRecord, FileTarget } from "../producteur/projets/file-types";
import type { InvoiceRow, InvoiceStatus } from "../producteur/projets/invoice-types";
import { cn } from "@/lib/utils";

function statusLabel(s: InvoiceStatus): string {
  switch (s) {
    case "sent": return "Reçue";
    case "paid": return "Payée";
    case "overdue": return "En retard";
    case "cancelled": return "Annulée";
    default: return "Brouillon";
  }
}
function statusClass(s: InvoiceStatus): string {
  switch (s) {
    case "sent":
      return "border-[oklch(0.65_0.22_258/0.5)] bg-[oklch(0.5_0.22_258/0.18)] text-[oklch(0.88_0.18_258)]";
    case "paid":
      return "border-[oklch(0.65_0.2_140/0.5)] bg-[oklch(0.5_0.18_140/0.18)] text-[oklch(0.85_0.18_140)]";
    case "overdue":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "cancelled":
      return "border-foreground/15 bg-foreground/[0.04] text-muted-foreground line-through";
    default:
      return "border-foreground/15 bg-foreground/[0.04] text-muted-foreground";
  }
}
function eurosFromCents(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

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

  // RLS filtre tout automatiquement : ce client ne voit que ses projets +
  // les fichiers qui lui sont destinés.
  const [projectsRes, filesRes, invoicesRes] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, description, archived_at, created_at, episodes(id, name, production_date, publication_date)",
      )
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("files")
      .select(
        "id, storage_path, filename, mime_type, size_bytes, target, project_id, episode_id, mission_id, destination_user_id, uploaded_by, created_at",
      )
      .eq("target", "hub_client")
      .order("created_at", { ascending: false }),
    // RLS filtre déjà : le client ne voit que ses factures non-brouillon.
    supabase
      .from("invoices")
      .select(
        "id, project_id, number, status, issued_at, due_at, paid_at, studio_snapshot, client_snapshot, notes, total_ht_cents, total_tva_cents, total_ttc_cents, currency, created_at, updated_at",
      )
      .order("issued_at", { ascending: false }),
  ]);

  const projectsList = projectsRes.data ?? [];
  const totalEpisodes = projectsList.reduce(
    (acc, p) => acc + (p.episodes?.length ?? 0),
    0,
  );
  const deliverables: FileRecord[] = (filesRes.data ?? []).map((f) => ({
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
  const invoices: InvoiceRow[] = (invoicesRes.data ?? []).map((i) => ({
    ...(i as InvoiceRow),
    status: i.status as InvoiceStatus,
  }));
  const unpaidTtc = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((acc, i) => acc + i.total_ttc_cents, 0);

  // Group deliverables by project for display
  const deliverablesByProject = new Map<string, FileRecord[]>();
  for (const f of deliverables) {
    const pid = f.project_id ?? "_unattached";
    const list = deliverablesByProject.get(pid) ?? [];
    list.push(f);
    deliverablesByProject.set(pid, list);
  }
  const projectNameById = new Map(projectsList.map((p) => [p.id, p.name]));

  return (
    <DashboardShell role="Client" userName={displayName}>
      <section className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
          Hub · Espace client
        </p>
        <h1 className="mt-3 font-heading text-3xl font-light tracking-tight sm:text-4xl">
          Bonjour, <span className="text-gradient-neon">{displayName}</span>.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Suis l'avancement de tes productions et récupère tes livrables ici.
        </p>
      </section>

      <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <StatCard
          icon={Download}
          label="Livrables"
          value={String(deliverables.length)}
        />
        <StatCard
          icon={FileText}
          label="À régler"
          value={eurosFromCents(unpaidTtc)}
          hint={
            invoices.length > 0
              ? `${invoices.length} facture${invoices.length > 1 ? "s" : ""}`
              : undefined
          }
        />
      </section>

      {/* INVOICES */}
      {invoices.length > 0 ? (
        <section className="mb-10 space-y-3">
          <h2 className="font-heading text-xl font-light tracking-wide">
            Factures
          </h2>
          <ul className="space-y-2">
            {invoices.map((inv) => {
              const projectName = projectsList.find(
                (p) => p.id === inv.project_id,
              )?.name;
              return (
                <li key={inv.id} className="glass-panel rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                            statusClass(inv.status),
                          )}
                        >
                          {statusLabel(inv.status)}
                        </span>
                        <span className="font-mono text-sm">{inv.number}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        {projectName ? <span>{projectName}</span> : null}
                        <span>
                          Émise le{" "}
                          {new Date(inv.issued_at).toLocaleDateString("fr-FR", {
                            timeZone: "America/Martinique",
                          })}
                        </span>
                        {inv.due_at ? (
                          <span>
                            Échéance{" "}
                            {new Date(inv.due_at).toLocaleDateString("fr-FR", {
                              timeZone: "America/Martinique",
                            })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-heading text-lg font-light tabular-nums">
                        {eurosFromCents(inv.total_ttc_cents)}
                      </p>
                      <a
                        href={`/api/invoices/${inv.id}/pdf`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-secondary/40 px-3 text-xs font-medium transition-colors hover:bg-secondary"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* DELIVERABLES — videos, exports, briefs… */}
      {deliverables.length > 0 ? (
        <section className="mb-10 space-y-4">
          <h2 className="font-heading text-xl font-light tracking-wide">
            Livrables à télécharger
          </h2>
          {Array.from(deliverablesByProject.entries()).map(([pid, files]) => (
            <div key={pid} className="glass-panel rounded-2xl p-5">
              <p className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                Projet ·{" "}
                <span className="text-foreground">
                  {projectNameById.get(pid) ?? "Sans projet"}
                </span>
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {files.map((f) => (
                  <ClientDeliverableViewer key={f.id} file={f} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {/* PROJECTS — overview of upcoming production */}
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
        <section className="space-y-4">
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
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2 text-sm"
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
        </section>
      )}
    </DashboardShell>
  );
}
