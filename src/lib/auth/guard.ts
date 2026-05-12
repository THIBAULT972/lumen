import { createClient } from "@/lib/supabase/server";

/**
 * Throws if the caller is not authenticated or not a producteur.
 * Use at the top of every server action that performs admin operations
 * (createUser, deleteUser, schema mutations bypassing RLS, etc.).
 *
 * Returns the authenticated user so the action can record `created_by` etc.
 */
export async function assertProducteur() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileErr || !profile) {
    throw new Error("Profile not found");
  }
  if (profile.role !== "producteur") {
    throw new Error("Forbidden");
  }

  return user;
}
