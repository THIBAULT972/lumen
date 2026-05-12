#!/usr/bin/env node
/**
 * LUMEN — Seed 3 test accounts (1 producteur, 1 prestataire, 1 client).
 *
 * Usage:  npm run seed
 * (Loads env via Node's --env-file=.env.local flag.)
 *
 * Idempotent: if a user already exists, the row is reused and only the
 * profile/skills are upserted.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error(
    "✖ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Did you forget --env-file=.env.local?",
  );
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "Lumen2026!";

const ACCOUNTS = [
  {
    email: "producteur@lumen.studio",
    role: "producteur",
    first_name: "Thibault",
    last_name: "LEPINE",
    skills: [],
  },
  {
    email: "meghane@lumen.studio",
    role: "producteur",
    first_name: "Meghane",
    last_name: "BEUSE",
    skills: [],
  },
  {
    email: "anthony@lumen.studio",
    role: "producteur",
    first_name: "Anthony",
    last_name: "DOUMITH",
    skills: [],
  },
  {
    email: "prestataire@lumen.studio",
    role: "prestataire",
    first_name: "Jean",
    last_name: "Prestataire",
    skills: ["Cameraman", "Droniste"],
  },
  {
    email: "client@lumen.studio",
    role: "client",
    first_name: "Marie",
    last_name: "Client",
    skills: [],
  },
];

async function findUserByEmail(email) {
  // listUsers paginates; for 3-account seed we just scan the first page.
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}

async function upsertAccount(account) {
  let userId;
  const existing = await findUserByEmail(account.email);

  if (existing) {
    userId = existing.id;
    console.log(`· ${account.email} — already exists, reusing.`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser(${account.email}): ${error.message}`);
    userId = data.user.id;
    console.log(`✓ ${account.email} — auth user created.`);
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      role: account.role,
      email: account.email,
      first_name: account.first_name,
      last_name: account.last_name,
    },
    { onConflict: "id" },
  );
  if (profileError) {
    throw new Error(`profile(${account.email}): ${profileError.message}`);
  }
  console.log(`✓ ${account.email} — profile (${account.role}) set.`);

  if (account.skills.length > 0) {
    const { data: skillRows, error: skillsError } = await supabase
      .from("skills")
      .select("id, name")
      .in("name", account.skills);
    if (skillsError) throw skillsError;

    const links = skillRows.map((s) => ({ user_id: userId, skill_id: s.id }));
    if (links.length > 0) {
      const { error: usError } = await supabase
        .from("user_skills")
        .upsert(links, { onConflict: "user_id,skill_id" });
      if (usError) {
        throw new Error(`user_skills(${account.email}): ${usError.message}`);
      }
      console.log(
        `✓ ${account.email} — skills linked: ${skillRows.map((s) => s.name).join(", ")}.`,
      );
    }
  }
}

async function backfillProjectProducteurs() {
  // Assign every producteur to every existing project. Idempotent.
  // Migration 002 already does this for projects that existed at migration
  // time; this catches the case where a new producteur is added later.
  const { data: producteurs } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "producteur");
  const { data: projects } = await supabase.from("projects").select("id");

  if (!producteurs?.length || !projects?.length) return;

  const links = producteurs.flatMap((prod) =>
    projects.map((p) => ({ project_id: p.id, user_id: prod.id })),
  );

  const { error } = await supabase
    .from("project_producteurs")
    .upsert(links, { onConflict: "project_id,user_id" });

  if (error && !error.message.includes("does not exist")) {
    // Ignore "table doesn't exist" — migration 002 may not be applied yet.
    console.warn("backfill project_producteurs:", error.message);
  } else if (!error) {
    console.log(
      `✓ project_producteurs backfilled (${links.length} links).`,
    );
  }
}

async function main() {
  console.log("→ LUMEN seed starting…\n");

  for (const account of ACCOUNTS) {
    await upsertAccount(account);
    console.log("");
  }

  await backfillProjectProducteurs();
  console.log("");

  console.log("✓ Seed complete.\n");
  console.log("──────────────────────────────────────────────");
  console.log("Comptes de test :");
  console.log(`  Mot de passe pour tous :  ${PASSWORD}`);
  console.log("");
  for (const a of ACCOUNTS) {
    console.log(`  · ${a.role.padEnd(12)} → ${a.email}`);
  }
  console.log("──────────────────────────────────────────────");
}

main().catch((err) => {
  console.error("\n✖ Seed failed:", err.message ?? err);
  process.exit(1);
});
