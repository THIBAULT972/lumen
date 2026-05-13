// Types partagés UI <-> server pour le moodboard. Hors actions.ts pour
// respecter la règle Next "use server" = exports async only.

export type BoardItemType = "note" | "image" | "link" | "todo";

export type NoteContent = {
  text: string;
  color?: string | null; // ex: "#fde68a" (jaune post-it) — optionnel
};

export type ImageContent = {
  storage_path: string; // chemin Supabase Storage
  filename: string;
  alt?: string | null;
};

export type LinkContent = {
  url: string;
  title?: string | null;
  description?: string | null;
};

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
};

export type TodoContent = {
  title?: string | null;
  items: TodoItem[];
};

export type BoardItemContent =
  | NoteContent
  | ImageContent
  | LinkContent
  | TodoContent;

export type BoardItem = {
  id: string;
  board_id: string;
  type: BoardItemType;
  content: BoardItemContent;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  z_index: number;
  created_at: string;
  updated_at: string;
};

export type Board = {
  id: string;
  project_id: string;
  name: string;
  background: string | null;
  created_at: string;
  updated_at: string;
};

export type BoardConnection = {
  id: string;
  board_id: string;
  from_item_id: string;
  to_item_id: string;
  label: string | null;
  created_at: string;
};

/** Couleurs préset pour les notes (post-it style). */
export const NOTE_COLORS = [
  { id: "default", hex: null, label: "Neutre" },
  { id: "yellow", hex: "#fde68a", label: "Jaune" },
  { id: "pink", hex: "#fbcfe8", label: "Rose" },
  { id: "blue", hex: "#bfdbfe", label: "Bleu" },
  { id: "green", hex: "#bbf7d0", label: "Vert" },
  { id: "violet", hex: "#ddd6fe", label: "Violet" },
];

/** Dimensions par défaut selon le type d'item. */
export const DEFAULT_SIZES: Record<BoardItemType, { width: number; height: number }> = {
  note: { width: 240, height: 180 },
  image: { width: 280, height: 200 },
  link: { width: 320, height: 120 },
  todo: { width: 280, height: 240 },
};
