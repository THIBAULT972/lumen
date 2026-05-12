import { createClient } from "@/lib/supabase/server";
import { CompetencesManager } from "./competences-manager";

export type SkillWithUsage = {
  id: string;
  name: string;
  created_at: string;
  prestataire_count: number;
  mission_count: number;
};

export default async function CompetencesPage() {
  const supabase = await createClient();

  const [skillsRes, userSkillsRes, missionsRes] = await Promise.all([
    supabase
      .from("skills")
      .select("id, name, created_at")
      .order("name"),
    supabase.from("user_skills").select("skill_id"),
    supabase.from("missions").select("required_skill_id"),
  ]);

  const skills = skillsRes.data ?? [];
  const userSkills = userSkillsRes.data ?? [];
  const missions = missionsRes.data ?? [];

  const enriched: SkillWithUsage[] = skills.map((s) => ({
    id: s.id,
    name: s.name,
    created_at: s.created_at,
    prestataire_count: userSkills.filter((us) => us.skill_id === s.id).length,
    mission_count: missions.filter((m) => m.required_skill_id === s.id).length,
  }));

  return (
    <>
      <section className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
          Studio · Configuration
        </p>
        <h1 className="mt-3 font-heading text-4xl font-light tracking-tight">
          Compétences
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Définis les métiers que tu peux assigner à un prestataire et que tu
          peux exiger pour une mission.
        </p>
      </section>

      <CompetencesManager skills={enriched} />
    </>
  );
}
