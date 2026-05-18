"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProducteur } from "@/lib/auth/guard";
import { generatePassword } from "@/lib/auth/password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : T))
  | { ok: false; error: string };

export type CreateMemberState = ActionResult<{
  password: string;
  email: string;
}> | null;

export async function createMember(
  _prev: CreateMemberState,
  formData: FormData,
): Promise<CreateMemberState> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const me = guard.user;

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
  if (role !== "prestataire" && role !== "client" && role !== "producteur") {
    return { ok: false, error: "Rôle invalide." };
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
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: profileErr.message };
  }

  if (role === "prestataire" && skillIds.length > 0) {
    const { error: usErr } = await admin
      .from("user_skills")
      .insert(skillIds.map((sid) => ({ user_id: userId, skill_id: sid })));
    if (usErr) {
      console.warn("user_skills insert failed:", usErr.message);
    }
  }

  revalidatePath("/producteur/equipe");
  revalidatePath("/producteur");
  return { ok: true, password, email };
}

export type UpdateMemberState = ActionResult | null;

// Champs facturation pour les clients (table `client_profiles`).
const CLIENT_PROFILE_FIELDS = [
  "company_name",
  "legal_form",
  "address_line1",
  "address_line2",
  "postal_code",
  "city",
  "country",
  "siret",
  "vat_number",
  "phone",
  "contact_name",
] as const;

function readClientProfileFromFormData(
  fd: FormData,
): Record<(typeof CLIENT_PROFILE_FIELDS)[number], string | null> {
  const out = {} as Record<
    (typeof CLIENT_PROFILE_FIELDS)[number],
    string | null
  >;
  for (const f of CLIENT_PROFILE_FIELDS) {
    const raw = String(fd.get(f) ?? "").trim();
    out[f] = raw === "" ? null : raw;
  }
  return out;
}

export async function updateMember(
  userId: string,
  _prev: UpdateMemberState,
  formData: FormData,
): Promise<UpdateMemberState> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

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
    await admin.from("user_skills").delete().eq("user_id", userId);
    if (skillIds.length > 0) {
      const { error: usErr } = await admin
        .from("user_skills")
        .insert(skillIds.map((sid) => ({ user_id: userId, skill_id: sid })));
      if (usErr) return { ok: false, error: usErr.message };
    }
  }

  if (target.role === "client") {
    const payload = readClientProfileFromFormData(formData);
    const { error: cpErr } = await admin
      .from("client_profiles")
      .upsert(
        { id: userId, ...payload },
        { onConflict: "id" },
      );
    if (cpErr) return { ok: false, error: cpErr.message };
  }

  revalidatePath("/producteur/equipe");
  // Les pages facturation montrent ces infos : on revalide globalement.
  revalidatePath("/producteur/projets", "layout");
  return { ok: true };
}

export type DeleteMemberResult = { ok: true } | { ok: false; error: string };

export async function deleteMember(
  userId: string,
): Promise<DeleteMemberResult> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const me = guard.user;

  if (me.id === userId) {
    return { ok: false, error: "Tu ne peux pas te supprimer toi-même." };
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
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  const password = generatePassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, password };
}
