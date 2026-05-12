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
