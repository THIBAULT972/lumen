import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Génération d'UNE émission enrichie pour un projet existant.
// Cet appel est lancé depuis la page projet, à la demande, quand le
// producteur clique sur "Suggérer une émission avec l'IA". Il reçoit en
// contexte le brief du projet (theme, ton, audience, approche de tournage)
// et l'idée brute du producteur ("le pouvoir des maires", "le conseil
// territorial expliqué"…).
//
// Avec un appel dédié, on a tout le budget tokens pour CE seul épisode
// → script complet + shot list garantie + 3-4 visual_prompts qui marchent.
// ─────────────────────────────────────────────────────────────────────────────

const scriptSectionSchema = z.object({
  heading: z
    .string()
    .max(80)
    .describe("Titre court de la section."),
  content: z
    .string()
    .max(700)
    .describe(
      "Texte de la section : ce qui est dit/montré, dialogues clés, points abordés. 3-8 phrases.",
    ),
  b_roll: z
    .array(z.string().max(140))
    .max(5)
    .optional()
    .describe(
      "Descriptions des plans b-roll qui accompagnent cette section.",
    ),
});

const scriptSchema = z.object({
  hook: z
    .string()
    .max(280)
    .describe(
      "Accroche des 10-15 premières secondes — ce qui capte l'attention.",
    ),
  sections: z
    .array(scriptSectionSchema)
    .min(3)
    .max(6)
    .describe("3-6 sections séquentielles."),
  cta: z
    .string()
    .max(200)
    .describe("Call-to-action final."),
});

const shotSchema = z.object({
  type: z
    .enum([
      "Plan large",
      "Plan moyen",
      "Plan rapproché",
      "Gros plan",
      "Très gros plan",
      "Plan d'ensemble",
      "Drone aérien",
      "Plan séquence",
      "Insert produit",
      "Plan POV",
      "Time-lapse",
      "Slow motion",
      "Interview cadré",
    ])
    .describe("Type de plan, vocabulaire ciné/vidéo."),
  description: z
    .string()
    .max(200)
    .describe(
      "Ce qui est filmé concrètement : sujet, action, ambiance lumineuse.",
    ),
});

const episodeDraftSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(80)
    .describe("Titre de l'émission, court et accrocheur."),
  description: z
    .string()
    .max(280)
    .describe("Synopsis en 1-2 phrases, concret."),
  format: z.enum([
    "Reportage",
    "Interview",
    "Capsule",
    "Documentaire",
    "Live",
    "Tutoriel",
    "Autre",
  ]),
  duration_minutes: z
    .number()
    .int()
    .min(1)
    .max(120)
    .describe("Durée estimée du contenu fini en minutes."),
  platforms: z
    .array(z.string().max(40))
    .max(5)
    .describe("Plateformes de diffusion (reprends celles du projet si pertinent)."),
  location_suggestion: z
    .string()
    .max(140)
    .describe("Lieu de tournage suggéré, le plus pertinent."),
  guests_suggestion: z
    .array(z.string().max(80))
    .min(1)
    .max(6)
    .describe("Profils d'intervenants (descriptions, pas de noms réels)."),
  script: scriptSchema.describe("Script structuré complet."),
  shots: z
    .array(shotSchema)
    .min(5)
    .max(10)
    .describe(
      "Shot list : 5-10 plans, VARIE les types (plans larges, gros plans, drone, time-lapse) pour avoir du rythme.",
    ),
  visual_prompts: z
    .array(z.string().max(200))
    .min(3)
    .max(4)
    .describe(
      "3-4 prompts EN ANGLAIS cinématographiques pour générer des images d'illustration de cet épisode. Détails précis : couleurs, lumière, focale, profondeur de champ, grain, ambiance.",
    ),
});

export type EpisodeFullDraft = z.infer<typeof episodeDraftSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Project context — ce qu'on connaît du projet quand on génère un épisode.
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectContext = {
  name: string;
  description: string | null;
  theme?: string | null;
  production_approach?: string | null;
  target_audience?: string | null;
  tone?: string | null;
  inspiration_references?: string[];
  recommendedSkills?: string[];
};

const SYSTEM_PROMPT = `Tu es l'assistant créatif de LUMEN, studio de production audiovisuelle basé en Martinique.

On te donne :
1. Le CONTEXTE d'un projet existant (name, description, theme, approche de tournage, ton, audience, inspirations).
2. Une IDÉE D'ÉMISSION : soit un thème court ("le pouvoir des maires"), soit un brief plus riche.

Tu produis UN ÉPISODE COMPLET ET DÉTAILLÉ, cohérent avec le contexte du projet :

1. **Méta** : titre accrocheur, synopsis 1-2 phrases, format, durée, plateformes (reprends celles du projet quand pertinent), lieu suggéré, profils d'intervenants.

2. **SCRIPT STRUCTURÉ** :
   - Hook : 10-15 premières secondes (question, scène choc, stat, citation).
   - 3-6 sections séquentielles : titre + contenu détaillé (3-8 phrases, concret : ce qui est dit/montré, dialogues clés). Optionnel : 2-4 plans b-roll par section.
   - CTA de fin : ce qu'on demande au spectateur.

3. **SHOT LIST** : 5-10 plans clés. Mix de types (plans larges, gros plans, drone, time-lapse, slow motion) pour avoir du rythme au montage. Pour chaque plan : type + description concrète.

4. **VISUAL PROMPTS EN ANGLAIS** : 3-4 prompts cinématographiques pour générer des images d'illustration de CET épisode. Style riche : couleurs, lumière, focale (35mm, 50mm), profondeur de champ, grain, ambiance. Pas de "a video about politics" — quelque chose comme "cinematic medium shot of a young Caribbean man speaking passionately into a microphone at a town hall meeting, late afternoon sun streaming through windows, shallow depth of field, documentary style, 35mm film aesthetic".

## Règles d'or
- Sois ULTRA-CONCRET. Le producteur doit pouvoir lire ton output et démarrer le tournage demain.
- Reste cohérent avec le projet (ton, audience, plateformes, approche de tournage).
- visual_prompts EN ANGLAIS, style cinéma.
- Réponds en français pour le reste.
- Pense local Martinique quand pertinent.`;

export async function generateEpisodeDraft(
  projectContext: ProjectContext,
  episodeIdea: string,
): Promise<
  { ok: true; draft: EpisodeFullDraft } | { ok: false; error: string }
> {
  const trimmed = episodeIdea.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "Décris ton idée d'émission (au moins un sujet/angle).",
    };
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      ok: false,
      error:
        "Clé API Google manquante. Configure GOOGLE_GENERATIVE_AI_API_KEY.",
    };
  }

  const contextText = [
    `--- CONTEXTE DU PROJET ---`,
    `Nom : ${projectContext.name}`,
    projectContext.description ? `Description : ${projectContext.description}` : null,
    projectContext.theme ? `Thème : ${projectContext.theme}` : null,
    projectContext.production_approach
      ? `Approche de tournage : ${projectContext.production_approach}`
      : null,
    projectContext.target_audience
      ? `Audience : ${projectContext.target_audience}`
      : null,
    projectContext.tone ? `Ton : ${projectContext.tone}` : null,
    projectContext.inspiration_references &&
    projectContext.inspiration_references.length > 0
      ? `Inspirations : ${projectContext.inspiration_references.join(", ")}`
      : null,
    "",
    `--- IDÉE D'ÉMISSION À DÉVELOPPER ---`,
    trimmed,
  ]
    .filter((x): x is string => x !== null)
    .join("\n");

  let lastError: unknown = null;
  for (let i = 0; i < 2; i++) {
    try {
      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: episodeDraftSchema,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: contextText }],
          },
        ],
        maxOutputTokens: 16_384,
      });
      if (i > 0) {
        console.warn(`[ai] generateEpisodeDraft OK au retry ${i + 1}/2`);
      }
      return { ok: true, draft: object };
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[ai] generateEpisodeDraft échec ${i + 1}/2 : ${msg.slice(0, 300)}`,
      );
      const lower = msg.toLowerCase();
      if (
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("429") ||
        lower.includes("location is not supported") ||
        lower.includes("permission_denied")
      ) {
        break;
      }
    }
  }

  const msg = lastError instanceof Error ? lastError.message : "Erreur inconnue.";
  const lower = msg.toLowerCase();
  if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
    return {
      ok: false,
      error: "Quota Google AI atteint. Réessaie dans 1 minute.",
    };
  }
  if (
    lower.includes("location is not supported") ||
    lower.includes("permission_denied")
  ) {
    return {
      ok: false,
      error:
        "Google AI bloque ta région (VPN ?). Désactive le VPN ou teste en prod.",
    };
  }
  if (
    lower.includes("response did not match schema") ||
    lower.includes("no object generated")
  ) {
    return {
      ok: false,
      error:
        "Gemini n'a pas pu structurer. Réessaie ou décris l'idée d'émission plus précisément.",
    };
  }
  return { ok: false, error: msg };
}
