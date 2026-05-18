import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// Désactive le "thinking" mode de Gemini 2.5 Flash (sinon il consomme
// jusqu'à 24k tokens avant la sortie → JSON tronqué).
const GEMINI_NO_THINKING = {
  google: { thinkingConfig: { thinkingBudget: 0 } },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Stratégie : à la création, on génère UNIQUEMENT la structure du projet
// (theme + approche + ton + audience + moodboard prompts). Pas d'épisodes
// obligatoires. L'enrichissement par épisode se fait plus tard, à la demande,
// via `generateEpisodeFromIdea` (autre fichier).
//
// Si l'utilisateur fournit un PDF (brief, dossier de prod), l'IA peut
// proposer 0-5 idées d'épisodes basiques, sans script ni shots — juste des
// pistes que le producteur transformera ensuite en émissions enrichies.
// ─────────────────────────────────────────────────────────────────────────────

// Épisode "idée" — juste un titre + synopsis + format proposé. Pas de script
// ni shot list à ce stade. Le producteur enrichira chacun à la demande.
const episodeIdeaSchema = z.object({
  name: z.string().max(80).describe("Titre de l'émission."),
  description: z
    .string()
    .max(280)
    .describe("Synopsis en 1-2 phrases. Concret."),
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
    .describe("Format de production suggéré."),
  platforms: z
    .array(z.string().max(40))
    .max(5)
    .optional()
    .describe("Plateformes de diffusion suggérées."),
});

const projectSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(80)
    .describe("Nom court, accrocheur, prononçable. Pas générique."),
  kind: z
    .enum(["client", "media"])
    .describe(
      "'client' si l'utilisateur a clairement mentionné un client tiers, sinon 'media'.",
    ),
  description: z
    .string()
    .max(500)
    .describe(
      "Description du projet en 2-4 phrases. Concrète, orientée prod.",
    ),
  theme: z
    .string()
    .max(280)
    .describe(
      "Sujet/angle du projet en 1-2 phrases. Qu'est-ce qu'on traite, vu sous quel angle ? Ex: 'Vulgariser le fonctionnement de la politique martiniquaise auprès des jeunes via des décryptages courts et des micros-trottoirs'.",
    ),
  production_approach: z
    .string()
    .max(400)
    .describe(
      "FAÇON DE TOURNER : où, comment, avec quel équipement type, quel style visuel. 3-5 phrases concrètes. Ex: 'Plateau studio avec présentateur, micros-trottoirs en extérieur (Fort-de-France marchand, université Schoelcher), interviews d'experts en plan resserré, B-roll de débats à l'assemblée, archives INA. Caméra Sony FX3, gimbal pour les rues, plans dynamiques mais cadre stable au plateau.'",
    ),
  target_audience: z
    .string()
    .max(280)
    .describe(
      "Persona cible précis : âge, intérêts, plateforme principale, habitudes de consommation média. 1-2 phrases.",
    ),
  tone: z
    .string()
    .max(140)
    .describe(
      "Ton éditorial en 3-5 mots-clés ou une phrase courte. Ex: 'punchy, pédagogique, sans jargon'.",
    ),
  moodboard_prompts: z
    .array(z.string().max(200))
    .min(3)
    .max(5)
    .describe(
      "3 à 5 prompts EN ANGLAIS pour générer des images de moodboard cinématographiques. Style riche : couleurs dominantes, lumière, textures, références visuelles implicites. Ex: 'cinematic moodboard, young Caribbean people debating politics in a sunlit cafe, warm terracotta and indigo palette, 35mm film grain, documentary style'.",
    ),
  production_tips: z
    .array(z.string().max(200))
    .min(2)
    .max(6)
    .describe(
      "Conseils prod actionnables : équipement spécifique, timing optimal, lieux à privilégier, contraintes à anticiper.",
    ),
  inspiration_references: z
    .array(z.string().max(140))
    .min(1)
    .max(4)
    .describe(
      "Références concrètes : chaîne YouTube, doc, photographe, style de montage. Ex: 'Brut.', 'Hugo Décrypte', 'docs Arte Reportage', 'photographie Annie Leibovitz'.",
    ),
  recommendedSkills: z
    .array(z.string().max(40))
    .min(2)
    .max(8)
    .describe(
      "Compétences prestataires recommandées (ex: 'Droniste', 'Cadreur 4K', 'Monteur', 'Photographe', 'Motion designer').",
    ),
  // Idées d'épisodes : OPTIONNEL. Pas d'obligation pour ne pas saturer la
  // génération. Si PDF fourni ou prompt riche, Gemini peut proposer 0-5
  // pistes que le producteur ajoutera ensuite via "Suggérer une émission".
  episode_ideas: z
    .array(episodeIdeaSchema)
    .max(5)
    .optional()
    .describe(
      "PISTES d'émissions (0-5). Si le brief est riche (PDF, paragraphe détaillé), propose 3-5 angles différents. Si le brief est court, omet ce champ — le producteur ajoutera les émissions une par une via 'Suggérer avec l'IA'.",
    ),
  notes: z
    .string()
    .max(400)
    .optional()
    .describe(
      "Conseils additionnels au producteur (logistique, contraintes spécifiques, idées créatives non couvertes ailleurs).",
    ),
});

export type EpisodeIdea = z.infer<typeof episodeIdeaSchema>;
export type ProjectDraft = z.infer<typeof projectSchema>;

const SYSTEM_PROMPT = `Tu es l'assistant créatif de LUMEN, studio de production audiovisuelle basé en Martinique.

L'équipe : 3 producteurs (Thibault, Meghane, Anthony) + des prestataires freelance + parfois des clients tiers. Production en français/créole, contenus pour TV / réseaux sociaux / marques.

À partir d'une idée (texte ou PDF), tu PROPOSES LA STRUCTURE D'UN PROJET. Pas les épisodes détaillés — juste le cadre qui guidera tout le reste.

## Ce que tu produis OBLIGATOIREMENT
- **name** : court, accrocheur, prononçable, mémorable. PAS générique ('Politique en Martinique' = mauvais ; 'Politik Péy' = bon).
- **kind** : 'client' si client tiers explicite, sinon 'media'.
- **description** : 2-4 phrases concrètes, orientées prod.
- **theme** : le sujet/angle. Pas un résumé de la description, mais ce qui rend le projet UNIQUE.
- **production_approach** : la FAÇON DE TOURNER. Où, comment, avec quel équipement type, quel style visuel. C'est la partie la plus utile au producteur — sois précis (lieux, types de plan, équipement).
- **target_audience** : persona précis.
- **tone** : 3-5 mots-clés stylistiques.
- **moodboard_prompts** : 3-5 prompts EN ANGLAIS cinématographiques.
- **production_tips** : 2-6 conseils actionnables.
- **inspiration_references** : 1-4 réfs concrètes (noms de chaînes, photographes, docs, styles).
- **recommendedSkills** : 2-8 compétences prestataires.

## OPTIONNEL : episode_ideas
Si le brief est riche (PDF, paragraphe détaillé avec plusieurs angles), tu peux proposer 3-5 PISTES d'émissions (titre + synopsis + format). Pas de script ni shot list à ce stade. Si le brief est court ou que tu n'as pas de matière pour des angles distincts cohérents, OMETS ce champ entier — le producteur ajoutera les émissions une par une plus tard avec un autre appel IA.

## Règles d'or
- Sois CONCRET. Pas de "à définir", pas de "à creuser".
- Pense local Martinique quand pertinent (lieux, culture, politique, histoire, langue).
- moodboard_prompts EN ANGLAIS, style cinéma (couleurs, lumière, focale, grain, mood).
- Réponds en français pour le reste.
- Si l'utilisateur fournit un PDF, lis-le attentivement ET respecte ses contraintes.
- **N'ESSAIE PAS de remplir episode_ideas si tu n'as pas de matière** : c'est mieux d'omettre que d'inventer du flou.`;

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

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
          "Analyse ce document et propose une structure de projet basée sur son contenu.",
      });
    }
  }

  // Stratégie de retry avec 2 modèles différents et thinking désactivé.
  // Gemini 2.5 Flash a un mode "thinking" activé par défaut qui consomme
  // jusqu'à 24k tokens AVANT de produire la sortie — ça tronque le JSON.
  // On le désactive explicitement et on fallback sur 2.0 Flash si 2.5 rate.
  const attempts = [
    {
      label: "2.5-flash (thinking off)",
      model: google("gemini-2.5-flash"),
      providerOptions: GEMINI_NO_THINKING,
    },
    {
      label: "2.0-flash",
      model: google("gemini-2.0-flash"),
      providerOptions: undefined,
    },
    {
      label: "2.5-flash (thinking off, 2nd try)",
      model: google("gemini-2.5-flash"),
      providerOptions: GEMINI_NO_THINKING,
    },
  ];

  let lastError: unknown = null;
  for (let i = 0; i < attempts.length; i++) {
    const att = attempts[i];
    try {
      const { object } = await generateObject({
        model: att.model,
        schema: projectSchema,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userParts }],
        maxOutputTokens: 16_384,
        providerOptions: att.providerOptions,
      });
      if (i > 0) {
        console.warn(
          `[ai] generateProjectDraft OK avec ${att.label} (essai ${i + 1}/${attempts.length})`,
        );
      }
      return { ok: true, draft: object };
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[ai] generateProjectDraft échec avec ${att.label} (essai ${i + 1}/${attempts.length}) : ${msg.slice(0, 400)}`,
      );
      if (isFatalError(msg)) break;
    }
  }
  return { ok: false, error: humanizeError(lastError) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isFatalError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("429") ||
    lower.includes("location is not supported") ||
    lower.includes("permission_denied") ||
    lower.includes("payload")
  );
}

function humanizeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "Erreur inconnue.";
  const lower = msg.toLowerCase();

  if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
    return "Quota Google AI atteint (limite gratuite : 1500 requêtes/jour). Réessaie dans 1 minute.";
  }
  if (
    lower.includes("user location is not supported") ||
    lower.includes("location is not supported") ||
    lower.includes("permission_denied")
  ) {
    return "Google AI bloque ta région (probablement à cause d'un VPN). Désactive le VPN, ou teste cette feature en prod (Vercel).";
  }
  if (
    lower.includes("response did not match schema") ||
    lower.includes("no object generated")
  ) {
    return "Gemini a renvoyé une réponse incomplète. Réessaie — souvent ça passe au 2e essai.";
  }
  if (lower.includes("payload") || lower.includes("size")) {
    return "Le document est trop volumineux. Essaie un PDF plus léger (<20 Mo).";
  }
  return msg;
}
