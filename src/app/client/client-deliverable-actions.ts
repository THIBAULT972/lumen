"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Generates a signed URL for the client to download or stream a file in
 * their hub. Strict RLS check: the file must be in the public.files table
 * AND visible to the calling user via that table's RLS (which lets clients
 * see files where destination_user_id = them, or in their projects).
 */
export async function getClientDeliverableUrl(fileId: string): Promise<
  | { ok: true; url: string; filename: string; mimeType: string | null }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  // Use the *user*-scoped client so RLS enforces visibility.
  const { data: row, error } = await supabase
    .from("files")
    .select("storage_path, filename, mime_type, target")
    .eq("id", fileId)
    .maybeSingle();
  if (error || !row) {
    return { ok: false, error: "Fichier introuvable ou inaccessible." };
  }

  // The signed URL itself is generated with admin (no per-request RLS on
  // storage.objects). The line above already proved the user has read
  // access to the matching row in public.files.
  const admin = createAdminClient();
  const { data: signed, error: signedErr } = await admin.storage
    .from("files")
    .createSignedUrl(row.storage_path, 3600, {
      download: row.filename,
    });
  if (signedErr || !signed) {
    return { ok: false, error: signedErr?.message ?? "Erreur Storage." };
  }
  return {
    ok: true,
    url: signed.signedUrl,
    filename: row.filename,
    mimeType: row.mime_type,
  };
}

/**
 * Inline-streamable URL (no download header) — used for the HTML5 <video>
 * preview directly inside the client hub. Same RLS check as above.
 */
export async function getClientDeliverableStreamUrl(fileId: string): Promise<
  | { ok: true; url: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: row, error } = await supabase
    .from("files")
    .select("storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (error || !row) {
    return { ok: false, error: "Fichier introuvable ou inaccessible." };
  }

  const admin = createAdminClient();
  const { data: signed, error: signedErr } = await admin.storage
    .from("files")
    .createSignedUrl(row.storage_path, 3600);
  if (signedErr || !signed) {
    return { ok: false, error: signedErr?.message ?? "Erreur Storage." };
  }
  return { ok: true, url: signed.signedUrl };
}
