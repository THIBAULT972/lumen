"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProducteur } from "@/lib/auth/guard";
import {
  DEFAULT_SIZES,
  type Board,
  type BoardConnection,
  type BoardItem,
  type BoardItemContent,
  type BoardItemType,
} from "./board-types";

type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : T))
  | { ok: false; error: string };

/**
 * Lazily creates the board for a project (one and only one) and returns it.
 * Called from the board page on first load.
 */
export async function ensureProjectBoard(
  projectId: string,
): Promise<Result<{ board: Board }>> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("boards")
    .select("id, project_id, name, background, created_at, updated_at")
    .eq("project_id", projectId)
    .maybeSingle();

  if (existing) return { ok: true, board: existing as Board };

  const { data: created, error } = await admin
    .from("boards")
    .insert({
      project_id: projectId,
      created_by: guard.user.id,
    })
    .select("id, project_id, name, background, created_at, updated_at")
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message ?? "Erreur de création du board." };
  }
  return { ok: true, board: created as Board };
}

export type CreateItemResult = Result<{ item: BoardItem }>;

export async function createBoardItem(
  boardId: string,
  projectId: string,
  type: BoardItemType,
  content: BoardItemContent,
  position: { x: number; y: number },
): Promise<CreateItemResult> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const size = DEFAULT_SIZES[type];
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("board_items")
    .insert({
      board_id: boardId,
      type,
      content,
      position_x: Math.round(position.x),
      position_y: Math.round(position.y),
      width: size.width,
      height: size.height,
      created_by: guard.user.id,
    })
    .select(
      "id, board_id, type, content, position_x, position_y, width, height, z_index, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Erreur de création." };
  }

  revalidatePath(`/producteur/projets/${projectId}/board`);
  return { ok: true, item: data as BoardItem };
}

/** Patch shape : seuls les champs fournis sont mis à jour. */
export type UpdateItemPatch = {
  content?: BoardItemContent;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  z_index?: number;
};

export async function updateBoardItem(
  itemId: string,
  projectId: string,
  patch: UpdateItemPatch,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const update: Record<string, unknown> = {};
  if (patch.content !== undefined) update.content = patch.content;
  if (patch.position_x !== undefined) update.position_x = Math.round(patch.position_x);
  if (patch.position_y !== undefined) update.position_y = Math.round(patch.position_y);
  if (patch.width !== undefined) update.width = Math.round(patch.width);
  if (patch.height !== undefined) update.height = Math.round(patch.height);
  if (patch.z_index !== undefined) update.z_index = Math.round(patch.z_index);

  if (Object.keys(update).length === 0) return { ok: true };

  const admin = createAdminClient();
  const { error } = await admin
    .from("board_items")
    .update(update)
    .eq("id", itemId);

  if (error) return { ok: false, error: error.message };

  // Pas de revalidatePath ici : les drags génèrent N appels par seconde.
  // La UI met à jour son state local en optimiste, le SSR sera frais
  // au prochain chargement de page.
  return { ok: true };
}

export async function deleteBoardItem(
  itemId: string,
  projectId: string,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const admin = createAdminClient();
  const { error } = await admin.from("board_items").delete().eq("id", itemId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/producteur/projets/${projectId}/board`);
  return { ok: true };
}

// ============================================================================
// IMAGE UPLOAD pour les cartes type "image"
// Workflow identique à l'upload de fichiers d'épisode (2 étapes via signed URL).
// ============================================================================

export type BoardImageUploadInitResult =
  | { ok: true; storagePath: string; token: string }
  | { ok: false; error: string };

const BOARD_STORAGE_BUCKET = "files";
const BOARD_MAX_IMAGE_SIZE = 26_214_400; // 25 MB pour une image (raisonnable)

function sanitize(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._\-\s]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

export async function requestBoardImageUpload(
  boardId: string,
  filename: string,
  size: number,
): Promise<BoardImageUploadInitResult> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const clean = sanitize(filename);
  if (!clean) return { ok: false, error: "Nom de fichier invalide." };
  if (!Number.isFinite(size) || size < 0) {
    return { ok: false, error: "Taille invalide." };
  }
  if (size > BOARD_MAX_IMAGE_SIZE) {
    return {
      ok: false,
      error: `Image trop volumineuse (max ${BOARD_MAX_IMAGE_SIZE / 1_048_576} Mo).`,
    };
  }

  const id = crypto.randomUUID();
  const storagePath = `board/${boardId}/${id}-${clean}`;

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from(BOARD_STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !signed) {
    return { ok: false, error: error?.message ?? "Erreur Storage." };
  }
  return { ok: true, storagePath: signed.path, token: signed.token };
}

export async function getBoardImageUrl(
  storagePath: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BOARD_STORAGE_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Erreur Storage." };
  }
  return { ok: true, url: data.signedUrl };
}

// ============================================================================
// CONNECTIONS (flèches entre cartes)
// ============================================================================

export type CreateConnectionResult = Result<{ connection: BoardConnection }>;

export async function createBoardConnection(
  boardId: string,
  projectId: string,
  fromItemId: string,
  toItemId: string,
  label?: string | null,
): Promise<CreateConnectionResult> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  if (fromItemId === toItemId) {
    return { ok: false, error: "Une carte ne peut pas se connecter à elle-même." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("board_connections")
    .insert({
      board_id: boardId,
      from_item_id: fromItemId,
      to_item_id: toItemId,
      label: label?.trim() || null,
      created_by: guard.user.id,
    })
    .select("id, board_id, from_item_id, to_item_id, label, created_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Erreur de connexion." };
  }
  revalidatePath(`/producteur/projets/${projectId}/board`);
  return { ok: true, connection: data as BoardConnection };
}

export async function deleteBoardConnection(
  connectionId: string,
  projectId: string,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const admin = createAdminClient();
  const { error } = await admin
    .from("board_connections")
    .delete()
    .eq("id", connectionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/producteur/projets/${projectId}/board`);
  return { ok: true };
}
