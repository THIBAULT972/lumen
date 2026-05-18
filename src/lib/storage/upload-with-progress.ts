/**
 * Browser helper to PUT a file directly to a Supabase Storage signed upload
 * URL, with byte-level progress tracking (via XMLHttpRequest).
 *
 * Why not the supabase-js helper `uploadToSignedUrl()`?
 * That helper uses fetch() under the hood, which doesn't expose upload
 * progress in browsers. For multi-hundred-MB files we *need* a real
 * progress bar — XHR is the only browser API that gives `upload.onprogress`.
 */

export type UploadProgress = {
  loaded: number;
  total: number;
  pct: number;
};

export type UploadResult =
  | { ok: true }
  | { ok: false; error: string };

export type UploadHandle = {
  promise: Promise<UploadResult>;
  abort: () => void;
};

/**
 * Uploads `file` to `signedUrl` (full URL returned by Supabase
 * `createSignedUploadUrl().data.signedUrl`).
 *
 * - `onProgress` is called repeatedly with bytes uploaded so far.
 * - Returns an `UploadHandle`: `.promise` for the result, `.abort()` to
 *   cancel.
 */
export function uploadFileWithProgress(
  signedUrl: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<UploadResult>((resolve) => {
    xhr.open("PUT", signedUrl, true);

    // Supabase expects the file as raw body. Content-Type optional but
    // helpful for proper MIME storage.
    if (file.type) {
      xhr.setRequestHeader("Content-Type", file.type);
    }
    // Default cache-control matching what supabase-js sets.
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");

    xhr.upload.onprogress = (e) => {
      if (!onProgress) return;
      if (!e.lengthComputable) {
        // Total unknown — at least report bytes loaded.
        onProgress({ loaded: e.loaded, total: file.size, pct: 0 });
        return;
      }
      onProgress({
        loaded: e.loaded,
        total: e.total,
        pct: Math.min(100, Math.round((e.loaded / e.total) * 100)),
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({ loaded: file.size, total: file.size, pct: 100 });
        resolve({ ok: true });
      } else {
        resolve({
          ok: false,
          error: `Upload échoué (HTTP ${xhr.status}) : ${xhr.responseText.slice(0, 200) || "réponse vide"}`,
        });
      }
    };

    xhr.onerror = () =>
      resolve({
        ok: false,
        error: "Erreur réseau pendant l'envoi.",
      });
    xhr.onabort = () =>
      resolve({ ok: false, error: "Envoi annulé." });

    xhr.send(file);
  });

  return {
    promise,
    abort: () => xhr.abort(),
  };
}
