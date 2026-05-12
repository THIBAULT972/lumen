"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProducteur } from "@/lib/auth/guard";

type Result = { ok: true } | { ok: false; error: string };

export type CreateSkillState = Result | null;

export async function createSkill(
  _prev: CreateSkillState,
  formData: FormData,
): Promise<CreateSkillState> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Nom requis." };
  if (name.length > 60) {
    return { ok: false, error: "Nom trop long (60 caractères max)." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("skills").insert({ name });
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "Cette compétence existe déjà." : error.message,
    };
  }

  revalidatePath("/producteur/competences");
  return { ok: true };
}

export async function renameSkill(
  skillId: string,
  newName: string,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const trimmed = newName.trim();
  if (!trimmed) return { ok: false, error: "Nom requis." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("skills")
    .update({ name: trimmed })
    .eq("id", skillId);

  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "Une compétence porte déjà ce nom." : error.message,
    };
  }

  revalidatePath("/producteur/competences");
  revalidatePath("/producteur/equipe");
  return { ok: true };
}

export async function deleteSkill(skillId: string): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const admin = createAdminClient();

  const [{ count: linkedCount }, { count: missionCount }] = await Promise.all([
    admin
      .from("user_skills")
      .select("user_id", { count: "exact", head: true })
      .eq("skill_id", skillId),
    admin
      .from("missions")
      .select("id", { count: "exact", head: true })
      .eq("required_skill_id", skillId),
  ]);

  if ((linkedCount ?? 0) > 0) {
    return {
      ok: false,
      error: `Compétence utilisée par ${linkedCount} prestataire(s). Retire-la d'abord de leur profil.`,
    };
  }
  if ((missionCount ?? 0) > 0) {
    return {
      ok: false,
      error: `Compétence requise par ${missionCount} mission(s). Supprime ou réassigne ces missions d'abord.`,
    };
  }

  const { error } = await admin.from("skills").delete().eq("id", skillId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/producteur/competences");
  return { ok: true };
}
