"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProducteur } from "@/lib/auth/guard";
import {
  summarizeMeeting,
  type MeetingSummary,
} from "@/lib/ai/meeting-summarizer";
import type {
  MeetingReportRow,
  MeetingReportStatus,
  MeetingReportWithProject,
} from "./meeting-types";

type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : T))
  | { ok: false; error: string };

const STORAGE_BUCKET = "files";
const MAX_AUDIO_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB (limite Google File API)
const ALLOWED_AUDIO_MIMES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/x-aac",
];

// ----------------------------------------------------------------------------
// PATH A — Texte collé (synchrone, gardé pour compat)
// ----------------------------------------------------------------------------

/**
 * Generate a summary inline (no persistence). Kept for backward compat with
 * the existing dashboard widget (which doesn't yet have history).
 */
export async function summarizeMeetingNotes(
  notes: string,
): Promise<Result<{ summary: MeetingSummary }>> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  return summarizeMeeting(notes);
}

/**
 * Same as above but also persist as a `meeting_report` row.
 * Returns the ID so the UI can navigate to the detail page.
 */
export async function createMeetingReportFromText(input: {
  notes: string;
  projectId?: string | null;
}): Promise<Result<{ reportId: string; summary: MeetingSummary }>> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const result = await summarizeMeeting(input.notes);
  if (!result.ok) return result;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("meeting_reports")
    .insert({
      created_by: guard.user.id,
      project_id: input.projectId ?? null,
      title: result.summary.title.slice(0, 200) || "Compte-rendu",
      source_type: "text",
      source_text: input.notes.trim().slice(0, 50000),
      status: "done" as MeetingReportStatus,
      summary: result.summary,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Erreur d'enregistrement." };
  }

  revalidatePath("/producteur");
  revalidatePath("/producteur/meetings");
  return { ok: true, reportId: data.id, summary: result.summary };
}

// ----------------------------------------------------------------------------
// PATH B — Audio uploadé (async via Edge Function)
// ----------------------------------------------------------------------------

export type MeetingAudioUploadInit =
  | {
      ok: true;
      reportId: string;
      storagePath: string;
      token: string;
      signedUrl: string;
    }
  | { ok: false; error: string };

/**
 * Step 1 : request a signed upload URL + create a `meeting_reports` row
 * in status='pending'. The browser uploads the audio directly to Storage
 * via the signed URL, then calls `triggerMeetingAudioProcessing` to
 * kick off the background pipeline.
 */
export async function requestMeetingAudioUpload(input: {
  filename: string;
  size: number;
  mimeType: string;
  projectId?: string | null;
}): Promise<MeetingAudioUploadInit> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, error: "Taille de fichier invalide." };
  }
  if (input.size > MAX_AUDIO_SIZE) {
    return {
      ok: false,
      error: `Fichier audio trop volumineux (max ${Math.round(MAX_AUDIO_SIZE / 1_073_741_824)} Go).`,
    };
  }
  const mime = (input.mimeType || "").toLowerCase();
  if (!ALLOWED_AUDIO_MIMES.includes(mime)) {
    return {
      ok: false,
      error: `Format audio non supporté. Utilise MP3, M4A, WAV, OGG, FLAC ou AAC.`,
    };
  }

  const cleanName = input.filename
    .replace(/[^a-zA-Z0-9._\-\s]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
  if (!cleanName) return { ok: false, error: "Nom de fichier invalide." };

  const id = crypto.randomUUID();
  const storagePath = `meeting-audio/${guard.user.id}/${id}-${cleanName}`;

  const admin = createAdminClient();

  // Crée d'abord la signed URL (si ça rate, on n'a rien à cleanup)
  const { data: signed, error: signedErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (signedErr || !signed) {
    return {
      ok: false,
      error: signedErr?.message ?? "Erreur Supabase Storage.",
    };
  }

  // Crée le record meeting_reports en 'pending'
  const { data: report, error: insertErr } = await admin
    .from("meeting_reports")
    .insert({
      created_by: guard.user.id,
      project_id: input.projectId ?? null,
      title: "Réunion en cours d'analyse…",
      source_type: "audio",
      audio_storage_path: storagePath,
      audio_size_bytes: input.size,
      status: "pending" as MeetingReportStatus,
    })
    .select("id")
    .single();
  if (insertErr || !report) {
    // cleanup signed URL is implicit (file not uploaded yet)
    return {
      ok: false,
      error: insertErr?.message ?? "Erreur d'enregistrement.",
    };
  }

  return {
    ok: true,
    reportId: report.id,
    storagePath: signed.path,
    token: signed.token,
    signedUrl: signed.signedUrl,
  };
}

/**
 * Step 2 : after the browser successfully uploaded the audio to the signed
 * URL, call this to trigger the Supabase Edge Function which downloads the
 * audio, sends it to Gemini Files API, and writes back the summary.
 *
 * Fire-and-forget on the server side : the function returns 202 immediately
 * and processes in background. The client subscribes to Realtime updates
 * on `meeting_reports.id = reportId` to know when it's done.
 */
export async function triggerMeetingAudioProcessing(
  reportId: string,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) {
    return {
      ok: false,
      error: "Configuration Supabase manquante côté serveur.",
    };
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/process-meeting-audio`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ report_id: reportId }),
      },
    );

    if (!res.ok && res.status !== 202) {
      const text = await res.text();
      console.error(
        `[meeting] edge function returned ${res.status}: ${text.slice(0, 300)}`,
      );
      // Mark the report as error so the UI can show something
      const admin = createAdminClient();
      await admin
        .from("meeting_reports")
        .update({
          status: "error" as MeetingReportStatus,
          error_message: `Echec déclenchement Edge Function (${res.status})`,
        })
        .eq("id", reportId);
      return {
        ok: false,
        error:
          "Impossible de démarrer le traitement audio. Vérifie que l'Edge Function `process-meeting-audio` est déployée.",
      };
    }

    revalidatePath("/producteur");
    revalidatePath("/producteur/meetings");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue.";
    console.error(`[meeting] trigger error: ${msg}`);
    return { ok: false, error: msg };
  }
}

/**
 * Cancel a pending/processing report (e.g. user closed the dialog before
 * the upload finished). Deletes the row and the audio file if any.
 */
export async function cancelMeetingReport(
  reportId: string,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("meeting_reports")
    .select("audio_storage_path, status")
    .eq("id", reportId)
    .maybeSingle();
  if (row?.audio_storage_path) {
    await admin.storage.from(STORAGE_BUCKET).remove([row.audio_storage_path]);
  }
  await admin.from("meeting_reports").delete().eq("id", reportId);
  revalidatePath("/producteur");
  revalidatePath("/producteur/meetings");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// READS (list / detail / search)
// ----------------------------------------------------------------------------

export async function listMeetingReports(input?: {
  projectId?: string | null;
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<Result<{ reports: MeetingReportWithProject[]; total: number }>> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const admin = createAdminClient();

  const limit = Math.min(input?.limit ?? 20, 100);
  const offset = Math.max(input?.offset ?? 0, 0);

  let query = admin
    .from("meeting_reports")
    .select(
      "id, created_by, project_id, title, source_type, source_text, audio_storage_path, audio_duration_seconds, audio_size_bytes, status, error_message, summary, created_at, updated_at, processed_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (input?.projectId !== undefined && input.projectId !== null) {
    query = query.eq("project_id", input.projectId);
  }
  if (input?.search && input.search.trim().length > 0) {
    // ILIKE simple sur search_text (la migration crée déjà un index GIN
    // tsvector pour des recherches plus poussées plus tard).
    query = query.ilike("search_text", `%${input.search.trim()}%`);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return { ok: false, error: error.message };

  // Fetch project names en une seule query pour les rows qui en ont un
  const projectIds = Array.from(
    new Set(
      (data ?? [])
        .map((r) => r.project_id)
        .filter((x): x is string => Boolean(x)),
    ),
  );
  const projectsById = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projs } = await admin
      .from("projects")
      .select("id, name")
      .in("id", projectIds);
    for (const p of projs ?? []) {
      projectsById.set(p.id as string, p.name as string);
    }
  }

  const reports: MeetingReportWithProject[] = (data ?? []).map((r) => ({
    ...(r as MeetingReportRow),
    project_name: r.project_id ? (projectsById.get(r.project_id) ?? null) : null,
  }));

  return { ok: true, reports, total: count ?? reports.length };
}

export async function getMeetingReport(
  reportId: string,
): Promise<Result<{ report: MeetingReportWithProject }>> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("meeting_reports")
    .select(
      "id, created_by, project_id, title, source_type, source_text, audio_storage_path, audio_duration_seconds, audio_size_bytes, status, error_message, summary, created_at, updated_at, processed_at",
    )
    .eq("id", reportId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Compte-rendu introuvable." };
  }

  let projectName: string | null = null;
  if (data.project_id) {
    const { data: proj } = await admin
      .from("projects")
      .select("name")
      .eq("id", data.project_id)
      .maybeSingle();
    projectName = (proj?.name as string | undefined) ?? null;
  }

  return {
    ok: true,
    report: { ...(data as MeetingReportRow), project_name: projectName },
  };
}

export async function deleteMeetingReport(
  reportId: string,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("meeting_reports")
    .select("audio_storage_path")
    .eq("id", reportId)
    .maybeSingle();
  if (row?.audio_storage_path) {
    await admin.storage.from(STORAGE_BUCKET).remove([row.audio_storage_path]);
  }

  const { error } = await admin
    .from("meeting_reports")
    .delete()
    .eq("id", reportId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/producteur");
  revalidatePath("/producteur/meetings");
  return { ok: true };
}

export async function attachMeetingToProject(input: {
  reportId: string;
  projectId: string | null;
}): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const { error } = await admin
    .from("meeting_reports")
    .update({ project_id: input.projectId })
    .eq("id", input.reportId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/producteur");
  revalidatePath("/producteur/meetings");
  return { ok: true };
}

/** Edit the title of a meeting report (so user can rename after IA-deduced one). */
export async function renameMeetingReport(input: {
  reportId: string;
  title: string;
}): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const title = input.title.trim().slice(0, 200);
  if (!title) return { ok: false, error: "Titre vide." };
  const { error } = await admin
    .from("meeting_reports")
    .update({ title })
    .eq("id", input.reportId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/producteur");
  revalidatePath("/producteur/meetings");
  return { ok: true };
}
