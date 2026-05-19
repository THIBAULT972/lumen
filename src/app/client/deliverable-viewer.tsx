"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Download,
  Film,
  FileText,
  FileImage,
  FileAudio,
  File as FileIcon,
  FileType2,
  Loader2,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getClientDeliverableStreamUrl,
  getClientDeliverableUrl,
} from "./client-deliverable-actions";
import type { FileRecord } from "../producteur/projets/file-types";

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

export function ClientDeliverableViewer({ file }: { file: FileRecord }) {
  const Icon = getFileIcon(file.mime_type);
  const isVideo = file.mime_type?.startsWith("video/") ?? false;
  const isImage = file.mime_type?.startsWith("image/") ?? false;
  const isAudio = file.mime_type?.startsWith("audio/") ?? false;

  const [showPreview, setShowPreview] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [downloading, startDownload] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Auto-load stream URL for images (light enough to preview eagerly)
  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    setLoadingStream(true);
    getClientDeliverableStreamUrl(file.id).then((r) => {
      if (cancelled) return;
      if (r.ok) setStreamUrl(r.url);
      else setError(r.error);
      setLoadingStream(false);
    });
    return () => {
      cancelled = true;
    };
  }, [file.id, isImage]);

  async function openPreview() {
    if (streamUrl) {
      setShowPreview(true);
      return;
    }
    setLoadingStream(true);
    setError(null);
    const r = await getClientDeliverableStreamUrl(file.id);
    setLoadingStream(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setStreamUrl(r.url);
    setShowPreview(true);
  }

  function handleDownload() {
    if (downloading) return;
    setError(null);
    startDownload(async () => {
      const r = await getClientDeliverableUrl(file.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }

      // ⚠ Sur Safari iOS, `window.open(signedUrl)` ouvre la vidéo en
      // lecture dans un nouvel onglet au lieu de la télécharger, MÊME si
      // le serveur envoie `Content-Disposition: attachment`. Safari
      // ignore le header pour les types media qu'il sait lire.
      //
      // Solution : on `fetch()` le fichier nous-même, on le transforme en
      // Blob (devient une URL `blob://` same-origin), puis on simule un
      // clic sur un `<a download>`. L'attribut `download` étant
      // same-origin sur un blob URL, Safari iOS le respecte cette fois et
      // affiche la bannière de download standard.
      //
      // Tradeoff : tout le fichier transite par la RAM du browser. Sur le
      // plan Free Supabase, le max par fichier est 50 Mo donc OK. Si on
      // passe en Pro avec des fichiers > 1 Go, il faudra un Service
      // Worker ou downloader via location.href.
      try {
        const resp = await fetch(r.url);
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const blob = await resp.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = r.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Délai avant revoke pour laisser le browser démarrer le download
        // (sur Safari iOS le download est asynchrone et lit l'URL après).
        setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur réseau";
        setError(`Téléchargement échoué : ${msg}`);
      }
    });
  }

  const canPreview = isVideo || isAudio || isImage;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-foreground/[0.02]">
      {/* Preview area */}
      {isImage && streamUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={streamUrl}
          alt={file.filename}
          className="aspect-video w-full object-cover"
        />
      ) : isVideo && showPreview && streamUrl ? (
        <video
          src={streamUrl}
          controls
          className="aspect-video w-full bg-black"
          preload="metadata"
        />
      ) : isAudio && showPreview && streamUrl ? (
        <div className="flex aspect-video items-center justify-center bg-foreground/[0.04] p-4">
          <audio src={streamUrl} controls className="w-full" />
        </div>
      ) : (
        // Placeholder card with type icon + click to preview
        <button
          type="button"
          onClick={canPreview ? openPreview : handleDownload}
          disabled={loadingStream}
          className="group flex aspect-video w-full flex-col items-center justify-center gap-2 bg-foreground/[0.04] transition-colors hover:bg-foreground/[0.06]"
        >
          {loadingStream ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Icon className="h-10 w-10 text-muted-foreground transition-colors group-hover:text-primary" />
              {canPreview ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Play className="h-3 w-3" />
                  Cliquer pour prévisualiser
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Cliquer pour télécharger
                </span>
              )}
            </>
          )}
        </button>
      )}

      {/* Filename + actions */}
      <div className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
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
              year: "numeric",
            })}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={downloading}
          onClick={handleDownload}
          aria-label="Télécharger"
          className="h-8 w-8 p-0"
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {error ? (
        <p className="border-t border-destructive/20 bg-destructive/5 px-3 py-1.5 text-[11px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
