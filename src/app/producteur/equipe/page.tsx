import { createClient } from "@/lib/supabase/server";
import { EquipeManager } from "./equipe-manager";

export type Member = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  banned_until: string | null;
  skill_ids: string[];
};

export type Skill = { id: string; name: string };

export default async function EquipePage() {
  const supabase = await createClient();

  const [profilesRes, userSkillsRes, skillsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, role, first_name, last_name, created_at, banned_until",
      )
      .in("role", ["producteur", "prestataire", "client"])
      .order("created_at", { ascending: false }),
    supabase.from("user_skills").select("user_id, skill_id"),
    supabase.from("skills").select("id, name").order("name"),
  ]);

  const profiles = profilesRes.data ?? [];
  const userSkills = userSkillsRes.data ?? [];
  const skills: Skill[] = skillsRes.data ?? [];

  const enrichMember = (row: (typeof profiles)[number]): Member => ({
    id: row.id,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    created_at: row.created_at,
    banned_until: row.banned_until,
    skill_ids: userSkills
      .filter((us) => us.user_id === row.id)
      .map((us) => us.skill_id),
  });

  const producteurs = profiles
    .filter((p) => p.role === "producteur")
    .map(enrichMember);
  const prestataires = profiles
    .filter((p) => p.role === "prestataire")
    .map(enrichMember);
  const clients = profiles
    .filter((p) => p.role === "client")
    .map(enrichMember);

  return (
    <>
      <section className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
          Studio · Gestion des accès
        </p>
        <h1 className="mt-3 font-heading text-4xl font-light tracking-tight">
          Équipe
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Ajoute, modifie ou retire les prestataires et clients qui ont accès à
          LUMEN. Les mots de passe sont générés automatiquement et affichés une
          seule fois — à toi de les transmettre.
        </p>
      </section>

      <EquipeManager
        producteurs={producteurs}
        prestataires={prestataires}
        clients={clients}
        skills={skills}
      />
    </>
  );
}
