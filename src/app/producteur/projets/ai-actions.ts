"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProducteur } from "@/lib/auth/guard";
import {
  generateProjectDraft as runGenerator,
  type ProjectDraft,
} from "@/lib/ai/project-generator";

type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : T))
  | { ok: false; error: string };

export type DraftResult = Result<{ draft: ProjectDraft }>;

/** Step 1 — appelle Gemini, retourne le brouillon JSON validé par Zod. */
export async function generateAiProjectDraft(
  idea: string,
): Promise<DraftResult> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const r = await runGenerator(idea);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, draft: r.draft };
}

/**
 * Step 2 — crée le projet + les émissions à partir du brouillon (potentiellement
 * édité par l'utilisateur). Le caller fournit aussi les producteur_ids assignés
 * et optionnellement le client_id (ignoré si kind='media').
 */
export async function createProjectFromAiDraft(input: {
  draft: ProjectDraft;
  producteurIds: string[];
  clientId?: string | null;
}): Promise<Result<{ projectId: string }>> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const { draft, producteurIds, clientId } = input;

  if (producteurIds.length === 0) {
    return {
      ok: false,
      error: "Sélectionne au moins un producteur gestionnaire.",
    };
  }
  if (draft.kind === "client" && !clientId) {
    return {
      ok: false,
      error: "Type 'client' sélectionné mais aucun client choisi.",
    };
  }

  const admin = createAdminClient();

  // 1. Project
  const { data: project, error: projErr } = await admin
    .from("projects")
    .insert({
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      client_id: draft.kind === "client" ? clientId ?? null : null,
      created_by: guard.user.id,
    })
    .select("id")
    .single();
  if (projErr || !project) {
    return { ok: false, error: projErr?.message ?? "Erreur projet." };
  }

  // 2. project_producteurs
  const { error: ppErr } = await admin.from("project_producteurs").insert(
    producteurIds.map((uid) => ({ project_id: project.id, user_id: uid })),
  );
  if (ppErr) {
    await admin.from("projects").delete().eq("id", project.id);
    return {
      ok: false,
      error: `Erreur d'assignation producteurs : ${ppErr.message}`,
    };
  }

  // 3. Episodes
  if (draft.episodes.length > 0) {
    const rows = draft.episodes.map((ep, idx) => ({
      project_id: project.id,
      name: ep.name.trim(),
      description: ep.description.trim() || null,
      format: ep.format || null,
      platforms: ep.platforms ?? [],
      status: "idea" as const,
      order_index: idx,
    }));
    const { error: epErr } = await admin.from("episodes").insert(rows);
    if (epErr) {
      // Project is already there — don't rollback, just surface the error.
      // The user can still add episodes manually.
      console.warn("[AI] episodes insert error:", epErr.message);
    }
  }

  // 4. Optionally, register suggested skills in the global referential.
  // We don't auto-create them — too many false positives. The producteur
  // sees them as a hint instead, and can manually add what's missing.

  revalidatePath("/producteur/projets");
  revalidatePath("/producteur");
  return { ok: true, projectId: project.id };
}
