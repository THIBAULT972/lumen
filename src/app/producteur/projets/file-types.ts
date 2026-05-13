// Pure types for files (Supabase Storage + public.files row).

export const FILE_TARGETS = [
  "project",
  "episode",
  "mission",
  "hub_client",
  "hub_prestataire",
] as const;
export type FileTarget = (typeof FILE_TARGETS)[number];

export type FileRecord = {
  id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  target: FileTarget;
  project_id: string | null;
  episode_id: string | null;
  mission_id: string | null;
  destination_user_id: string | null;
  uploaded_by: string | null;
  created_at: string;
};
