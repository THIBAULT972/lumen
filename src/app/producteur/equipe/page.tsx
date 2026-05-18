import { createClient } from "@/lib/supabase/server";
import { EquipeManager } from "./equipe-manager";

export type ClientProfile = {
  company_name: string | null;
  legal_form: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  siret: string | null;
  vat_number: string | null;
  phone: string | null;
  contact_name: string | null;
};

export type Member = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  banned_until: string | null;
  skill_ids: string[];
  client_profile: ClientProfile | null;
};

export type Skill = { id: string; name: string };

export default async function EquipePage() {
  const supabase = await createClient();

  const [profilesRes, userSkillsRes, skillsRes, clientProfilesRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, email, role, first_name, last_name, created_at, banned_until",
        )
        .in("role", ["producteur", "prestataire", "client"])
        .order("created_at", { ascending: false }),
      supabase.from("user_skills").select("user_id, skill_id"),
      supabase.from("skills").select("id, name").order("name"),
      supabase
        .from("client_profiles")
        .select(
          "id, company_name, legal_form, address_line1, address_line2, postal_code, city, country, siret, vat_number, phone, contact_name",
        ),
    ]);

  const profiles = profilesRes.data ?? [];
  const userSkills = userSkillsRes.data ?? [];
  const skills: Skill[] = skillsRes.data ?? [];
  const clientProfilesById = new Map<string, ClientProfile>(
    (clientProfilesRes.data ?? []).map((cp) => [
      cp.id as string,
      {
        company_name: cp.company_name,
        legal_form: cp.legal_form,
        address_line1: cp.address_line1,
        address_line2: cp.address_line2,
        postal_code: cp.postal_code,
        city: cp.city,
        country: cp.country,
        siret: cp.siret,
        vat_number: cp.vat_number,
        phone: cp.phone,
        contact_name: cp.contact_name,
      },
    ]),
  );

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
    client_profile: clientProfilesById.get(row.id) ?? null,
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
