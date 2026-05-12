"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProducteur } from "@/lib/auth/guard";

type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : T))
  | { ok: false; error: string };

// ============================================================================
// PROJECTS
// ============================================================================

export type CreateProjectState = Result<{ projectId: string }> | null;

export async function createProject(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const kind = String(formData.get("kind") ?? ""); // "client" | "media"
  const clientIdRaw = String(formData.get("client_id") ?? "").trim();

  if (!name) return { ok: false, error: "Nom requis." };
  if (kind !== "client" && kind !== "media") {
    return { ok: false, error: "Type de projet invalide." };
  }
  if (kind === "client" && !clientIdRaw) {
    return { ok: false, error: "Sélectionne le client associé." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .insert({
      name,
      description: description || null,
      client_id: kind === "client" ? clientIdRaw : null,
      created_by: guard.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Erreur de création." };
  }

  revalidatePath("/producteur/projets");
  revalidatePath("/producteur");
  return { ok: true, projectId: data.id };
}

export type UpdateProjectState = Result | null;

export async function updateProject(
  projectId: string,
  _prev: UpdateProjectState,
  formData: FormData,
): Promise<UpdateProjectState> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const clientIdRaw = String(formData.get("client_id") ?? "").trim();

  if (!name) return { ok: false, error: "Nom requis." };
  if (kind !== "client" && kind !== "media") {
    return { ok: false, error: "Type de projet invalide." };
  }
  if (kind === "client" && !clientIdRaw) {
    return { ok: false, error: "Sélectionne le client associé." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("projects")
    .update({
      name,
      description: description || null,
      client_id: kind === "client" ? clientIdRaw : null,
    })
    .eq("id", projectId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/producteur/projets");
  revalidatePath(`/producteur/projets/${projectId}`);
  return { ok: true };
}

export async function archiveProject(
  projectId: string,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const admin = createAdminClient();
  const { error } = await admin
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/producteur/projets");
  revalidatePath("/producteur");
  return { ok: true };
}

export async function restoreProject(projectId: string): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const admin = createAdminClient();
  const { error } = await admin
    .from("projects")
    .update({ archived_at: null })
    .eq("id", projectId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/producteur/projets");
  revalidatePath("/producteur");
  return { ok: true };
}

export async function deleteProject(projectId: string): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  // Cascade: episodes → missions → files → text_documents all delete via FK.
  const admin = createAdminClient();
  const { error } = await admin.from("projects").delete().eq("id", projectId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/producteur/projets");
  revalidatePath("/producteur");
  return { ok: true };
}

// ============================================================================
// EPISODES
// ============================================================================

export type CreateEpisodeState = Result | null;

export async function createEpisode(
  projectId: string,
  _prev: CreateEpisodeState,
  formData: FormData,
): Promise<CreateEpisodeState> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const productionDate = parseOptionalDate(formData.get("production_date"));
  const publicationDate = parseOptionalDate(formData.get("publication_date"));

  if (!name) return { ok: false, error: "Nom requis." };

  const admin = createAdminClient();

  // Append at the end: next order_index = max + 1.
  const { data: maxRow } = await admin
    .from("episodes")
    .select("order_index")
    .eq("project_id", projectId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.order_index ?? -1) + 1;

  const { error } = await admin.from("episodes").insert({
    project_id: projectId,
    name,
    description: description || null,
    production_date: productionDate,
    publication_date: publicationDate,
    order_index: nextOrder,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/producteur/projets/${projectId}`);
  return { ok: true };
}

export type UpdateEpisodeState = Result | null;

export async function updateEpisode(
  episodeId: string,
  projectId: string,
  _prev: UpdateEpisodeState,
  formData: FormData,
): Promise<UpdateEpisodeState> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const productionDate = parseOptionalDate(formData.get("production_date"));
  const publicationDate = parseOptionalDate(formData.get("publication_date"));

  if (!name) return { ok: false, error: "Nom requis." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("episodes")
    .update({
      name,
      description: description || null,
      production_date: productionDate,
      publication_date: publicationDate,
    })
    .eq("id", episodeId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/producteur/projets/${projectId}`);
  return { ok: true };
}

export async function deleteEpisode(
  episodeId: string,
  projectId: string,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const admin = createAdminClient();
  const { error } = await admin.from("episodes").delete().eq("id", episodeId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/producteur/projets/${projectId}`);
  return { ok: true };
}

/** Moves an episode up or down by swapping its order_index with its neighbor. */
export async function moveEpisode(
  episodeId: string,
  projectId: string,
  direction: "up" | "down",
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const admin = createAdminClient();

  const { data: target, error: targetErr } = await admin
    .from("episodes")
    .select("id, order_index")
    .eq("id", episodeId)
    .single();
  if (targetErr || !target) {
    return { ok: false, error: "Épisode introuvable." };
  }

  const { data: neighbor } = await admin
    .from("episodes")
    .select("id, order_index")
    .eq("project_id", projectId)
    .order("order_index", { ascending: direction === "down" })
    .gt(
      "order_index",
      direction === "down" ? target.order_index : -Infinity,
    )
    .lt(
      "order_index",
      direction === "up" ? target.order_index : Infinity,
    )
    .limit(1)
    .maybeSingle();

  if (!neighbor) return { ok: true }; // already at the edge — no-op

  // Atomic swap via two updates. Race-safe enough for single-user admin work.
  // Step 1: park target at a sentinel value (-1, -2, ...) to avoid unique-ish clashes if we add one later.
  await admin
    .from("episodes")
    .update({ order_index: -1 - target.order_index })
    .eq("id", target.id);
  await admin
    .from("episodes")
    .update({ order_index: target.order_index })
    .eq("id", neighbor.id);
  await admin
    .from("episodes")
    .update({ order_index: neighbor.order_index })
    .eq("id", target.id);

  revalidatePath(`/producteur/projets/${projectId}`);
  return { ok: true };
}

function parseOptionalDate(input: FormDataEntryValue | null): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  // HTML <input type="date"> returns "YYYY-MM-DD".
  // Store as ISO with a noon local Martinique time so timezone shifts don't move the date.
  const dt = new Date(`${raw}T12:00:00-04:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}
