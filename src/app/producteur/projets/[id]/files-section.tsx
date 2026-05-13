"use client";

import { useRef, useState, useTransition } from "react";
import {
  Paperclip,
  Upload,
  Loader2,
  AlertCircle,
  MoreHorizontal,
  Download,
  Trash2,
  FileText,
  FileImage,
  Film,
  File as FileIcon,
  FileType2,
  FileAudio,
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
import { createClient } from "@/lib/supabase/client";
import {
  deleteEpisodeFile,
  finalizeEpisodeFileUpload,
  requestEpisodeFileUpload,
  requestFileDownload,
} from "../actions";
import type { FileRecord } from "../file-types";

const STORAGE_BUCKET = "files";

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} Ko`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} Mo`;
  return `${(bytes / 1_073_741_824).toFixed(2)} Go`;
}

/** Pick a Lucide icon based on the mime type. */
function getFileIcon(mime: string | null) {
  if (!mime) return FileIcon;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return Film;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime === "application/pdf") return FileText;
  if (
    mime.startsWith("application/vnd.openxmlformats-officedocument") ||
    mime === "application/msword" ||
    mime === "application/vnd.oasis.opendocument.text"
  ) {
    return FileType2;
  }
  if (mime.startsWith("text/")) return FileText;
  return FileIcon;
}

export function FilesSection({
  episodeId,
  projectId,
  files,
}: {
  episodeId: string;
  projectId: string;
  files: FileRecord[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ filename: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    setProgress({ filename: file.name, pct: 0 });
    try {
      // Step 1 — server creates row + signed URL
      const init = await requestEpisodeFileUpload(
        episodeId,
        projectId,
        file.name,
        file.type || "application/octet-stream",
        file.size,
      );
      if (!init.ok) {
        setError(init.error);
        return;
      }

      // Step 2 — direct upload to Supabase Storage via signed URL.
      // We use the browser client's uploadToSignedUrl helper, which wraps
      // a PUT with the right headers.
      const supabase = createClient();
      setProgress({ filename: file.name, pct: 50 });
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .uploadToSignedUrl(init.storagePath, init.token, file);
      if (upErr) {
        setError(upErr.message);
        return;
      }

      setProgress({ filename: file.name, pct: 100 });
      // Step 3 — refresh server cache so the new file appears
      await finalizeEpisodeFileUpload(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'envoi inconnue.");
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(null), 800);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    // Reset so the same file can be re-selected if needed
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          Fichiers techniques
          <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">
            · {files.length}
          </span>
        </Label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="h-8 gap-1.5 text-xs"
        >
          {uploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Envoi…
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              Déposer un fichier
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

      {/* Drop zone (always visible, doubles as empty-state) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={onDrop}
        className="rounded-xl border border-dashed border-border bg-foreground/[0.02] p-4 transition-colors hover:bg-foreground/[0.04]"
      >
        {files.length === 0 ? (
          <div className="py-4 text-center">
            <Upload className="mx-auto h-5 w-5 text-muted-foreground/60" />
            <p className="mt-2 text-xs text-muted-foreground">
              Glisse un fichier ici ou clique sur « Déposer un fichier ».
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground/60">
              PDF, Word, vidéos, photos… 500 Mo max par fichier.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {files.map((f) => (
              <FileRow key={f.id} file={f} projectId={projectId} />
            ))}
          </ul>
        )}
      </div>

      {progress ? (
        <p className="text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Envoi de <span className="text-foreground">{progress.filename}</span>
            … {progress.pct}%
          </span>
        </p>
      ) : null}

      {error ? (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FileRow({
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
      // Open in new tab. The signed URL forces "Save As" with the filename.
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
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DeleteFileDialog
          file={file}
          projectId={projectId}
          onOpenChange={setDeleteOpen}
        />
      </Dialog>
    </li>
  );
}

function DeleteFileDialog({
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
      const r = await deleteEpisodeFile(file.id, projectId);
      if (!r.ok) setError(r.error);
      else onOpenChange(false);
    });
  }

  return (
    <DialogContent className="border-foreground/10 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl font-light">
          Supprimer le fichier ?
        </DialogTitle>
        <DialogDescription>
          <strong className="text-foreground">{file.filename}</strong> sera
          supprimé du stockage. Action irréversible.
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
            "Supprimer"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
