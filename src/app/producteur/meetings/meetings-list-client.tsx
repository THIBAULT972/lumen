"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Search,
  Sparkles,
  Loader2,
  AlertCircle,
  Mic,
  FileText,
  Plus,
  Trash2,
  MoreHorizontal,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { MeetingSummaryDialog } from "../meeting-summary-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  deleteMeetingReport,
  listMeetingReports,
} from "../meeting-actions";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import {
  STATUS_LABEL,
  type MeetingReportStatus,
  type MeetingReportWithProject,
} from "../meeting-types";

const STATUS_TONE: Record<MeetingReportStatus, string> = {
  pending:
    "border-foreground/15 bg-foreground/[0.04] text-muted-foreground",
  uploading:
    "border-[oklch(0.65_0.22_50/0.5)] bg-[oklch(0.5_0.22_50/0.15)] text-[oklch(0.88_0.18_50)]",
  analyzing:
    "border-primary/40 bg-primary/[0.08] text-primary",
  done:
    "border-[oklch(0.65_0.2_140/0.5)] bg-[oklch(0.5_0.18_140/0.15)] text-[oklch(0.85_0.18_140)]",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
};

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

export function MeetingsListClient({
  initialReports,
  initialSearch,
  initialError,
}: {
  initialReports: MeetingReportWithProject[];
  initialSearch: string;
  initialError: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [reports, setReports] =
    useState<MeetingReportWithProject[]>(initialReports);
  const [search, setSearch] = useState(initialSearch);
  const [error, setError] = useState<string | null>(initialError);
  const [refreshing, startRefreshing] = useTransition();
  const [newOpen, setNewOpen] = useState(false);

  // Subscribe to Realtime updates on any report still in progress
  useEffect(() => {
    const supabase = createBrowserSupabase();
    const inProgress = reports.filter(
      (r) =>
        r.status === "pending" ||
        r.status === "uploading" ||
        r.status === "analyzing",
    );
    if (inProgress.length === 0) return;

    const ids = inProgress.map((r) => r.id);
    const channel = supabase
      .channel(`meetings-list-${ids.join("-").slice(0, 50)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "meeting_reports",
          filter: `id=in.(${ids.join(",")})`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload.new as MeetingReportWithProject;
          setReports((prev) =>
            prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)),
          );
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports.map((r) => `${r.id}:${r.status}`).join(",")]);

  function applySearch(q: string) {
    setSearch(q);
    const newParams = new URLSearchParams(params.toString());
    if (q.trim()) newParams.set("q", q.trim());
    else newParams.delete("q");
    startRefreshing(async () => {
      router.replace(`${pathname}?${newParams.toString()}`);
      const r = await listMeetingReports({
        search: q.trim() || undefined,
        limit: 50,
      });
      if (r.ok) {
        setReports(r.reports);
        setError(null);
      } else {
        setError(r.error);
      }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce compte-rendu ?")) return;
    const r = await deleteMeetingReport(id);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setReports((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => applySearch(e.target.value)}
            placeholder="Rechercher dans les CR…"
            className="h-10 bg-foreground/[0.03] pl-9"
          />
          {refreshing ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        <Button
          className="bg-gradient-neon text-white"
          onClick={() => setNewOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Nouveau compte-rendu</span>
          <span className="sm:hidden">Nouveau</span>
        </Button>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <MeetingSummaryDialog onClose={() => setNewOpen(false)} />
      </Dialog>

      {error ? (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      ) : null}

      {reports.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-4 font-heading text-xl font-light">
            {search ? "Aucun résultat" : "Aucun compte-rendu pour l'instant"}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {search
              ? `Pas de CR contenant « ${search} ».`
              : "Crée ton premier compte-rendu : colle tes notes ou dépose un audio."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} onDelete={() => handleDelete(r.id)} />
          ))}
        </ul>
      )}
    </>
  );
}

function ReportCard({
  report,
  onDelete,
}: {
  report: MeetingReportWithProject;
  onDelete: () => void;
}) {
  const inProgress =
    report.status === "pending" ||
    report.status === "uploading" ||
    report.status === "analyzing";

  return (
    <li className="glass-panel lift-on-hover rounded-xl p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <Link
          href={`/producteur/meetings/${report.id}`}
          className="flex min-w-0 flex-1 items-start gap-3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-foreground/10 bg-foreground/[0.03] sm:h-10 sm:w-10">
            {report.source_type === "audio" ? (
              <Mic className="h-4 w-4 text-muted-foreground" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                  STATUS_TONE[report.status],
                )}
              >
                {inProgress ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : null}
                {STATUS_LABEL[report.status]}
              </span>
              {report.project_name ? (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  · {report.project_name}
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm font-medium">
              {report.title}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo(report.created_at)}
              </span>
              {report.audio_size_bytes ? (
                <span>
                  {(report.audio_size_bytes / 1_048_576).toFixed(1)} Mo
                </span>
              ) : null}
              {report.summary && report.summary.actions ? (
                <span>
                  {report.summary.actions.length} action
                  {report.summary.actions.length > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-md p-2 transition-colors hover:bg-foreground/[0.06]"
            aria-label="Actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-foreground/10">
            <DropdownMenuItem
              variant="destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {report.status === "error" && report.error_message ? (
        <p className="mt-2 line-clamp-2 text-xs text-destructive">
          {report.error_message}
        </p>
      ) : null}
    </li>
  );
}
