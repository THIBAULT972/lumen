"use client";

import { useRef, useState, useTransition } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Wand2,
  Plus,
  Trash2,
  Users,
  Video,
  RefreshCcw,
  FileText,
  Paperclip,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createProjectFromAiDraft,
  discardAiPdf,
  generateAiProjectDraft,
  requestAiPdfUpload,
} from "./ai-actions";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import type { ProjectDraft } from "@/lib/ai/project-generator";
import type { ClientOption, ProducteurOption } from "./page";

const STORAGE_BUCKET = "files";
const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20 MB

type Stage =
  | { phase: "idea" }
  | { phase: "generating" }
  | { phase: "preview"; draft: ProjectDraft }
  | { phase: "creating"; draft: ProjectDraft };

const EXAMPLES = [
  "Une émission qui suit des entrepreneurs créoles débutants. 5 épisodes en format magazine. Diffusion YouTube + France 3.",
  "Un mini-documentaire sur la culture du rhum en Martinique. 3 épisodes. On veut interviewer des distilleurs, un caviste, et un mixologue. Plutôt long format.",
  "Une série courte (10 capsules) sur les bons plans à Sainte-Anne pour les locaux. TikTok et Instagram. Ton fun, dynamique.",
];

export function AiProjectDialog({
  producteurs,
  clients,
  currentUserId,
  onSuccess,
}: {
  producteurs: ProducteurOption[];
  clients: ClientOption[];
  currentUserId: string;
  onSuccess: (projectId: string) => void;
}) {
  const [stage, setStage] = useState<Stage>({ phase: "idea" });
  const [idea, setIdea] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "analyzing"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();
  const [creating, startCreating] = useTransition();
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Editable draft state (initialized once we move to the preview phase)
  const [draftEdit, setDraftEdit] = useState<ProjectDraft | null>(null);

  // Assignment state
  const [selectedProducteurs, setSelectedProducteurs] = useState<Set<string>>(
    new Set([currentUserId]),
  );
  const [clientId, setClientId] = useState<string>("");

  function generate() {
    setError(null);
    startGenerating(async () => {
      setStage({ phase: "generating" });

      let pdfStoragePath: string | undefined;

      // 1. If a PDF is attached, upload it to Supabase Storage first (bypasses
      //    Next.js server-action body limits).
      if (pdf) {
        setUploadStatus("uploading");
        const init = await requestAiPdfUpload(pdf.name, pdf.size);
        if (!init.ok) {
          setError(init.error);
          setUploadStatus("idle");
          setStage({ phase: "idea" });
          return;
        }
        const supabase = createBrowserSupabase();
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .uploadToSignedUrl(init.storagePath, init.token, pdf);
        if (upErr) {
          setError(`Envoi du PDF échoué : ${upErr.message}`);
          setUploadStatus("idle");
          setStage({ phase: "idea" });
          return;
        }
        pdfStoragePath = init.storagePath;
      }

      // 2. Generate. The server downloads the PDF (if any), feeds bytes to
      //    Gemini, then cleans up the temp file.
      setUploadStatus("analyzing");
      const r = await generateAiProjectDraft({ idea, pdfStoragePath });
      setUploadStatus("idle");
      if (!r.ok) {
        setError(r.error);
        setStage({ phase: "idea" });
        return;
      }
      setDraftEdit(r.draft);
      setStage({ phase: "preview", draft: r.draft });
    });
  }

  function pickPdf(file: File) {
    if (file.type && file.type !== "application/pdf") {
      setError("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      setError(
        `PDF trop volumineux (${(file.size / 1_048_576).toFixed(1)} Mo). Max ${MAX_PDF_SIZE / 1_048_576} Mo.`,
      );
      return;
    }
    setError(null);
    setPdf(file);
  }

  // Discard a pending temp PDF on dialog close (best-effort) — not used yet
  // but kept for the future "close mid-upload" flow.
  void discardAiPdf;

  function create() {
    if (!draftEdit) return;
    setError(null);
    startCreating(async () => {
      setStage({ phase: "creating", draft: draftEdit });
      const r = await createProjectFromAiDraft({
        draft: draftEdit,
        producteurIds: Array.from(selectedProducteurs),
        clientId: draftEdit.kind === "client" ? clientId : null,
      });
      if (!r.ok) {
        setError(r.error);
        setStage({ phase: "preview", draft: draftEdit });
        return;
      }
      onSuccess(r.projectId);
    });
  }

  function toggleProducteur(id: string) {
    setSelectedProducteurs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────

  if (stage.phase === "idea" || stage.phase === "generating") {
    return (
      <DialogContent className="border-foreground/10 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-2xl font-light">
            <Sparkles className="h-5 w-5 text-primary" />
            Créer un projet avec l'IA
          </DialogTitle>
          <DialogDescription>
            Décris ton idée en quelques phrases. L'IA te génère un brouillon
            structuré : nom, description, émissions avec format et plateformes,
            compétences à mobiliser. Tu pourras tout éditer ensuite.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="ai-idea">
            Ton idée{" "}
            <span className="text-muted-foreground">(et/ou un PDF)</span>
          </Label>
          <textarea
            id="ai-idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={5}
            placeholder="Ex : Une mini-série de 4 épisodes sur des chefs créoles émergents…"
            className="w-full rounded-lg border border-foreground/10 bg-foreground/[0.03] p-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
            disabled={generating}
            autoFocus
          />

          {/* PDF drop zone */}
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickPdf(f);
              e.target.value = "";
            }}
          />
          {pdf ? (
            <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium leading-tight">
                  {pdf.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(pdf.size / 1_048_576).toFixed(2)} Mo · sera analysé (texte
                  + images)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPdf(null)}
                disabled={generating}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Retirer le PDF"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) pickPdf(f);
              }}
              className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-foreground/[0.02] px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.04]"
            >
              <span className="inline-flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                Glisse un PDF ici (brief, dossier de prod, présentation… max 20 Mo)
              </span>
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={generating}
                className="rounded-md border border-border bg-foreground/[0.03] px-2 py-1 text-[11px] transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                Choisir
              </button>
            </div>
          )}

          {!idea && !pdf ? (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Quelques exemples
              </p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setIdea(ex)}
                    className="rounded-full border border-border bg-foreground/[0.03] px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                  >
                    {ex.slice(0, 70)}{ex.length > 70 ? "…" : ""}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            disabled={(!idea.trim() && !pdf) || generating}
            onClick={generate}
            className="bg-gradient-neon text-white"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploadStatus === "uploading"
                  ? "Envoi du PDF…"
                  : "L'IA réfléchit…"}
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Générer le brouillon
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  // ── PREVIEW PHASE ────────────────────────────────────────────────────
  if (!draftEdit) return null;

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto border-foreground/10 sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-heading text-2xl font-light">
          <Sparkles className="h-5 w-5 text-primary" />
          Brouillon IA
        </DialogTitle>
        <DialogDescription>
          Édite ce que tu veux avant de créer. Une fois validé, on créera
          le projet et toutes les émissions d'un coup.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        {/* Type */}
        <div className="space-y-2">
          <Label>Type de projet</Label>
          <div className="grid grid-cols-2 gap-2">
            <TypeChip
              active={draftEdit.kind === "media"}
              onClick={() => setDraftEdit({ ...draftEdit, kind: "media" })}
              icon={<Video className="h-4 w-4" />}
              label="Média (interne)"
            />
            <TypeChip
              active={draftEdit.kind === "client"}
              onClick={() => setDraftEdit({ ...draftEdit, kind: "client" })}
              icon={<Users className="h-4 w-4" />}
              label="Client"
            />
          </div>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="ai-name">Nom du projet</Label>
          <Input
            id="ai-name"
            value={draftEdit.name}
            onChange={(e) =>
              setDraftEdit({ ...draftEdit, name: e.target.value })
            }
            className="h-11 bg-foreground/[0.03]"
          />
        </div>

        {/* Client (if applicable) */}
        {draftEdit.kind === "client" ? (
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={(v) => setClientId(v ?? "")}>
              <SelectTrigger className="h-11 bg-foreground/[0.03]">
                <SelectValue placeholder="Sélectionne un client…" />
              </SelectTrigger>
              <SelectContent>
                {clients.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Aucun client. Crée-en un depuis l'onglet Équipe.
                  </div>
                ) : (
                  clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                        c.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="ai-desc">Description</Label>
          <textarea
            id="ai-desc"
            value={draftEdit.description}
            onChange={(e) =>
              setDraftEdit({ ...draftEdit, description: e.target.value })
            }
            rows={3}
            className="w-full rounded-lg border border-foreground/10 bg-foreground/[0.03] p-3 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Producteurs */}
        <div className="space-y-2">
          <Label>Qui gère ce projet ?</Label>
          <div className="space-y-1.5 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
            {producteurs.map((p) => {
              const label =
                [p.first_name, p.last_name].filter(Boolean).join(" ") ||
                p.email;
              const isMe = p.id === currentUserId;
              return (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={selectedProducteurs.has(p.id)}
                    onCheckedChange={() => toggleProducteur(p.id)}
                  />
                  <span>
                    {label}
                    {isMe ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        (toi)
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Episodes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>
              Émissions proposées
              <span className="ml-1 text-[11px] normal-case text-muted-foreground">
                · {draftEdit.episodes.length}
              </span>
            </Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                setDraftEdit({
                  ...draftEdit,
                  episodes: [
                    ...draftEdit.episodes,
                    {
                      name: "Nouvelle émission",
                      description: "",
                      format: "Reportage",
                      platforms: [],
                    },
                  ],
                })
              }
              className="h-8 gap-1 text-xs"
            >
              <Plus className="h-3 w-3" />
              Ajouter
            </Button>
          </div>

          <div className="space-y-2">
            {draftEdit.episodes.map((ep, idx) => (
              <div
                key={idx}
                className="space-y-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 rounded-md border border-foreground/10 bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    #{idx + 1}
                  </span>
                  <Input
                    value={ep.name}
                    onChange={(e) => {
                      const next = [...draftEdit.episodes];
                      next[idx] = { ...ep, name: e.target.value };
                      setDraftEdit({ ...draftEdit, episodes: next });
                    }}
                    className="h-9 flex-1 bg-foreground/[0.03] text-sm font-medium"
                  />
                  <Select
                    value={ep.format}
                    onValueChange={(v) => {
                      const next = [...draftEdit.episodes];
                      next[idx] = {
                        ...ep,
                        format: (v ?? "Reportage") as typeof ep.format,
                      };
                      setDraftEdit({ ...draftEdit, episodes: next });
                    }}
                  >
                    <SelectTrigger className="h-9 w-36 bg-foreground/[0.03] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        [
                          "Reportage",
                          "Interview",
                          "Capsule",
                          "Documentaire",
                          "Live",
                          "Tutoriel",
                          "Autre",
                        ] as const
                      ).map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => {
                      const next = draftEdit.episodes.filter(
                        (_, i) => i !== idx,
                      );
                      setDraftEdit({ ...draftEdit, episodes: next });
                    }}
                    className="mt-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Supprimer cette émission"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <textarea
                  value={ep.description}
                  onChange={(e) => {
                    const next = [...draftEdit.episodes];
                    next[idx] = { ...ep, description: e.target.value };
                    setDraftEdit({ ...draftEdit, episodes: next });
                  }}
                  rows={2}
                  placeholder="Synopsis…"
                  className="w-full rounded-md border border-foreground/10 bg-foreground/[0.03] p-2 text-xs placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
                />
                {ep.platforms.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {ep.platforms.map((p) => (
                      <Badge
                        key={p}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Skills hint */}
        {draftEdit.recommendedSkills.length > 0 ? (
          <div className="space-y-2">
            <Label className="text-muted-foreground">
              Compétences prestataires suggérées
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {draftEdit.recommendedSkills.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Non créées automatiquement. Ajoute-les manuellement dans
              l'onglet Compétences si besoin.
            </p>
          </div>
        ) : null}

        {/* Notes */}
        {draftEdit.notes ? (
          <div className="space-y-2">
            <Label className="text-muted-foreground">Notes de l'IA</Label>
            <p className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3 text-xs text-muted-foreground">
              {draftEdit.notes}
            </p>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      ) : null}

      <DialogFooter className="flex-col-reverse sm:flex-row">
        <Button
          type="button"
          variant="ghost"
          disabled={creating || generating}
          onClick={() => {
            setStage({ phase: "idea" });
            setDraftEdit(null);
            // Keep idea + pdf as-is so the user can iterate quickly
          }}
        >
          <RefreshCcw className="mr-2 h-3.5 w-3.5" />
          Recommencer
        </Button>
        <Button
          type="button"
          className="bg-gradient-neon text-white"
          disabled={creating || !draftEdit.name.trim()}
          onClick={create}
        >
          {creating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Création…
            </>
          ) : (
            "Créer ce projet"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function TypeChip({
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
      className={
        active
          ? "rounded-xl border border-primary/60 bg-primary/10 p-3 text-left transition-all"
          : "rounded-xl border border-border bg-foreground/[0.02] p-3 text-left transition-all hover:bg-foreground/[0.04]"
      }
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </div>
    </button>
  );
}
