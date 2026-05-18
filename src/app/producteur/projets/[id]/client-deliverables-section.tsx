"use client";

import { useRef, useState, useTransition } from "react";
import {
  Send,
  Upload,
  Loader2,
  AlertCircle,
  MoreHorizontal,
  Download,
  Trash2,
  Film,
  FileText,
  FileImage,
  FileAudio,
  File as FileIcon,
  FileType2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  cancelClientDeliverableUpload,
  deleteClientDeliverable,
  finalizeClientDeliverableUpload,
  requestClientDeliverableUpload,
  requestFileDownload,
} from "../actions";
import {
  uploadFileWithProgress,
  type UploadHandle,
} from "@/lib/storage/upload-with-progress";
import type { FileRecord } from "../file-types";

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} Ko`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} Mo`;
  return `${(bytes / 1_073_741_824).toFixed(2)} Go`;
}

function getFileIcon(mime: string | null) {
  if (!mime) return FileIcon;
  if (mime.startsWith("video/")) return Film;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime === "application/pdf") return FileText;
  if (mime.startsWith("application/vnd.openxmlformats")) return FileType2;
  if (mime.startsWith("text/")) return FileText;
  return FileIcon;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(0)} Ko`;
  if (n < 1_073_741_824) return `${(n / 1_048_576).toFixed(1)} Mo`;
  return `${(n / 1_073_741_824).toFixed(2)} Go`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm > 0 ? `${h}h ${mm}m` : `${h}h`;
}

export function ClientDeliverablesSection({
  projectId,
  clientName,
  files,
}: {
  projectId: string;
  clientName: string;
  files: FileRecord[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{
    filename: string;
    pct: number;
    loaded: number;
    total: number;
    speed: number; // bytes/sec, smoothed
    etaSec: number; // remaining seconds estimate
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploadHandleRef = useRef<UploadHandle | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    setProgress({
      filename: file.name,
      pct: 0,
      loaded: 0,
      total: file.size,
      speed: 0,
      etaSec: 0,
    });

    // On track le fileId pour pouvoir cleanup l'orphelin si le PUT échoue.
    let createdFileId: string | null = null;

    try {
      const init = await requestClientDeliverableUpload(
        projectId,
        file.name,
        file.type || "application/octet-stream",
        file.size,
      );
      if (!init.ok) {
        setError(init.error);
        return;
      }
      createdFileId = init.fileId;

      // Track speed via EWMA so the ETA doesn't jitter.
      const t0 = performance.now();
      let lastSampleAt = t0;
      let lastLoaded = 0;
      let smoothedSpeed = 0;

      const handle = uploadFileWithProgress(
        init.signedUrl,
        file,
        ({ loaded, total, pct }) => {
          const now = performance.now();
          const dt = (now - lastSampleAt) / 1000; // seconds
          if (dt > 0) {
            const instantSpeed = (loaded - lastLoaded) / dt; // B/s
            smoothedSpeed = smoothedSpeed === 0
              ? instantSpeed
              : smoothedSpeed * 0.7 + instantSpeed * 0.3;
            lastSampleAt = now;
            lastLoaded = loaded;
          }
          const remaining = total - loaded;
          const etaSec =
            smoothedSpeed > 0 ? Math.round(remaining / smoothedSpeed) : 0;
          setProgress({
            filename: file.name,
            pct,
            loaded,
            total,
            speed: smoothedSpeed,
            etaSec,
          });
        },
      );
      uploadHandleRef.current = handle;

      const r = await handle.promise;
      uploadHandleRef.current = null;

      if (!r.ok) {
        setError(r.error);
        // Nettoie le record orphelin pour ne pas afficher un livrable mort
        // côté client (téléchargement renverrait "Object not found").
        await cancelClientDeliverableUpload(createdFileId, projectId);
        createdFileId = null;
        return;
      }
      createdFileId = null; // upload OK, plus rien à nettoyer
      await finalizeClientDeliverableUpload(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'envoi inconnue.");
      if (createdFileId) {
        await cancelClientDeliverableUpload(createdFileId, projectId);
      }
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(null), 1200);
    }
  }

  function cancelUpload() {
    uploadHandleRef.current?.abort();
    uploadHandleRef.current = null;
    setUploading(false);
    setProgress(null);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Send className="h-3.5 w-3.5" />
            Livrables client
            <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">
              · {files.length}
            </span>
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Fichiers visibles par{" "}
            <strong className="text-foreground">{clientName}</strong> dans son
            hub. Vidéos, exports, livrables finaux…
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="bg-gradient-neon text-white"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Envoi…
            </>
          ) : (
            <>
              <Upload className="mr-2 h-3.5 w-3.5" />
              Déposer
            </>
          )}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onChange}
      />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="rounded-xl border border-dashed border-border bg-foreground/[0.02] p-4 transition-colors hover:bg-foreground/[0.04]"
      >
        {files.length === 0 ? (
          <div className="py-4 text-center">
            <Send className="mx-auto h-5 w-5 text-muted-foreground/60" />
            <p className="mt-2 text-xs text-muted-foreground">
              Glisse un fichier ici ou clique « Déposer ».
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground/60">
              Vidéos, PDF, photos, audios… jusqu'à 5 Go par fichier.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {files.map((f) => (
              <DeliverableRow
                key={f.id}
                file={f}
                projectId={projectId}
              />
            ))}
          </ul>
        )}
      </div>

      {progress ? (
        <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              <span className="truncate text-foreground">
                {progress.filename}
              </span>
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-foreground tabular-nums">
                {progress.pct}%
              </span>
              {uploading ? (
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-destructive"
                  aria-label="Annuler l'envoi"
                  title="Annuler"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
            <div
              className="h-full bg-gradient-neon transition-[width] duration-200 ease-out"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className="text-[10px] tabular-nums text-muted-foreground">
            {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
            {progress.speed > 0 ? (
              <>
                {" · "}
                {formatBytes(progress.speed)}/s
              </>
            ) : null}
            {progress.etaSec > 0 && progress.pct < 100 ? (
              <>
                {" · "}
                ~{formatEta(progress.etaSec)} restant
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      ) : null}
    </section>
  );
}

function DeliverableRow({
  file,
  projectId,
}: {
  file: FileRecord;
  projectId: string;
}) {
  const Icon = getFileIcon(file.mime_type);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [downloading, startDownload] = useTransition();

  function handleDownload() {
    if (downloading) return;
    startDownload(async () => {
      const r = await requestFileDownload(file.id);
      if (!r.ok) {
        alert(r.error);
        return;
      }
      window.open(r.url, "_blank", "noopener");
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-foreground/[0.04]">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="min-w-0 flex-1 text-left transition-colors hover:text-primary"
        title={file.filename}
      >
        <p className="truncate text-sm font-medium leading-tight">
          {file.filename}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatSize(file.size_bytes)}
          {" · "}
          {new Date(file.created_at).toLocaleDateString("fr-FR", {
            timeZone: "America/Martinique",
            day: "2-digit",
            month: "short",
          })}
        </p>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-md p-1.5 transition-colors hover:bg-foreground/[0.08]"
          aria-label="Actions fichier"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="border-foreground/10"
        >
          <DropdownMenuItem onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Télécharger
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Retirer du hub client
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DeleteDialog
          file={file}
          projectId={projectId}
          onOpenChange={setDeleteOpen}
        />
      </Dialog>
    </li>
  );
}

function DeleteDialog({
  file,
  projectId,
  onOpenChange,
}: {
  file: FileRecord;
  projectId: string;
  onOpenChange: (v: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await deleteClientDeliverable(file.id, projectId);
      if (!r.ok) setError(r.error);
      else onOpenChange(false);
    });
  }

  return (
    <DialogContent className="border-foreground/10 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl font-light">
          Retirer ce livrable ?
        </DialogTitle>
        <DialogDescription>
          <strong className="text-foreground">{file.filename}</strong> sera
          retiré du hub client et supprimé du stockage. Action irréversible.
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          Annuler
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={submit}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Suppression…
            </>
          ) : (
            "Retirer"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
