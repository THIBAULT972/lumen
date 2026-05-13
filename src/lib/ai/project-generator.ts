import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

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
    .min(1)
    .max(8)
    .describe(
      "Liste d'émissions concrètes (au moins 1, idéalement 3 à 6).",
    ),
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

Quand un producteur te décrit une idée — par texte, par PDF, ou les deux — tu génères un BROUILLON STRUCTURÉ de projet :
- Un nom court (max 80 char) et accrocheur
- Le type : "client" s'il a explicitement parlé d'un client tiers, sinon "media" (production interne)
- Une description claire de 2 à 4 phrases
- 3 à 6 ÉMISSIONS concrètes proposées (titre + synopsis + format + plateformes suggérées)
- Les compétences prestataires utiles
- Quelques notes de prod si pertinent (lieux, équipement spécifique, contraintes)

Si on te fournit un PDF (brief, dossier de prod, présentation), lis-le attentivement (texte ET images) et base ton brouillon dessus. Si l'utilisateur ajoute aussi du texte, c'est une consigne supplémentaire à respecter en plus du contenu du PDF.

Sois concret et pratique. Pense local Martinique quand c'est pertinent. Réponds en français. Si l'utilisateur est vague, fais des choix créatifs solides plutôt que de demander des précisions — il pourra éditer ton brouillon.`;

export type GeneratorInput = {
  idea: string;
  /** Optional document attachment (PDF for now). */
  attachment?: {
    bytes: Uint8Array;
    mimeType: string;
    filename?: string;
  };
};

export async function generateProjectDraft(
  input: GeneratorInput,
): Promise<{ ok: true; draft: ProjectDraft } | { ok: false; error: string }> {
  const trimmedIdea = input.idea.trim();
  const hasAttachment = !!input.attachment;

  if (!trimmedIdea && !hasAttachment) {
    return {
      ok: false,
      error: "Décris ton idée ou joins un PDF pour démarrer.",
    };
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      ok: false,
      error:
        "Clé API Google manquante. Configure GOOGLE_GENERATIVE_AI_API_KEY.",
    };
  }

  try {
    const userParts: (
      | { type: "text"; text: string }
      | { type: "file"; data: Uint8Array; mediaType: string }
    )[] = [];

    if (trimmedIdea) {
      userParts.push({ type: "text", text: trimmedIdea });
    }
    if (hasAttachment) {
      userParts.push({
        type: "file",
        data: input.attachment!.bytes,
        mediaType: input.attachment!.mimeType,
      });
      if (!trimmedIdea) {
        userParts.push({
          type: "text",
          text:
            "Analyse ce document et propose un brouillon de projet basé sur son contenu.",
        });
      }
    }

    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: draftSchema,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userParts,
        },
      ],
    });
    return { ok: true, draft: object };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue.";
    const lower = msg.toLowerCase();

    if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
      return {
        ok: false,
        error:
          "Quota Google AI atteint (limite gratuite : 1500 requêtes/jour). Réessaie dans 1 minute.",
      };
    }
    if (
      lower.includes("user location is not supported") ||
      lower.includes("location is not supported") ||
      lower.includes("permission_denied")
    ) {
      return {
        ok: false,
        error:
          "Google AI bloque ta région (probablement à cause d'un VPN). Désactive le VPN, ou teste cette feature en prod (Vercel) — leurs serveurs ne sont pas bloqués.",
      };
    }
    if (
      lower.includes("response did not match schema") ||
      lower.includes("no object generated")
    ) {
      return {
        ok: false,
        error:
          "L'IA n'a pas pu structurer ta demande. Sois plus explicite : décris au moins 1-2 idées d'émissions, le ton, et qui regarde.",
      };
    }
    if (lower.includes("payload") || lower.includes("size")) {
      return {
        ok: false,
        error:
          "Le document est trop volumineux. Essaie un PDF plus léger (<20 Mo).",
      };
    }
    return { ok: false, error: msg };
  }
}
