import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Stratégie en 2 phases pour éviter la saturation de Gemini Flash :
//   Phase 1 — "Skeleton" : génère le projet + 3-5 émissions BASIQUES
//             (name + synopsis + format + plateformes + meta) + moodboard.
//   Phase 2 — "Enrichment" : pour CHAQUE émission, un appel dédié sort
//             le script structuré + shot list + visual_prompts.
//
// Avantages :
//   - Chaque appel a son propre budget tokens → pas de troncature.
//   - Les champs riches deviennent OBLIGATOIRES dans leur schéma d'appel
//     dédié → on a la garantie d'avoir du contenu, pas du vide.
//   - Parallélisation des enrichments → 5 émissions ≈ 1 émission en latence.
// ─────────────────────────────────────────────────────────────────────────────

// ── Sub-schemas (réutilisés par phase 2) ────────────────────────────────────

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
      "Descriptions courtes des plans b-roll qui accompagnent cette section.",
    ),
});

const scriptSchema = z.object({
  hook: z
    .string()
    .max(280)
    .describe(
      "Accroche des 10-15 premières secondes : ce qui capte l'attention.",
    ),
  sections: z
    .array(scriptSectionSchema)
    .min(3)
    .max(6)
    .describe("Découpage en 3 à 6 sections séquentielles."),
  cta: z
    .string()
    .max(200)
    .describe("Call-to-action final : ce qu'on demande au spectateur."),
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
    .describe("Type de plan, vocabulaire ciné/vidéo standard."),
  description: z
    .string()
    .max(200)
    .describe(
      "Ce qui est filmé concrètement : sujet, action, ambiance lumineuse.",
    ),
});

// ── Phase 1 schemas — squelette du projet ──────────────────────────────────

const skeletonEpisodeSchema = z.object({
  name: z.string().max(80).describe("Titre de l'émission."),
  description: z
    .string()
    .max(280)
    .describe("Synopsis en 1 à 2 phrases."),
  format: z.enum([
    "Reportage",
    "Interview",
    "Capsule",
    "Documentaire",
    "Live",
    "Tutoriel",
    "Autre",
  ]),
  platforms: z
    .array(z.string().max(40))
    .max(5)
    .describe(
      "Plateformes de diffusion suggérées (YouTube, Instagram, TikTok, TF1, France 3, etc.).",
    ),
  duration_minutes: z
    .number()
    .int()
    .min(1)
    .max(120)
    .describe(
      "Durée estimée du contenu fini en minutes (capsule = 1-3 min, magazine TV = 10-25 min, doc = 25-60 min).",
    ),
  location_suggestion: z
    .string()
    .max(140)
    .describe(
      "Lieu de tournage suggéré (un seul, le plus pertinent). Pense local Martinique quand applicable.",
    ),
  guests_suggestion: z
    .array(z.string().max(80))
    .min(1)
    .max(6)
    .describe(
      "Profils d'intervenants suggérés (descriptions de profil, pas de noms réels).",
    ),
});

const skeletonSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(80)
    .describe("Nom court et accrocheur du projet (max 80 caractères)."),
  kind: z
    .enum(["client", "media"])
    .describe(
      "'client' si l'utilisateur a mentionné un client tiers, sinon 'media'.",
    ),
  description: z.string().max(500).describe("Description en 2-4 phrases."),
  target_audience: z
    .string()
    .max(200)
    .describe("Persona cible : âge, intérêts, plateforme principale."),
  tone: z
    .string()
    .max(140)
    .describe("Ton éditorial : 3-5 mots-clés stylistiques."),
  moodboard_prompts: z
    .array(z.string().max(200))
    .min(3)
    .max(5)
    .describe(
      "Prompts EN ANGLAIS pour 3-5 images de moodboard. Cinématographique riche : couleurs, lumière, textures, références implicites. Ex: 'cinematic moodboard, sun-drenched Caribbean coastline at dusk, terracotta and indigo palette, 35mm film grain'.",
    ),
  production_tips: z
    .array(z.string().max(180))
    .min(2)
    .max(6)
    .describe(
      "Conseils prod actionnables : équipement, lieu, timing, contraintes.",
    ),
  inspiration_references: z
    .array(z.string().max(120))
    .min(1)
    .max(4)
    .describe(
      "Références d'inspiration concrètes (ex: 'style Vice News', 'photographie Annie Leibovitz').",
    ),
  episodes: z
    .array(skeletonEpisodeSchema)
    .min(3)
    .max(6)
    .describe(
      "3 à 6 émissions COHÉRENTES entre elles : si l'utilisateur dit 'hebdomadaire', propose plusieurs sujets traités sur 3-5 semaines. Pas de doublon, chacune doit avoir un angle propre.",
    ),
  recommendedSkills: z
    .array(z.string().max(40))
    .min(2)
    .max(8)
    .describe(
      "Compétences prestataires recommandées (ex: 'Droniste', 'Cadreur 4K', 'Monteur', 'Photographe').",
    ),
  notes: z
    .string()
    .max(400)
    .optional()
    .describe("Conseils additionnels si pertinent."),
});

type Skeleton = z.infer<typeof skeletonSchema>;

// ── Phase 2 schema — enrichment d'un seul épisode ──────────────────────────

const enrichmentSchema = z.object({
  script: scriptSchema.describe(
    "Script structuré complet pour cet épisode.",
  ),
  shots: z
    .array(shotSchema)
    .min(5)
    .max(10)
    .describe(
      "Shot list : 5 à 10 plans clés. VARIE les types (mix de plans larges, gros plans, drone, time-lapse) pour avoir du rythme au montage.",
    ),
  visual_prompts: z
    .array(z.string().max(200))
    .min(3)
    .max(4)
    .describe(
      "3 à 4 prompts EN ANGLAIS pour générer des images d'illustration de cet épisode. Style cinématographique avec détails visuels précis (couleurs, lumière, focale, ambiance). Ex: 'cinematic shot of a young Caribbean politician at a town hall meeting, dramatic backlight from windows, shallow depth of field, documentary style, 35mm film aesthetic'.",
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Final export types — ce que la UI consomme
// ─────────────────────────────────────────────────────────────────────────────

export type EpisodeDraft = z.infer<typeof skeletonEpisodeSchema> &
  Partial<z.infer<typeof enrichmentSchema>>;

export type ProjectDraft = Omit<Skeleton, "episodes"> & {
  episodes: EpisodeDraft[];
};

export type ScriptDraft = z.infer<typeof scriptSchema>;
export type ShotDraft = z.infer<typeof shotSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// System prompts (un par phase)
// ─────────────────────────────────────────────────────────────────────────────

const SKELETON_SYSTEM_PROMPT = `Tu es l'assistant créatif de LUMEN, studio de production audiovisuelle basé en Martinique.

L'équipe : 3 producteurs (Thibault, Meghane, Anthony) + des prestataires freelance + parfois des clients tiers. Production en français/créole, contenus pour TV / réseaux sociaux / marques.

À partir d'une idée (texte ou PDF), tu PROPOSES UN SQUELETTE DE PROJET RICHE :
- Nom court, accrocheur, prononçable.
- Type : 'client' si client tiers explicite, sinon 'media'.
- Description claire (2-4 phrases).
- Persona cible précis.
- Ton éditorial en 3-5 mots-clés.
- 3 à 5 moodboard_prompts EN ANGLAIS, cinématographiques, riches (couleurs, lumière, focale, références implicites).
- 2 à 5 conseils prod actionnables.
- 1 à 4 références d'inspiration concrètes.
- **3 à 5 ÉMISSIONS COHÉRENTES** : même si l'utilisateur dit "une émission hebdomadaire", propose 3-5 sujets différents traités dans le format de cette émission (chaque épisode est un sujet/angle distinct). Si l'utilisateur dit explicitement "1 seule émission", tu peux n'en proposer qu'une, mais sinon vise 3-5.
- Compétences prestataires utiles.

Pour chaque émission, tu donnes : name, synopsis, format, plateformes, durée estimée, lieu suggéré, profils d'intervenants (descriptions, pas de noms réels).

⚠️ NE GÉNÈRE PAS de script, ni de shot list, ni de visual prompts par épisode. Ça sera fait dans un appel séparé.

Règles d'or :
- Sois CONCRET. Pas de "à définir".
- Pense local Martinique quand pertinent (lieux, culture, politique, histoire, langue).
- visual_prompts et moodboard_prompts EN ANGLAIS — style cinéma.
- Réponds en français pour le reste.
- Si un PDF est fourni, lis-le attentivement et respecte ses contraintes.`;

const ENRICH_SYSTEM_PROMPT = `Tu es l'assistant créatif de LUMEN, studio de production audiovisuelle basé en Martinique.

On te donne UNE émission spécifique d'un projet plus large (avec le contexte du projet + le ton + l'audience). Tu en sors :

1. **SCRIPT STRUCTURÉ** :
   - Hook : 10-15 premières secondes, ce qui capte l'attention (question, scène choc, statistique, citation).
   - 3 à 6 sections séquentielles : titre court + contenu détaillé (3-8 phrases, du concret : ce qui est dit/montré, dialogues clés, transitions). Optionnel : 2-4 plans b-roll par section.
   - CTA de fin : ce qu'on demande au spectateur.

2. **SHOT LIST** : 5 à 10 plans clés à capturer. Mix de types (plans larges, gros plans, drone, time-lapse, slow motion, plans séquence) pour avoir du rythme au montage. Pour chaque plan : type + description concrète (sujet, action, lumière).

3. **VISUAL PROMPTS EN ANGLAIS** : 3-4 prompts cinématographiques pour générer des images d'illustration de CET épisode. Détails précis : couleurs, lumière, focale (35mm, 50mm), profondeur de champ, grain, ambiance. Pas de "a video about politics" — quelque chose comme "cinematic medium shot of a young Caribbean man speaking passionately into a microphone at a town hall meeting, late afternoon sun streaming through windows, shallow depth of field, documentary style, 35mm film aesthetic".

Règles d'or :
- Sois ULTRA-CONCRET. Le producteur doit pouvoir lire ton output et démarrer le tournage demain.
- Reste cohérent avec le projet global (ton, audience, plateformes).
- visual_prompts EN ANGLAIS, style cinéma.
- Réponds en français pour le reste.`;

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

  // ─── Phase 1 : génère le squelette ────────────────────────────────────────
  const skeletonResult = await generateSkeleton(input);
  if (!skeletonResult.ok) return skeletonResult;
  const skeleton = skeletonResult.skeleton;

  // ─── Phase 2 : enrichit chaque épisode en parallèle ──────────────────────
  // On utilise allSettled pour ne pas tout perdre si un seul épisode rate.
  const enrichments = await Promise.allSettled(
    skeleton.episodes.map((ep) => enrichEpisode(skeleton, ep)),
  );

  const enrichedEpisodes: EpisodeDraft[] = skeleton.episodes.map(
    (ep, idx) => {
      const r = enrichments[idx];
      if (r.status === "fulfilled" && r.value.ok) {
        return { ...ep, ...r.value.enrichment };
      }
      // Si l'enrichissement a raté pour cet épisode, on renvoie au moins
      // le squelette de l'épisode (la UI affichera les bases).
      const reason =
        r.status === "rejected"
          ? r.reason instanceof Error
            ? r.reason.message
            : String(r.reason)
          : "ok" in r.value && !r.value.ok
            ? r.value.error
            : "inconnu";
      console.warn(
        `[ai] enrichissement épisode "${ep.name}" raté : ${String(reason).slice(0, 200)}`,
      );
      return ep;
    },
  );

  return {
    ok: true,
    draft: {
      ...skeleton,
      episodes: enrichedEpisodes,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — Skeleton
// ─────────────────────────────────────────────────────────────────────────────

async function generateSkeleton(
  input: GeneratorInput,
): Promise<{ ok: true; skeleton: Skeleton } | { ok: false; error: string }> {
  const userParts: (
    | { type: "text"; text: string }
    | { type: "file"; data: Uint8Array; mediaType: string }
  )[] = [];

  if (input.idea.trim()) {
    userParts.push({ type: "text", text: input.idea.trim() });
  }
  if (input.attachment) {
    userParts.push({
      type: "file",
      data: input.attachment.bytes,
      mediaType: input.attachment.mimeType,
    });
    if (!input.idea.trim()) {
      userParts.push({
        type: "text",
        text:
          "Analyse ce document et propose un squelette de projet basé sur son contenu.",
      });
    }
  }

  // Jusqu'à 2 essais. Le squelette est compact donc ça passe presque
  // toujours du 1er coup, mais on garde un filet de sécurité.
  let lastError: unknown = null;
  for (let i = 0; i < 2; i++) {
    try {
      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: skeletonSchema,
        system: SKELETON_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userParts }],
        maxOutputTokens: 16_384,
      });
      if (i > 0) {
        console.warn(`[ai] skeleton OK au retry ${i + 1}/2`);
      }
      return { ok: true, skeleton: object };
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[ai] skeleton échec ${i + 1}/2 : ${msg.slice(0, 300)}`,
      );
      if (isFatalError(msg)) break;
    }
  }
  return { ok: false, error: humanizeError(lastError) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — Enrichment per episode
// ─────────────────────────────────────────────────────────────────────────────

async function enrichEpisode(
  skeleton: Skeleton,
  episode: z.infer<typeof skeletonEpisodeSchema>,
): Promise<
  | { ok: true; enrichment: z.infer<typeof enrichmentSchema> }
  | { ok: false; error: string }
> {
  // Contexte du projet pour que Gemini reste cohérent.
  const context = [
    `Projet : ${skeleton.name}`,
    `Description : ${skeleton.description}`,
    `Audience cible : ${skeleton.target_audience}`,
    `Ton éditorial : ${skeleton.tone}`,
    "",
    `--- ÉMISSION À ENRICHIR ---`,
    `Titre : ${episode.name}`,
    `Synopsis : ${episode.description}`,
    `Format : ${episode.format}`,
    `Durée : ${episode.duration_minutes} min`,
    `Plateformes : ${episode.platforms.join(", ") || "non précisé"}`,
    `Lieu suggéré : ${episode.location_suggestion}`,
    `Intervenants suggérés : ${episode.guests_suggestion.join(", ")}`,
  ].join("\n");

  let lastError: unknown = null;
  for (let i = 0; i < 2; i++) {
    try {
      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: enrichmentSchema,
        system: ENRICH_SYSTEM_PROMPT,
        messages: [{ role: "user", content: [{ type: "text", text: context }] }],
        maxOutputTokens: 16_384,
      });
      if (i > 0) {
        console.warn(
          `[ai] enrichment "${episode.name}" OK au retry ${i + 1}/2`,
        );
      }
      return { ok: true, enrichment: object };
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[ai] enrichment "${episode.name}" échec ${i + 1}/2 : ${msg.slice(0, 300)}`,
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
    return "Gemini n'arrive pas à structurer la réponse même après plusieurs essais. Réessaie dans quelques minutes (Gemini varie) ou raccourcis légèrement ta demande.";
  }
  if (lower.includes("payload") || lower.includes("size")) {
    return "Le document est trop volumineux. Essaie un PDF plus léger (<20 Mo).";
  }
  return msg;
}
