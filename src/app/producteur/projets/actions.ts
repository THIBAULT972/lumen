"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProducteur } from "@/lib/auth/guard";
import { generatePassword } from "@/lib/auth/password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const producteurIds = formData
    .getAll("producteur_ids")
    .map(String)
    .filter(Boolean);

  if (!name) return { ok: false, error: "Nom requis." };
  if (kind !== "client" && kind !== "media") {
    return { ok: false, error: "Type de projet invalide." };
  }
  if (kind === "client" && !clientIdRaw) {
    return { ok: false, error: "Sélectionne le client associé." };
  }
  if (producteurIds.length === 0) {
    return {
      ok: false,
      error: "Sélectionne au moins un producteur gestionnaire.",
    };
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

  const { error: ppErr } = await admin.from("project_producteurs").insert(
    producteurIds.map((uid) => ({
      project_id: data.id,
      user_id: uid,
    })),
  );
  if (ppErr) {
    // Rollback the project so we don't leave it orphan/invisible.
    await admin.from("projects").delete().eq("id", data.id);
    return {
      ok: false,
      error: `Erreur d'assignation producteurs : ${ppErr.message}`,
    };
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
  const producteurIds = formData
    .getAll("producteur_ids")
    .map(String)
    .filter(Boolean);

  if (!name) return { ok: false, error: "Nom requis." };
  if (kind !== "client" && kind !== "media") {
    return { ok: false, error: "Type de projet invalide." };
  }
  if (kind === "client" && !clientIdRaw) {
    return { ok: false, error: "Sélectionne le client associé." };
  }
  if (producteurIds.length === 0) {
    return {
      ok: false,
      error: "Sélectionne au moins un producteur gestionnaire.",
    };
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

  // Sync project_producteurs: drop everything, re-insert the chosen set.
  await admin
    .from("project_producteurs")
    .delete()
    .eq("project_id", projectId);
  const { error: ppErr } = await admin
    .from("project_producteurs")
    .insert(producteurIds.map((uid) => ({ project_id: projectId, user_id: uid })));
  if (ppErr) return { ok: false, error: ppErr.message };

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
// INLINE CLIENT CREATION — used from the "+ Nouveau client" button inside
// the project creation modal. Stays light: only fields needed to enable the
// link, plus the one-shot password.
// ============================================================================

export type CreateClientInlineResult =
  | {
      ok: true;
      client: {
        id: string;
        email: string;
        first_name: string | null;
        last_name: string | null;
      };
      password: string;
    }
  | { ok: false; error: string };

export async function createClientInline(input: {
  email: string;
  firstName: string;
  lastName: string;
}): Promise<CreateClientInlineResult> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Email invalide." };
  }

  const admin = createAdminClient();
  const password = generatePassword();

  const { data: authData, error: authErr } = await admin.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
    },
  );
  if (authErr || !authData.user) {
    return {
      ok: false,
      error:
        authErr?.message?.includes("already") || authErr?.code === "email_exists"
          ? "Cet email est déjà utilisé."
          : authErr?.message || "Erreur lors de la création.",
    };
  }

  const userId = authData.user.id;

  const { error: profileErr } = await admin.from("profiles").insert({
    id: userId,
    role: "client",
    email,
    first_name: firstName || null,
    last_name: lastName || null,
    created_by: guard.user.id,
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: profileErr.message };
  }

  revalidatePath("/producteur/equipe");
  revalidatePath("/producteur/projets");

  return {
    ok: true,
    client: {
      id: userId,
      email,
      first_name: firstName || null,
      last_name: lastName || null,
    },
    password,
  };
}


// ============================================================================
// EPISODES
// ============================================================================

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
  platform: string | null;
  notes: string | null;
  description: string | null;
};

export type CreateEpisodeResult = Result<{ episodeId: string }>;

/**
 * Creates a new episode with default values. Detailed edits go through
 * saveEpisode below — keeps the creation path lightweight (just a name).
 */
export async function createEpisode(
  projectId: string,
  name: string,
): Promise<CreateEpisodeResult> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Nom requis." };

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

  const { data, error } = await admin
    .from("episodes")
    .insert({
      project_id: projectId,
      name: trimmed,
      order_index: nextOrder,
      status: "idea",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Erreur de création." };
  }

  revalidatePath(`/producteur/projets/${projectId}`);
  return { ok: true, episodeId: data.id };
}

/**
 * Saves the full episode payload in one call (single "Enregistrer" button
 * in the detail panel). Validates each field server-side and returns a
 * single error if anything fails — no half-saves.
 */
export async function saveEpisode(
  episodeId: string,
  projectId: string,
  payload: EpisodePayload,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const name = payload.name.trim();
  if (!name) return { ok: false, error: "Nom requis." };

  if (!EPISODE_STATUSES.includes(payload.status)) {
    return { ok: false, error: "Statut invalide." };
  }

  const productionDate = parseOptionalDate(payload.production_date);
  const publicationDate = parseOptionalDate(payload.publication_date);
  const productionTime = parseOptionalTime(payload.production_time);

  let durationMinutes: number | null = null;
  if (payload.duration_minutes !== null && payload.duration_minutes !== undefined) {
    const n = Number(payload.duration_minutes);
    if (!Number.isFinite(n) || n < 0 || n > 60 * 24 * 7) {
      return { ok: false, error: "Durée invalide." };
    }
    durationMinutes = Math.round(n);
  }

  const guests = Array.isArray(payload.guests)
    ? payload.guests.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const equipment = Array.isArray(payload.equipment)
    ? payload.equipment.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const admin = createAdminClient();
  const { error } = await admin
    .from("episodes")
    .update({
      name,
      format: payload.format?.trim() || null,
      status: payload.status,
      production_date: productionDate,
      production_time: productionTime,
      duration_minutes: durationMinutes,
      publication_date: publicationDate,
      location: payload.location?.trim() || null,
      guests,
      equipment,
      platform: payload.platform?.trim() || null,
      notes: payload.notes?.trim() || null,
      description: payload.description?.trim() || null,
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

function parseOptionalDate(
  input: FormDataEntryValue | string | null | undefined,
): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  // HTML <input type="date"> returns "YYYY-MM-DD".
  // Store as ISO with a noon local Martinique time so timezone shifts don't move the date.
  const dt = new Date(`${raw}T12:00:00-04:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function parseOptionalTime(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  // HTML <input type="time"> returns "HH:MM" — Postgres accepts that as time.
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) return null;
  return raw;
}
