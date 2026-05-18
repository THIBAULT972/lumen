"use client";

import { useState, useTransition } from "react";
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
import { summarizeMeetingNotes } from "./meeting-actions";
import type { MeetingSummary } from "@/lib/ai/meeting-summarizer";

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
              Colle tes notes ou ta transcription, Gemini en sort un résumé
              structuré (décisions, actions, deadlines, points clés).
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

function MeetingSummaryDialog({ onClose }: { onClose: () => void }) {
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await summarizeMeetingNotes(notes);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSummary(r.summary);
    });
  }

  function reset() {
    setSummary(null);
    setError(null);
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto border-foreground/10 sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-heading text-2xl font-light">
          <Sparkles className="h-5 w-5 text-primary" />
          Compte-rendu de réunion
        </DialogTitle>
        <DialogDescription>
          {summary
            ? "Voici la synthèse. Tu peux relancer une nouvelle analyse en effaçant."
            : "Colle tes notes ou la transcription. Gemini en sort un compte-rendu structuré et actionnable."}
        </DialogDescription>
      </DialogHeader>

      {!summary ? (
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
              {notes.trim().length} caractères · gardé local tant que tu ne
              ferme pas la fenêtre.
            </p>
          </div>

          {error ? (
            <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={pending || notes.trim().length < 60}
              className="bg-gradient-neon text-white"
            >
              {pending ? (
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
        <div className="space-y-5">
          {/* Header */}
          <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Titre détecté
            </p>
            <h3 className="mt-1 font-heading text-lg font-medium">
              {summary.title}
            </h3>
            <p className="mt-3 text-sm text-foreground/90">{summary.tldr}</p>
          </div>

          {/* Décisions */}
          {summary.decisions.length > 0 ? (
            <SummarySection
              icon={CheckCircle2}
              title="Décisions"
              tone="emerald"
            >
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

          {/* Actions */}
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

          {/* Points clés */}
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

          {/* Questions ouvertes */}
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

          <div className="flex flex-wrap justify-end gap-2 border-t border-foreground/10 pt-4">
            <Button type="button" variant="ghost" onClick={reset}>
              <FileText className="mr-2 h-4 w-4" />
              Nouveau texte
            </Button>
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
            <Button type="button" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      )}
    </DialogContent>
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

function renderSummaryAsMarkdown(s: MeetingSummary): string {
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
