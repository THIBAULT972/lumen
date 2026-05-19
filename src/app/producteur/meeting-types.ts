// Types partagés pour les comptes-rendus de réunion.
// Vit hors de actions.ts (règle "use server" = exports async-only).

import type { MeetingSummary } from "@/lib/ai/meeting-summarizer";

export type MeetingReportStatus =
  | "pending"
  | "uploading"
  | "analyzing"
  | "done"
  | "error";

export type MeetingReportRow = {
  id: string;
  created_by: string;
  project_id: string | null;
  title: string;
  source_type: "text" | "audio";
  source_text: string | null;
  audio_storage_path: string | null;
  audio_duration_seconds: number | null;
  audio_size_bytes: number | null;
  status: MeetingReportStatus;
  error_message: string | null;
  summary: MeetingSummary | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
};

// Avec le nom du projet jointé (utile pour la liste).
export type MeetingReportWithProject = MeetingReportRow & {
  project_name: string | null;
};

export const STATUS_LABEL: Record<MeetingReportStatus, string> = {
  pending: "En attente",
  uploading: "Envoi audio…",
  analyzing: "Analyse…",
  done: "Prêt",
  error: "Erreur",
};
