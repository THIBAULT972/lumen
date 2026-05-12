import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/shell";
import { ProducteurNav } from "@/components/dashboard/producteur-nav";

export default async function ProducteurLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, email")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.role !== "producteur") redirect("/");

  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email;

  return (
    <DashboardShell
      role="Producteur"
      userName={displayName}
      nav={<ProducteurNav />}
    >
      {children}
    </DashboardShell>
  );
}
