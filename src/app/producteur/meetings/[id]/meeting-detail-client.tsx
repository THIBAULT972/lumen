"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Mic,
  FileText,
  Trash2,
  Clock,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import {
  deleteMeetingReport,
  renameMeetingReport,
} from "../../meeting-actions";
import {
  SummaryViewer,
} from "../../meeting-summary-dialog";
import {
  STATUS_LABEL,
  type MeetingReportStatus,
  type MeetingReportWithProject,
} from "../../meeting-types";

const STATUS_TONE: Record<MeetingReportStatus, string> = {
  pending:
    "border-foreground/15 bg-foreground/[0.04] text-muted-foreground",
  uploading:
    "border-[oklch(0.65_0.22_50/0.5)] bg-[oklch(0.5_0.22_50/0.15)] text-[oklch(0.88_0.18_50)]",
  analyzing: "border-primary/40 bg-primary/[0.08] text-primary",
  done:
    "border-[oklch(0.65_0.2_140/0.5)] bg-[oklch(0.5_0.18_140/0.15)] text-[oklch(0.85_0.18_140)]",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function MeetingDetailClient({
  initialReport,
}: {
  initialReport: MeetingReportWithProject;
}) {
  const [report, setReport] = useState(initialReport);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initialReport.title);
  const [error, setError] = useState<string | null>(null);
  const [pending, startPending] = useTransition();
  const router = useRouter();

  // Realtime subscription for in-progress reports
  useEffect(() => {
    if (report.status === "done" || report.status === "error") return;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`meeting-detail-${report.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "meeting_reports",
          filter: `id=eq.${report.id}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload.new as MeetingReportWithProject;
          setReport((prev) => ({ ...prev, ...row }));
        },
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [report.id, report.status]);

  function saveTitle() {
    startPending(async () => {
      const r = await renameMeetingReport({
        reportId: report.id,
        title: titleDraft,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setReport({ ...report, title: titleDraft.trim().slice(0, 200) });
      setEditingTitle(false);
    });
  }

  function handleDelete() {
    if (!confirm("Supprimer définitivement ce compte-rendu ?")) return;
    startPending(async () => {
      const r = await deleteMeetingReport(report.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/producteur/meetings");
    });
  }

  const isInProgress =
    report.status === "pending" ||
    report.status === "uploading" ||
    report.status === "analyzing";

  return (
    <>
      <section className="mb-6 sm:mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              STATUS_TONE[report.status],
            )}
          >
            {isInProgress ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : null}
            {STATUS_LABEL[report.status]}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            {report.source_type === "audio" ? (
              <>
                <Mic className="h-3 w-3" />
                Audio
                {report.audio_size_bytes
                  ? ` · ${(report.audio_size_bytes / 1_048_576).toFixed(1)} Mo`
                  : ""}
              </>
            ) : (
              <>
                <FileText className="h-3 w-3" />
                Texte collé
              </>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date(report.created_at).toLocaleString("fr-FR", {
              timeZone: "America/Martinique",
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {editingTitle ? (
          <div className="flex items-center gap-2">
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setTitleDraft(report.title);
                  setEditingTitle(false);
                }
              }}
              className="h-11 max-w-2xl bg-foreground/[0.03] font-heading text-lg sm:text-2xl"
            />
            <Button
              type="button"
              size="sm"
              onClick={saveTitle}
              disabled={pending || !titleDraft.trim()}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setTitleDraft(report.title);
                setEditingTitle(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="group flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-light tracking-tight sm:text-4xl">
              {report.title}
            </h1>
            <button
              type="button"
              onClick={() => {
                setTitleDraft(report.title);
                setEditingTitle(true);
              }}
              className="rounded-md p-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-foreground/[0.06] hover:text-foreground sm:inline-flex"
              aria-label="Renommer"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        )}

        {report.project_name ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Rattaché au projet :{" "}
            <span className="text-foreground">{report.project_name}</span>
          </p>
        ) : null}
      </section>

      {error ? (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      ) : null}

      {isInProgress ? (
        <div className="glass-panel rounded-2xl p-10 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 font-heading text-xl font-light">
            {report.status === "pending"
              ? "Démarrage du traitement…"
              : report.status === "uploading"
                ? "Envoi de l'audio à Gemini…"
                : "Gemini analyse ton audio…"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Pour un audio de 3 h, comptez 3-5 min. Tu peux fermer la page,
            le résultat apparaîtra automatiquement quand prêt.
          </p>
        </div>
      ) : null}

      {report.status === "error" ? (
        <div className="glass-panel rounded-2xl p-10 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-4 font-heading text-xl font-light">
            Le traitement a échoué
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {report.error_message ??
              "Une erreur s'est produite pendant l'analyse."}
          </p>
        </div>
      ) : null}

      {report.status === "done" && report.summary ? (
        <>
          <SummaryViewer summary={report.summary} />
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-foreground/10 pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer ce CR
            </Button>
          </div>
        </>
      ) : null}
    </>
  );
}
