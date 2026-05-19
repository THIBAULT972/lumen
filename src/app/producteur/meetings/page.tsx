import Link from "next/link";
import { Sparkles, Search, ArrowLeft, FileText } from "lucide-react";
import { listMeetingReports } from "../meeting-actions";
import { MeetingsListClient } from "./meetings-list-client";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; project?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.q?.trim() || undefined;
  const projectId = sp.project?.trim() || undefined;

  const r = await listMeetingReports({
    search,
    projectId: projectId ?? undefined,
    limit: 50,
  });

  const reports = r.ok ? r.reports : [];
  const error = r.ok ? null : r.error;

  return (
    <>
      <Link
        href="/producteur"
        className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Retour au dashboard
      </Link>

      <section className="mb-6 sm:mb-8">
        <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground sm:text-[11px]">
          Studio · Historique
        </p>
        <h1 className="mt-2 flex items-center gap-2 font-heading text-2xl font-light tracking-tight sm:mt-3 sm:text-4xl">
          <Sparkles className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
          Comptes-rendus de réunion
        </h1>
        <p className="mt-1.5 hidden max-w-xl text-sm text-muted-foreground sm:mt-2 sm:block">
          Tous tes CR générés par Gemini, à partir de notes texte ou d'audio
          uploadés. Recherche par mot-clé, ouvre pour copier en markdown.
        </p>
      </section>

      <MeetingsListClient
        initialReports={reports}
        initialSearch={search ?? ""}
        initialError={error}
      />
    </>
  );
}
