// Pure types + constants shared between the UI and the server actions.
// Lives outside actions.ts because Next requires that "use server" files
// export only async functions.

export const EPISODE_STATUSES = [
  "idea",
  "planning",
  "shooting",
  "editing",
  "delivered",
  "published",
] as const;
export type EpisodeStatus = (typeof EPISODE_STATUSES)[number];

export type EpisodePayload = {
  name: string;
  format: string | null;
  status: EpisodeStatus;
  production_date: string | null;
  production_time: string | null;
  duration_minutes: number | null;
  publication_date: string | null;
  location: string | null;
  guests: string[];
  equipment: string[];
  platforms: string[];
  notes: string | null;
  description: string | null;
};
