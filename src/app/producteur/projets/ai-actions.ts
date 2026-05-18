"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProducteur } from "@/lib/auth/guard";
import {
  generateProjectDraft as runGenerator,
  type ProjectDraft,
} from "@/lib/ai/project-generator";

type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : T))
  | { ok: false; error: string };

export type DraftResult = Result<{ draft: ProjectDraft }>;

const STORAGE_BUCKET = "files";
const MAX_AI_PDF_SIZE = 20 * 1024 * 1024; // 20 MB (Gemini inline safe ceiling)

// ----------------------------------------------------------------------------
// STEP 0 — Browser uploads the PDF directly to Supabase Storage via signed URL.
// We bypass Next.js server-action body limits and use no extra server bandwidth.
// ----------------------------------------------------------------------------

export type AiPdfUploadInit =
  | { ok: true; storagePath: string; token: string }
  | { ok: false; error: string };

export async function requestAiPdfUpload(
  filename: string,
  size: number,
): Promise<AiPdfUploadInit> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: "Taille de fichier invalide." };
  }
  if (size > MAX_AI_PDF_SIZE) {
    return {
      ok: false,
      error: `PDF trop volumineux (${(size / 1_048_576).toFixed(1)} Mo). Max ${MAX_AI_PDF_SIZE / 1_048_576} Mo pour l'analyse IA.`,
    };
  }
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return {
      ok: false,
      error: "Seuls les fichiers PDF sont acceptés pour l'instant.",
    };
  }

  const id = crypto.randomUUID();
  const storagePath = `ai-temp/${id}.pdf`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Erreur Supabase Storage." };
  }
  return { ok: true, storagePath: data.path, token: data.token };
}

// ----------------------------------------------------------------------------
// STEP 1 — Generate the draft. Accepts either a pure idea text, or also a
// pdfStoragePath. If pdfStoragePath is provided, the server downloads the
// PDF from Storage (admin client, no size limit) and feeds bytes to Gemini.
// The temporary file is cleaned up after generation (best-effort).
// ----------------------------------------------------------------------------

export async function generateAiProjectDraft(input: {
  idea: string;
  pdfStoragePath?: string;
}): Promise<DraftResult> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const idea = (input.idea ?? "").trim();
  const storagePath = input.pdfStoragePath?.trim() || null;

  let attachment:
    | { bytes: Uint8Array; mimeType: string; filename?: string }
    | undefined;

  if (storagePath) {
    // Refuse paths from outside our ai-temp/ folder to avoid users feeding
    // arbitrary Storage files to the AI via this action.
    if (!storagePath.startsWith("ai-temp/")) {
      return { ok: false, error: "Chemin PDF non autorisé." };
    }
    const admin = createAdminClient();
    const { data: blob, error: dlErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);
    if (dlErr || !blob) {
      return {
        ok: false,
        error: dlErr?.message ?? "PDF introuvable dans Storage.",
      };
    }
    if (blob.size > MAX_AI_PDF_SIZE) {
      // Cleanup
      await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return {
        ok: false,
        error: `PDF trop volumineux après upload (${(blob.size / 1_048_576).toFixed(1)} Mo).`,
      };
    }
    const buf = await blob.arrayBuffer();
    attachment = {
      bytes: new Uint8Array(buf),
      mimeType: "application/pdf",
    };
  }

  const result = await runGenerator({ idea, attachment });

  // Cleanup the temp PDF either way — we don't need it after Gemini analyzed it.
  if (storagePath) {
    try {
      const admin = createAdminClient();
      await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
    } catch {
      // best-effort
    }
  }

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, draft: result.draft };
}

/** Allow the UI to discard a Storage upload if the user changes their mind. */
export async function discardAiPdf(storagePath: string): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  if (!storagePath.startsWith("ai-temp/")) return { ok: true };
  const admin = createAdminClient();
  await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
  return { ok: true };
}

// ----------------------------------------------------------------------------
// STEP 2 — Create the project + episodes from the (potentially edited) draft.
// (unchanged)
// ----------------------------------------------------------------------------

export async function createProjectFromAiDraft(input: {
  draft: ProjectDraft;
  producteurIds: string[];
  clientId?: string | null;
}): Promise<Result<{ projectId: string }>> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const { draft, producteurIds, clientId } = input;

  if (producteurIds.length === 0) {
    return {
      ok: false,
      error: "Sélectionne au moins un producteur gestionnaire.",
    };
  }
  if (draft.kind === "client" && !clientId) {
    return {
      ok: false,
      error: "Type 'client' sélectionné mais aucun client choisi.",
    };
  }

  const admin = createAdminClient();

  const { data: project, error: projErr } = await admin
    .from("projects")
    .insert({
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      client_id: draft.kind === "client" ? clientId ?? null : null,
      created_by: guard.user.id,
    })
    .select("id")
    .single();
  if (projErr || !project) {
    return { ok: false, error: projErr?.message ?? "Erreur projet." };
  }

  const { error: ppErr } = await admin.from("project_producteurs").insert(
    producteurIds.map((uid) => ({ project_id: project.id, user_id: uid })),
  );
  if (ppErr) {
    await admin.from("projects").delete().eq("id", project.id);
    return {
      ok: false,
      error: `Erreur d'assignation producteurs : ${ppErr.message}`,
    };
  }

  if (draft.episodes.length > 0) {
    const rows = draft.episodes.map((ep, idx) => ({
      project_id: project.id,
      name: ep.name.trim(),
      description: ep.description.trim() || null,
      format: ep.format || null,
      platforms: ep.platforms ?? [],
      status: "idea" as const,
      order_index: idx,
    }));
    const { error: epErr } = await admin.from("episodes").insert(rows);
    if (epErr) {
      console.warn("[AI] episodes insert error:", epErr.message);
    }
  }

  revalidatePath("/producteur/projets");
  revalidatePath("/producteur");
  return { ok: true, projectId: project.id };
}
