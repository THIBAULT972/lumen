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
    .min(1)
    .max(8)
    .describe(
      "Découpage du contenu en sections séquentielles. 3 à 6 sections recommandé (mais 1 minimum si c'est une capsule très courte).",
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
  script: scriptSchema
    .optional()
    .describe(
      "Script structuré : hook d'ouverture, sections séquentielles avec dialogues/contenu, call-to-action de fin. À fournir si tu as assez de matière, sinon omet.",
    ),
  shots: z
    .array(shotSchema)
    .max(12)
    .optional()
    .describe(
      "Shot list : 4 à 10 plans clés à capturer pour cet épisode. Mix de types pour avoir de la variété au montage. À fournir si tu as assez de matière.",
    ),
  visual_prompts: z
    .array(z.string().max(200))
    .max(4)
    .optional()
    .describe(
      "Prompts EN ANGLAIS pour générer des images d'illustration. Style cinématographique riche en détails (couleurs, lumière, angle, ambiance). Ex: 'cinematic shot of a Caribbean chef plating a colorful seafood dish, warm golden hour light, shallow depth of field, 35mm film aesthetic'. 2 à 4 prompts si tu en proposes.",
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
  // ── New project-level enrichments (best-effort, peuvent être omis) ──────
  target_audience: z
    .string()
    .max(200)
    .optional()
    .describe(
      "Persona cible : âge, intérêts, plateforme principale, contexte. 1-2 phrases.",
    ),
  tone: z
    .string()
    .max(140)
    .optional()
    .describe(
      "Ton éditorial : intimiste / punchy / contemplatif / didactique / fun / premium / etc. Mots-clés courts.",
    ),
  moodboard_prompts: z
    .array(z.string().max(200))
    .max(5)
    .optional()
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

Quand un producteur te décrit une idée (texte, PDF, ou les deux), tu génères un BROUILLON DE PROJET le plus complet possible compte tenu du contexte fourni.

## Champs OBLIGATOIRES
- name : nom court (max 80 char), accrocheur, prononçable.
- kind : 'client' si client tiers explicite, sinon 'media' (production interne).
- description : 2-4 phrases, ton concret prod.
- episodes : au moins 1 émission avec name, description, format, platforms (vide si non précisé).
- recommendedSkills : au moins une compétence prestataire utile (vide [] si vraiment rien).

## Champs RECOMMANDÉS (remplis-les si tu as la matière)
Niveau projet :
- target_audience : persona en 1-2 phrases.
- tone : 3-5 mots-clés stylistiques.
- moodboard_prompts : 3-5 prompts EN ANGLAIS cinématographiques pour images d'ambiance.
- production_tips : 3-5 conseils prod actionnables.
- inspiration_references : 2-4 réfs ciné/photo concrètes.

Niveau épisode :
- duration_minutes, location_suggestion, guests_suggestion.
- script structuré : hook + 2-6 sections (avec b-roll si tu veux) + cta.
- shots : 4-10 plans dans le vocabulaire ciné.
- visual_prompts : 2-4 prompts EN ANGLAIS pour images de cet épisode.

## Stratégie selon la richesse du brief
- **Brief très court (1-2 phrases)** : remplis les OBLIGATOIRES correctement, et fais au moins le moodboard + persona + ton. Pour le script/shots/visual_prompts, propose-les si tu peux raisonner dessus, sinon omet ces champs (ils sont optionnels). Mieux vaut omettre que d'inventer du flou.
- **Brief moyen (un paragraphe)** : remplis tout, en restant cohérent avec le contexte.
- **Brief riche (long texte ou PDF)** : sors un quasi-pitch deck, ultra-concret.

## Règles d'or
- Sois CONCRET. Pas de "à définir", pas de "à creuser".
- Pense local Martinique quand pertinent (lieux, culture, langue, cuisine, histoire, politique).
- visual_prompts et moodboard_prompts sont EN ANGLAIS — c'est ce qui marche le mieux avec les générateurs d'images. Style cinéma : lumière, palette, focale, grain.
- Réponds en français pour tout le reste.
- Si l'utilisateur fournit un PDF, lis-le attentivement et respecte ses contraintes spécifiques.
- IMPORTANT : ne te bloque jamais sur une contrainte impossible. Si tu ne peux pas générer 3 moodboard_prompts cohérents, omets le champ entier plutôt que de mettre du remplissage.`;

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
          "Analyse ce document et propose un brouillon de projet basé sur son contenu.",
      });
    }
  }

  /**
   * Tente la génération. Gemini Flash est non-déterministe et notre schéma
   * est riche → on s'autorise jusqu'à 3 essais avant d'abandonner. Entre
   * chaque retry on ajoute une consigne de plus en plus stricte sur la
   * concision pour éviter la troncature de sortie.
   */
  const attempts: { hint: string }[] = [
    { hint: "" },
    { hint: "Reste concis sur les sections optionnelles (script, shots, visual_prompts) — quelques éléments solides valent mieux qu'un long remplissage incomplet." },
    { hint: "Concentre-toi sur l'essentiel : name, kind, description, episodes (au moins 1 avec name+synopsis+format+platforms), recommendedSkills. Tout le reste est optionnel — omets si tu dois saturer la sortie." },
  ];

  let lastError: unknown = null;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      const messages = [
        {
          role: "user" as const,
          content: userParts,
        },
        ...(attempt.hint
          ? [
              {
                role: "user" as const,
                content: [{ type: "text" as const, text: attempt.hint }],
              },
            ]
          : []),
      ];

      const { object } = await generateObject({
        // Flash : gratuit + suffisamment capable. maxOutputTokens augmenté
        // à 32k car le schéma riche peut générer beaucoup de JSON et le
        // défaut Gemini (8k) provoque des troncatures → no object generated.
        model: google("gemini-2.5-flash"),
        schema: draftSchema,
        system: SYSTEM_PROMPT,
        messages,
        maxOutputTokens: 32_768,
      });
      if (i > 0) {
        console.warn(`[ai] generateProjectDraft réussi au retry ${i + 1}/${attempts.length}`);
      }
      return { ok: true, draft: object };
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[ai] generateProjectDraft échec ${i + 1}/${attempts.length}: ${msg.slice(0, 300)}`,
      );
      // Si c'est une erreur "non récupérable" (location, quota, payload),
      // on n'insiste pas — on sort tout de suite avec le bon message.
      const lower = msg.toLowerCase();
      if (
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("429") ||
        lower.includes("location is not supported") ||
        lower.includes("permission_denied") ||
        lower.includes("payload")
      ) {
        break;
      }
      // Sinon : on retry avec un hint supplémentaire.
    }
  }

  // Si on arrive ici, tous les essais ont échoué.
  {
    const e = lastError;
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
          "Gemini n'arrive pas à structurer la réponse même après 3 essais. C'est probablement une limite du modèle Flash sur ce schéma riche. Tu peux réessayer dans quelques minutes (Gemini varie), ou raccourcir/restructurer ta demande pour qu'elle soit plus directe (1 émission claire, 1 ton, 1 cible).",
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
