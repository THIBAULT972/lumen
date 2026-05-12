import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type GuardResult =
  | { ok: true; user: User }
  | { ok: false; error: string };

/**
 * Returns the authenticated producteur, or an error result. Never throws —
 * callers must check `result.ok` so the failure can be surfaced cleanly
 * in the UI instead of leaking as an unhandled rejection.
 */
export async function getProducteur(): Promise<GuardResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, error: "Session expirée, reconnecte-toi." };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileErr || !profile) {
    return { ok: false, error: "Profil introuvable, reconnecte-toi." };
  }
  if (profile.role !== "producteur") {
    return { ok: false, error: "Action réservée aux producteurs." };
  }

  return { ok: true, user };
}
