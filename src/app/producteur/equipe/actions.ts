"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertProducteur } from "@/lib/auth/guard";
import { generatePassword } from "@/lib/auth/password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : T))
  | { ok: false; error: string };

export type CreateMemberState = ActionResult<{
  password: string;
  email: string;
}> | null;

/**
 * Creates an auth user + profile row, links skills if prestataire.
 * Server generates the password and returns it once — the producteur must
 * transmit it manually to the new member.
 */
export async function createMember(
  _prev: CreateMemberState,
  formData: FormData,
): Promise<CreateMemberState> {
  const me = await assertProducteur();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const skillIds = formData.getAll("skill_ids").map(String).filter(Boolean);

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Email invalide." };
  }
  if (role !== "prestataire" && role !== "client") {
    return {
      ok: false,
      error: "Rôle invalide. Choisis prestataire ou client.",
    };
  }

  const admin = createAdminClient();
  const password = generatePassword();

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !authData.user) {
    return {
      ok: false,
      error:
        authErr?.message?.includes("already") || authErr?.code === "email_exists"
          ? "Cet email est déjà utilisé."
          : authErr?.message || "Erreur lors de la création du compte.",
    };
  }

  const userId = authData.user.id;

  const { error: profileErr } = await admin.from("profiles").insert({
    id: userId,
    role,
    email,
    first_name: firstName || null,
    last_name: lastName || null,
    created_by: me.id,
  });

  if (profileErr) {
    // Rollback the auth user — we don't want orphan auth rows.
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: profileErr.message };
  }

  if (role === "prestataire" && skillIds.length > 0) {
    const { error: usErr } = await admin
      .from("user_skills")
      .insert(skillIds.map((sid) => ({ user_id: userId, skill_id: sid })));
    if (usErr) {
      // Profile + auth are valid; only the skill links failed. Surface a
      // warning but keep the account. Producteur can re-edit skills later.
      console.warn("user_skills insert failed:", usErr.message);
    }
  }

  revalidatePath("/producteur/equipe");
  revalidatePath("/producteur");
  return { ok: true, password, email };
}

export type UpdateMemberState = ActionResult | null;

/**
 * Updates first_name / last_name / skills of an existing member.
 * Email and role are not editable here (change of role would be a re-creation).
 */
export async function updateMember(
  userId: string,
  _prev: UpdateMemberState,
  formData: FormData,
): Promise<UpdateMemberState> {
  await assertProducteur();

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const skillIds = formData.getAll("skill_ids").map(String).filter(Boolean);

  const admin = createAdminClient();

  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (targetErr || !target) {
    return { ok: false, error: "Membre introuvable." };
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      first_name: firstName || null,
      last_name: lastName || null,
    })
    .eq("id", userId);

  if (profileErr) return { ok: false, error: profileErr.message };

  if (target.role === "prestataire") {
    // Full resync : drop all current links, re-insert the chosen set.
    await admin.from("user_skills").delete().eq("user_id", userId);
    if (skillIds.length > 0) {
      const { error: usErr } = await admin
        .from("user_skills")
        .insert(skillIds.map((sid) => ({ user_id: userId, skill_id: sid })));
      if (usErr) return { ok: false, error: usErr.message };
    }
  }

  revalidatePath("/producteur/equipe");
  return { ok: true };
}

export type DeleteMemberResult = { ok: true } | { ok: false; error: string };

export async function deleteMember(
  userId: string,
): Promise<DeleteMemberResult> {
  const me = await assertProducteur();

  if (me.id === userId) {
    return { ok: false, error: "Tu ne peux pas te supprimer toi-même." };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (target?.role === "producteur") {
    return {
      ok: false,
      error:
        "Suppression d'un autre producteur non autorisée pour l'instant.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/producteur/equipe");
  revalidatePath("/producteur");
  return { ok: true };
}

export type RegeneratePasswordResult =
  | { ok: true; password: string }
  | { ok: false; error: string };

export async function regeneratePassword(
  userId: string,
): Promise<RegeneratePasswordResult> {
  await assertProducteur();

  const password = generatePassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, password };
}
