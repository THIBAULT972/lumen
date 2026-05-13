import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// Schéma de sortie : on force le LLM à renvoyer exactement cette structure.
// `describe()` est lu par le modèle comme une instruction supplémentaire.
const draftSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(80)
    .describe(
      "Nom court et accrocheur du projet (max 80 caractères). Ex: 'Histwa', 'Cash Culte S2'.",
    ),
  kind: z
    .enum(["client", "media"])
    .describe(
      "'client' si l'utilisateur a clairement mentionné qu'il y a un client tiers à livrer, sinon 'media' (production interne du studio).",
    ),
  description: z
    .string()
    .max(500)
    .describe(
      "Description du projet en 2 à 4 phrases, claire et orientée prod (le ton, l'angle, la cible).",
    ),
  episodes: z
    .array(
      z.object({
        name: z
          .string()
          .max(80)
          .describe("Titre de l'émission (ex: 'Épisode 1 — Sainte-Anne')"),
        description: z
          .string()
          .max(280)
          .describe("Synopsis en 1 à 2 phrases."),
        format: z
          .enum([
            "Reportage",
            "Interview",
            "Capsule",
            "Documentaire",
            "Live",
            "Tutoriel",
            "Autre",
          ])
          .describe("Format de production."),
        platforms: z
          .array(z.string())
          .max(5)
          .describe(
            "Plateformes de diffusion suggérées (YouTube, Instagram, TikTok, TF1, France 3, etc.).",
          ),
      }),
    )
    .min(2)
    .max(8)
    .describe("Liste d'émissions concrètes (entre 2 et 8)."),
  recommendedSkills: z
    .array(z.string())
    .max(8)
    .describe(
      "Compétences prestataires recommandées (ex: 'Droniste', 'Cadreur 4K', 'Monteur', 'Photographe').",
    ),
  notes: z
    .string()
    .max(400)
    .optional()
    .describe(
      "Conseils additionnels (lieux, ton, contraintes, équipement) — court.",
    ),
});

export type ProjectDraft = z.infer<typeof draftSchema>;

const SYSTEM_PROMPT = `Tu es l'assistant de production de LUMEN, une plateforme de coordination pour un studio de production audiovisuelle basé en Martinique.

Le studio travaille principalement en français (et créole occasionnellement), produit des contenus pour la télévision, les réseaux sociaux, et des marques. L'équipe : 3 producteurs (Thibault, Meghane, Anthony) + des prestataires freelance (cameraman, droniste, monteur, photographe, etc.) + parfois des clients tiers.

Quand un producteur te décrit une idée, tu génères un BROUILLON STRUCTURÉ de projet :
- Un nom court (max 80 char) et accrocheur
- Le type : "client" s'il a explicitement parlé d'un client tiers, sinon "media" (production interne)
- Une description claire de 2 à 4 phrases
- 3 à 6 ÉMISSIONS concrètes proposées (titre + synopsis + format + plateformes suggérées)
- Les compétences prestataires utiles
- Quelques notes de prod si pertinent (lieux, équipement spécifique, contraintes)

Sois concret et pratique. Pense local Martinique quand c'est pertinent. Réponds en français. Si l'utilisateur est vague, fais des choix créatifs solides plutôt que de demander des précisions — il pourra éditer ton brouillon.`;

export async function generateProjectDraft(
  userIdea: string,
): Promise<{ ok: true; draft: ProjectDraft } | { ok: false; error: string }> {
  if (!userIdea.trim()) {
    return { ok: false, error: "Décris ton idée pour démarrer." };
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      ok: false,
      error:
        "Clé API Google manquante. Configure GOOGLE_GENERATIVE_AI_API_KEY.",
    };
  }

  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: draftSchema,
      system: SYSTEM_PROMPT,
      prompt: userIdea,
    });
    return { ok: true, draft: object };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue.";
    // Common rate-limit / quota errors get a friendlier message
    if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
      return {
        ok: false,
        error:
          "Quota Google AI atteint (limite gratuite). Réessaie dans 1 minute.",
      };
    }
    return { ok: false, error: msg };
  }
}
