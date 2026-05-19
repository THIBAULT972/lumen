"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ListChecks,
  Lightbulb,
  HelpCircle,
  Calendar,
  User,
  FileText,
  Mic,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cancelMeetingReport,
  createMeetingReportFromText,
  requestMeetingAudioUpload,
  triggerMeetingAudioProcessing,
} from "./meeting-actions";
import {
  uploadFileWithProgress,
  type UploadHandle,
} from "@/lib/storage/upload-with-progress";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import type { MeetingSummary } from "@/lib/ai/meeting-summarizer";
import type { MeetingReportStatus } from "./meeting-types";
import { cn } from "@/lib/utils";

type SourceTab = "text" | "audio";

type Phase =
  | { kind: "input" }
  | { kind: "uploading"; pct: number; loaded: number; total: number }
  | { kind: "waiting"; reportId: string; status: MeetingReportStatus }
  | { kind: "done"; summary: MeetingSummary; reportId: string }
  | { kind: "error"; message: string };

const MAX_AUDIO_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const ACCEPT_AUDIO =
  ".mp3,.m4a,.wav,.ogg,.flac,.aac,.webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/flac,audio/aac,audio/webm";

export function MeetingSummaryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass-panel group relative w-full overflow-hidden rounded-xl p-4 text-left transition-colors hover:bg-foreground/[0.04] sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 sm:h-10 sm:w-10 sm:rounded-xl">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading text-base font-medium sm:text-lg">
              Compte-rendu de réunion
            </h3>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Colle tes notes OU dépose un audio (jusqu'à 3 h) → Gemini en sort
              un résumé structuré (décisions, actions, deadlines, points clés).
            </p>
          </div>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <MeetingSummaryDialog onClose={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

export function MeetingSummaryDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<SourceTab>("text");
  const [phase, setPhase] = useState<Phase>({ kind: "input" });

  // Text path
  const [notes, setNotes] = useState("");
  const [textPending, startTextProcessing] = useTransition();

  // Audio path
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const uploadHandleRef = useRef<UploadHandle | null>(null);
  const realtimeUnsubRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup Realtime subscription on close / unmount
  useEffect(() => {
    return () => {
      realtimeUnsubRef.current?.();
      realtimeUnsubRef.current = null;
    };
  }, []);

  function reset() {
    setPhase({ kind: "input" });
    setNotes("");
    setAudioFile(null);
    realtimeUnsubRef.current?.();
    realtimeUnsubRef.current = null;
  }

  function close() {
    realtimeUnsubRef.current?.();
    realtimeUnsubRef.current = null;
    uploadHandleRef.current?.abort();
    onClose();
  }

  // ─── TEXT PATH ──────────────────────────────────────────────────────────
  function submitText() {
    startTextProcessing(async () => {
      const r = await createMeetingReportFromText({ notes });
      if (!r.ok) {
        setPhase({ kind: "error", message: r.error });
        return;
      }
      setPhase({ kind: "done", summary: r.summary, reportId: r.reportId });
    });
  }

  // ─── AUDIO PATH ─────────────────────────────────────────────────────────
  async function submitAudio() {
    if (!audioFile) return;

    setPhase({
      kind: "uploading",
      pct: 0,
      loaded: 0,
      total: audioFile.size,
    });

    // 1. Request signed URL + create the meeting_reports row
    const init = await requestMeetingAudioUpload({
      filename: audioFile.name,
      size: audioFile.size,
      mimeType: audioFile.type || "audio/mpeg",
    });
    if (!init.ok) {
      setPhase({ kind: "error", message: init.error });
      return;
    }
    const reportId = init.reportId;

    // 2. Upload audio via XHR (with progress)
    const handle = uploadFileWithProgress(
      init.signedUrl,
      audioFile,
      ({ loaded, total, pct }) => {
        setPhase({ kind: "uploading", pct, loaded, total });
      },
    );
    uploadHandleRef.current = handle;
    const r = await handle.promise;
    uploadHandleRef.current = null;

    if (!r.ok) {
      // Cleanup the orphan row
      await cancelMeetingReport(reportId);
      setPhase({ kind: "error", message: r.error });
      return;
    }

    // 3. Trigger the Edge Function (fire and forget on server)
    setPhase({ kind: "waiting", reportId, status: "pending" });
    const trig = await triggerMeetingAudioProcessing(reportId);
    if (!trig.ok) {
      setPhase({ kind: "error", message: trig.error });
      return;
    }

    // 4. Subscribe to Realtime updates
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`meeting-${reportId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "meeting_reports",
          filter: `id=eq.${reportId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload.new as {
            status: MeetingReportStatus;
            summary: MeetingSummary | null;
            error_message: string | null;
          };
          if (row.status === "done" && row.summary) {
            setPhase({
              kind: "done",
              summary: row.summary,
              reportId,
            });
            channel.unsubscribe();
            realtimeUnsubRef.current = null;
          } else if (row.status === "error") {
            setPhase({
              kind: "error",
              message:
                row.error_message ?? "Erreur pendant le traitement audio.",
            });
            channel.unsubscribe();
            realtimeUnsubRef.current = null;
          } else {
            setPhase({ kind: "waiting", reportId, status: row.status });
          }
        },
      )
      .subscribe();

    realtimeUnsubRef.current = () => {
      channel.unsubscribe();
    };
  }

  function cancelInProgress() {
    if (phase.kind === "uploading") {
      uploadHandleRef.current?.abort();
    }
    if (phase.kind === "waiting") {
      // Best-effort : delete the row in background
      void cancelMeetingReport(phase.reportId);
    }
    realtimeUnsubRef.current?.();
    realtimeUnsubRef.current = null;
    reset();
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────

  const isDoing =
    textPending ||
    phase.kind === "uploading" ||
    phase.kind === "waiting";

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto border-foreground/10 sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-heading text-2xl font-light">
          <Sparkles className="h-5 w-5 text-primary" />
          Compte-rendu de réunion
        </DialogTitle>
        <DialogDescription>
          {phase.kind === "done"
            ? "Synthèse Gemini ci-dessous. Le CR est sauvegardé dans ton historique."
            : "Colle tes notes OU dépose un audio. Gemini en sort un compte-rendu structuré et actionnable, sauvegardé dans ton historique."}
        </DialogDescription>
      </DialogHeader>

      {phase.kind === "input" ? (
        <>
          {/* Tabs */}
          <div className="flex gap-1 rounded-full border border-foreground/10 bg-foreground/[0.02] p-1 text-xs">
            <TabPill
              active={tab === "text"}
              onClick={() => setTab("text")}
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Texte"
            />
            <TabPill
              active={tab === "audio"}
              onClick={() => setTab("audio")}
              icon={<Mic className="h-3.5 w-3.5" />}
              label="Audio (jusqu'à 3 h)"
            />
          </div>

          {tab === "text" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="meeting-notes">Notes / transcription</Label>
                <textarea
                  id="meeting-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={12}
                  placeholder={`Exemple :

Réunion 16/05 — Présents : Thibault, Meghane, Anthony.
On valide le projet Histwa, 6 épisodes. Anthony s'occupe du repérage à Sainte-Anne avant vendredi prochain. Le client confirme 25k de budget total. Reste à trancher le format (capsule courte vs reportage long) — Meghane appelle le client lundi pour caler ça. Risque : pluie début juin, prévoir une journée de backup.`}
                  className="w-full resize-y rounded-lg border border-foreground/10 bg-foreground/[0.03] p-3 text-sm placeholder:text-muted-foreground/50 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground">
                  {notes.trim().length} caractères · sauvegardé dans ton
                  historique après génération.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={close}
                  disabled={textPending}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={submitText}
                  disabled={textPending || notes.trim().length < 60}
                  className="bg-gradient-neon text-white"
                >
                  {textPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Synthèse Gemini…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Générer le compte-rendu
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_AUDIO}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > MAX_AUDIO_SIZE) {
                    setPhase({
                      kind: "error",
                      message: `Audio trop volumineux (${(f.size / 1_073_741_824).toFixed(2)} Go). Max 2 Go.`,
                    });
                    return;
                  }
                  setAudioFile(f);
                  e.target.value = "";
                }}
              />
              {audioFile ? (
                <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/[0.04] px-3 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
                    <Mic className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {audioFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(audioFile.size)} ·{" "}
                      {audioFile.type || "audio"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAudioFile(null)}
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                    aria-label="Retirer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (!f) return;
                    if (f.size > MAX_AUDIO_SIZE) {
                      setPhase({
                        kind: "error",
                        message: `Audio trop volumineux (${(f.size / 1_073_741_824).toFixed(2)} Go). Max 2 Go.`,
                      });
                      return;
                    }
                    setAudioFile(f);
                  }}
                  className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-foreground/[0.02] px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.04]"
                >
                  <Upload className="h-8 w-8 text-muted-foreground/60" />
                  <div>
                    <p className="font-medium text-foreground">
                      Dépose ton fichier audio ici
                    </p>
                    <p className="mt-1 text-xs">
                      MP3, M4A, WAV, OGG, FLAC, AAC (jusqu'à 2 Go)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 rounded-md border border-border bg-foreground/[0.04] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-foreground/[0.08]"
                  >
                    Choisir un fichier
                  </button>
                </div>
              )}

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs text-amber-300">
                <p className="font-medium text-amber-200">⏱ Temps de traitement</p>
                <p className="mt-1 text-amber-300/80">
                  L'analyse d'une réunion de 1 h prend environ 1-2 min. Pour 3 h
                  c'est 3-5 min. Tu peux fermer cette fenêtre pendant le
                  traitement et revenir plus tard — le résultat apparaîtra dans
                  ton historique.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={close}
                  disabled={isDoing}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={submitAudio}
                  disabled={isDoing || !audioFile}
                  className="bg-gradient-neon text-white"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Lancer l'analyse
                </Button>
              </div>
            </div>
          )}
        </>
      ) : null}

      {phase.kind === "uploading" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Envoi de l'audio
            </p>
            <h3 className="mt-1 font-heading text-lg font-medium">
              {audioFile?.name ?? "Audio"}
            </h3>
            <ProgressBar pct={phase.pct} />
            <p className="mt-2 text-xs text-muted-foreground">
              {formatSize(phase.loaded)} / {formatSize(phase.total)} ·{" "}
              {phase.pct}%
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={cancelInProgress}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : null}

      {phase.kind === "waiting" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {phase.status === "pending"
                    ? "Démarrage…"
                    : phase.status === "uploading"
                      ? "Envoi à Gemini…"
                      : "Gemini analyse…"}
                </p>
                <h3 className="mt-1 font-heading text-base font-medium">
                  Réunion en cours d'analyse
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tu peux fermer cette fenêtre — le compte-rendu apparaîtra
                  dans ton historique dès qu'il est prêt.
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={cancelInProgress}
            >
              Annuler
            </Button>
            <Button type="button" variant="outline" onClick={close}>
              Fermer (continue en arrière-plan)
            </Button>
          </div>
        </div>
      ) : null}

      {phase.kind === "error" ? (
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{phase.message}</span>
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Fermer
            </Button>
            <Button type="button" onClick={reset}>
              Réessayer
            </Button>
          </div>
        </div>
      ) : null}

      {phase.kind === "done" ? (
        <SummaryViewer
          summary={phase.summary}
          onReset={reset}
          onClose={close}
        />
      ) : null}
    </DialogContent>
  );
}

function TabPill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
        active
          ? "bg-foreground/[0.06] font-medium text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
      <div
        className="h-full bg-gradient-neon transition-[width] duration-200"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} Ko`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} Mo`;
  return `${(bytes / 1_073_741_824).toFixed(2)} Go`;
}

// ─── Summary Viewer (réutilisable) ─────────────────────────────────────────

export function SummaryViewer({
  summary,
  onReset,
  onClose,
}: {
  summary: MeetingSummary;
  onReset?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Titre détecté
        </p>
        <h3 className="mt-1 font-heading text-lg font-medium">
          {summary.title}
        </h3>
        <p className="mt-3 text-sm text-foreground/90">{summary.tldr}</p>
      </div>

      {summary.decisions.length > 0 ? (
        <SummarySection icon={CheckCircle2} title="Décisions" tone="emerald">
          <ul className="space-y-2">
            {summary.decisions.map((d, i) => (
              <li
                key={i}
                className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3"
              >
                <p className="text-sm font-medium">{d.topic}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {d.outcome}
                </p>
              </li>
            ))}
          </ul>
        </SummarySection>
      ) : null}

      {summary.actions.length > 0 ? (
        <SummarySection icon={ListChecks} title="Actions à mener" tone="primary">
          <ul className="space-y-2">
            {summary.actions.map((a, i) => (
              <li
                key={i}
                className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3"
              >
                <p className="text-sm">{a.what}</p>
                {a.owner || a.deadline ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {a.owner ? (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {a.owner}
                      </span>
                    ) : null}
                    {a.deadline ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {a.deadline}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </SummarySection>
      ) : null}

      {summary.key_points.length > 0 ? (
        <SummarySection icon={Lightbulb} title="Points clés" tone="amber">
          <ul className="space-y-1.5">
            {summary.key_points.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </SummarySection>
      ) : null}

      {summary.open_questions.length > 0 ? (
        <SummarySection icon={HelpCircle} title="Questions ouvertes" tone="muted">
          <ul className="space-y-1.5">
            {summary.open_questions.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </SummarySection>
      ) : null}

      {onReset || onClose ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-foreground/10 pt-4">
          {onReset ? (
            <Button type="button" variant="ghost" onClick={onReset}>
              <FileText className="mr-2 h-4 w-4" />
              Nouveau CR
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const md = renderSummaryAsMarkdown(summary);
              navigator.clipboard.writeText(md).catch(() => {});
            }}
          >
            Copier (markdown)
          </Button>
          {onClose ? (
            <Button type="button" onClick={onClose}>
              Fermer
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SummarySection({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: typeof CheckCircle2;
  title: string;
  tone: "emerald" | "primary" | "amber" | "muted";
  children: React.ReactNode;
}) {
  const toneClass = {
    emerald:
      "border-[oklch(0.65_0.2_140/0.5)] bg-[oklch(0.5_0.18_140/0.08)] text-[oklch(0.85_0.18_140)]",
    primary: "border-primary/40 bg-primary/[0.06] text-primary",
    amber: "border-amber-500/40 bg-amber-500/[0.06] text-amber-300",
    muted: "border-foreground/15 bg-foreground/[0.04] text-muted-foreground",
  }[tone];

  return (
    <section>
      <div
        className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </section>
  );
}

export function renderSummaryAsMarkdown(s: MeetingSummary): string {
  const parts: string[] = [];
  parts.push(`# ${s.title}\n`);
  parts.push(`> ${s.tldr}\n`);
  if (s.decisions.length > 0) {
    parts.push("## Décisions");
    for (const d of s.decisions) {
      parts.push(`- **${d.topic}** — ${d.outcome}`);
    }
    parts.push("");
  }
  if (s.actions.length > 0) {
    parts.push("## Actions");
    for (const a of s.actions) {
      const meta = [a.owner, a.deadline].filter(Boolean).join(" · ");
      parts.push(`- [ ] ${a.what}${meta ? ` _(${meta})_` : ""}`);
    }
    parts.push("");
  }
  if (s.key_points.length > 0) {
    parts.push("## Points clés");
    for (const p of s.key_points) parts.push(`- ${p}`);
    parts.push("");
  }
  if (s.open_questions.length > 0) {
    parts.push("## Questions ouvertes");
    for (const q of s.open_questions) parts.push(`- ${q}`);
    parts.push("");
  }
  return parts.join("\n");
}
