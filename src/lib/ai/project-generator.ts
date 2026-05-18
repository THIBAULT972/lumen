import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const scriptSectionSchema = z.object({
  heading: z
    .string()
    .max(80)
    .describe("Titre court de la section (ex: 'Intro', 'Première interview')."),
  content: z
    .string()
    .max(700)
    .describe(
      "Texte de la section : ce qui est dit/montré, dialogues clés, points abordés. 3 à 8 phrases.",
    ),
  b_roll: z
    .array(z.string().max(140))
    .max(5)
    .optional()
    .describe(
      "Descriptions courtes des plans d'illustration (b-roll) qui accompagnent cette section. Ex: 'gros plan sur les mains du chef en train de remuer'.",
    ),
});

const scriptSchema = z.object({
  hook: z
    .string()
    .max(280)
    .describe(
      "Accroche des 10-15 premières secondes : ce qui capte l'attention au tout début (question, scène choc, citation).",
    ),
  sections: z
    .array(scriptSectionSchema)
    .min(2)
    .max(8)
    .describe(
      "Découpage du contenu en sections séquentielles. 3 à 6 sections recommandé.",
    ),
  cta: z
    .string()
    .max(200)
    .describe(
      "Call-to-action final : sur quoi l'épisode se termine, quelle action est demandée au spectateur (s'abonner, partager, suivre la suite).",
    ),
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
    .describe("Type de plan, dans le vocabulaire ciné/vidéo standard."),
  description: z
    .string()
    .max(200)
    .describe(
      "Ce qui est filmé concrètement. Sois précis : sujet, action, ambiance lumineuse.",
    ),
});

const episodeSchema = z.object({
  name: z
    .string()
    .max(80)
    .describe("Titre de l'émission (ex: 'Épisode 1 — Sainte-Anne')"),
  description: z
    .string()
    .max(280)
    .describe("Synopsis en 1 à 2 phrases — l'essentiel de l'épisode."),
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
    .array(z.string().max(40))
    .max(5)
    .describe(
      "Plateformes de diffusion suggérées (YouTube, Instagram, TikTok, TF1, France 3, etc.).",
    ),
  // ── New enriched fields ──────────────────────────────────────────────────
  duration_minutes: z
    .number()
    .int()
    .min(1)
    .max(120)
    .optional()
    .describe(
      "Durée estimée du contenu fini en minutes (capsule courte = 1-3 min, capsule longue = 5-10 min, reportage = 10-25 min, documentaire = 25-60 min).",
    ),
  location_suggestion: z
    .string()
    .max(140)
    .optional()
    .describe(
      "Lieu de tournage suggéré (un seul, le plus pertinent). Pense local Martinique quand applicable.",
    ),
  guests_suggestion: z
    .array(z.string().max(80))
    .max(6)
    .optional()
    .describe(
      "Profils d'intervenants suggérés (pas des noms réels — des descriptions de profil : 'chef cuisinier créole 30-40 ans', 'historien spécialiste de l'esclavage').",
    ),
  script: scriptSchema.describe(
    "Script structuré : hook d'ouverture, sections séquentielles avec dialogues/contenu, call-to-action de fin.",
  ),
  shots: z
    .array(shotSchema)
    .min(3)
    .max(12)
    .describe(
      "Shot list : 4 à 10 plans clés à capturer pour cet épisode. Mix de types pour avoir de la variété au montage.",
    ),
  visual_prompts: z
    .array(z.string().max(200))
    .min(2)
    .max(4)
    .describe(
      "Prompts EN ANGLAIS pour générer des images d'illustration ou moodboard. Style descriptif, cinématographique, riche en détails visuels (couleurs, lumière, angle, ambiance). Ex: 'cinematic shot of a Caribbean chef plating a colorful seafood dish, warm golden hour light, shallow depth of field, 35mm film aesthetic'. 2 à 4 prompts par épisode.",
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Top-level schema
// ─────────────────────────────────────────────────────────────────────────────

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
  // ── New project-level enrichments ────────────────────────────────────────
  target_audience: z
    .string()
    .max(200)
    .describe(
      "Persona cible : âge, intérêts, plateforme principale, contexte. 1-2 phrases.",
    ),
  tone: z
    .string()
    .max(140)
    .describe(
      "Ton éditorial : intimiste / punchy / contemplatif / didactique / fun / premium / etc. Mots-clés courts.",
    ),
  moodboard_prompts: z
    .array(z.string().max(200))
    .min(3)
    .max(5)
    .describe(
      "Prompts EN ANGLAIS pour générer 3-5 images de moodboard représentant l'ambiance visuelle du projet. Style cinématographique riche : couleurs dominantes, lumière, textures, références implicites. Ex: 'cinematic moodboard, sun-drenched Caribbean coastline at dusk, terracotta and indigo palette, 35mm film grain, atmospheric haze'.",
    ),
  production_tips: z
    .array(z.string().max(180))
    .max(6)
    .optional()
    .describe(
      "Conseils prod actionnables : équipement spécifique, choix de lieu, timing optimal, contraintes à anticiper.",
    ),
  inspiration_references: z
    .array(z.string().max(120))
    .max(4)
    .optional()
    .describe(
      "Références d'inspiration concrètes : 'style Vice News', 'photographie type Annie Leibovitz', 'montage rythmique façon Jakob Owens'. Pas plus de 4.",
    ),
  // ── Episodes ─────────────────────────────────────────────────────────────
  episodes: z
    .array(episodeSchema)
    .min(1)
    .max(6)
    .describe(
      "Liste d'émissions détaillées (au moins 1, idéalement 3 à 5). Chaque émission a son propre script + shot list + visual prompts.",
    ),
  // ── Wrap-up ──────────────────────────────────────────────────────────────
  recommendedSkills: z
    .array(z.string().max(40))
    .max(8)
    .describe(
      "Compétences prestataires recommandées (ex: 'Droniste', 'Cadreur 4K', 'Monteur', 'Photographe').",
    ),
  notes: z
    .string()
    .max(400)
    .optional()
    .describe(
      "Conseils additionnels au producteur (logistique, contraintes, idées créatives non couvertes ailleurs).",
    ),
});

export type ProjectDraft = z.infer<typeof draftSchema>;
export type EpisodeDraft = z.infer<typeof episodeSchema>;
export type ScriptDraft = z.infer<typeof scriptSchema>;
export type ShotDraft = z.infer<typeof shotSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es l'assistant créatif de LUMEN, studio de production audiovisuelle basé en Martinique.

L'équipe : 3 producteurs (Thibault, Meghane, Anthony) + des prestataires freelance (cameraman, droniste, monteur, photographe) + parfois des clients tiers. Production en français/créole, contenus pour TV / réseaux sociaux / marques.

Quand un producteur te décrit une idée (texte, PDF, ou les deux), tu génères un BROUILLON DE PROJET COMPLET — pas une coquille vide. Le brouillon doit servir de point de départ travaillé : on doit pouvoir le lire et avoir l'impression d'avoir un quasi-pitch deck.

## Ce que tu produis pour le PROJET
- Nom court (max 80 char), accrocheur, prononçable.
- Type : 'client' si client tiers explicite, sinon 'media' (production interne).
- Description : 2-4 phrases, ton concret prod.
- Target audience : décris le persona en 1-2 phrases (âge, intérêts, plateforme principale).
- Tone : 3-5 mots-clés stylistiques (intimiste, punchy, premium, didactique, fun, etc.).
- 3 à 5 moodboard prompts EN ANGLAIS, cinématographiques, riches en détails visuels (couleurs, lumière, textures, ambiance, références implicites). Ces prompts vont nourrir un générateur d'images.
- Production tips : 3-5 conseils prod concrets et actionnables (équipement, lieu, timing, contraintes).
- Inspiration references : 2-4 réfs ciné/photo/montage concrètes.

## Ce que tu produis pour CHAQUE ÉMISSION
- Nom + synopsis (1-2 phrases) + format + plateformes.
- Durée estimée en minutes (adapte au format).
- Lieu de tournage suggéré (1 seul, le plus pertinent — pense local Martinique).
- Profils d'intervenants suggérés (descriptions de profil, pas de vrais noms).
- SCRIPT STRUCTURÉ :
  - Hook : les 10-15 premières secondes, ce qui capte l'attention.
  - Sections : 3 à 6 sections séquentielles avec heading + contenu (3-8 phrases par section, du concret : ce qui est dit/montré, dialogues clés). Pour chaque section, propose 2-4 plans b-roll d'illustration.
  - CTA : call-to-action de fin.
- SHOT LIST : 4 à 10 plans clés (types de plan + description de ce qui est filmé). Varie les types pour avoir du rythme au montage.
- VISUAL PROMPTS EN ANGLAIS : 2-4 prompts cinématographiques pour images d'illustration de cet épisode spécifique.

## Règles d'or
- Sois concret et détaillé. Pas de "un sujet à creuser" ou "à définir". Si tu n'as pas l'info, prends une décision créative et fais.
- Pense local Martinique quand pertinent (lieux, culture, langue, cuisine, histoire).
- Les visual_prompts et moodboard_prompts sont EN ANGLAIS — c'est ce qui marche le mieux avec les générateurs d'images.
- Style cinéma : pense lumière, palette, profondeur de champ, format de pellicule (35mm, 16mm), grain.
- Réponds en français pour tout le reste.
- Si l'utilisateur fournit un PDF (brief, dossier de prod), lis-le attentivement ET respecte ses contraintes spécifiques.`;

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
      // On garde Flash : plus rapide + gratuit, et largement capable pour ce
      // niveau de structuration. Si la qualité descend avec le schéma plus
      // riche, on basculera sur gemini-2.5-pro (payant mais sensiblement
      // meilleur en créativité longue).
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
