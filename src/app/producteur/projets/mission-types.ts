// Pure types + constants for missions. Lives outside actions.ts because
// Next requires "use server" files to only export async functions.

export const MISSION_STATUSES = [
  "draft",       // créée, pas encore envoyée aux prestataires
  "broadcast",   // envoyée à tous les prestataires de la compétence
  "accepted",    // acceptée par un prestataire
  "in_progress", // tournage en cours
  "completed",   // terminée
  "cancelled",   // annulée
] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

/** Payload utilisé pour create + update (form du producteur). */
export type MissionPayload = {
  required_skill_id: string;
  title: string;
  description: string | null;
  location: string | null;
  /** YYYY-MM-DD (locale Martinique) */
  scheduled_date: string;
  /** HH:MM */
  scheduled_time: string | null;
  duration_minutes: number | null;
  /** Saisi en euros côté UI, converti en cents côté serveur. */
  price_euros: number | null;
  contact_name: string | null;
  contact_phone: string | null;
};
