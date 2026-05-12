import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Root route. The middleware ensures the user is authenticated by the time
 * we reach this point. We then route them to the dashboard matching their
 * role.
 */
export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Auth user without a profile row — should never happen in normal flow.
    // Force a re-login until a producteur creates the profile.
    await supabase.auth.signOut();
    redirect("/login?error=no_profile");
  }

  switch (profile.role) {
    case "producteur":
      redirect("/producteur");
    case "prestataire":
      redirect("/prestataire");
    case "client":
      redirect("/client");
    default:
      redirect("/login");
  }
}
