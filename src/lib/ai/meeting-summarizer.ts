import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

const meetingSummarySchema = z.object({
  title: z
    .string()
    .max(80)
    .describe(
      "Titre court de la réunion, 3-8 mots. Déduit du contenu (ex: 'Brief campagne X, repérage Sainte-Anne').",
    ),
  tldr: z
    .string()
    .max(300)
    .describe(
      "Résumé exécutif en 2-3 phrases : ce qui s'est dit, et l'orientation globale.",
    ),
  decisions: z
    .array(
      z.object({
        topic: z
          .string()
          .max(120)
          .describe("Sujet de la décision, formulé en 1 phrase courte."),
        outcome: z
          .string()
          .max(200)
          .describe("Ce qui a été tranché. Concret, sans ambiguïté."),
      }),
    )
    .max(10)
    .describe(
      "Décisions prises pendant la réunion. Ne mets que de vraies décisions, pas des hypothèses.",
    ),
  actions: z
    .array(
      z.object({
        what: z
          .string()
          .max(160)
          .describe("Action à mener (verbe d'action en tête)."),
        owner: z
          .string()
          .max(40)
          .optional()
          .describe(
            "Personne en charge si mentionnée dans le texte (prénom). Sinon omet.",
          ),
        deadline: z
          .string()
          .max(40)
          .optional()
          .describe(
            "Date ou délai si mentionnés (ex: '15 juin', 'avant tournage', 'd'ici fin de semaine'). Sinon omet.",
          ),
      }),
    )
    .max(12)
    .describe(
      "TODO list issue de la réunion. Limite-toi à ce qui doit vraiment être fait.",
    ),
  key_points: z
    .array(z.string().max(180))
    .max(8)
    .describe(
      "Points clés notés : risques identifiés, contraintes, idées créatives à creuser.",
    ),
  open_questions: z
    .array(z.string().max(160))
    .max(6)
    .describe(
      "Questions restées sans réponse, à traiter dans une prochaine réunion ou via un échange séparé.",
    ),
});

export type MeetingSummary = z.infer<typeof meetingSummarySchema>;

const SYSTEM_PROMPT = `Tu es l'assistant de production de LUMEN, studio audiovisuel basé en Martinique. Équipe : 3 producteurs (Thibault, Meghane, Anthony), des prestataires freelance, et des clients tiers.

On te donne le texte brut d'une réunion (notes, transcription, dictée vocale convertie en texte). Tu en sors un compte-rendu STRUCTURÉ et ACTIONNABLE.

Règles :
- Sois concret. Si une info est floue dans la source, n'invente pas — omets ou mets-la dans "open_questions".
- Décisions : que des trucs vraiment tranchés, pas des "on pourrait peut-être".
- Actions : verbe d'action en tête ("Appeler X", "Réserver le studio", "Envoyer le devis Y"). Attribue à un owner SEULEMENT si le texte le mentionne clairement.
- Deadlines : extrais les délais explicites du texte ('avant vendredi', 'd'ici fin de semaine', '15 juin'). N'invente pas.
- Points clés : risques, contraintes budget/calendrier, idées créatives qui méritent d'être notées.
- Questions ouvertes : ce qui n'a pas été tranché et nécessite un suivi.
- Réponds en français. Si le texte mélange créole/français, garde le sens en français standard dans le résumé.`;

export async function summarizeMeeting(
  notes: string,
): Promise<{ ok: true; summary: MeetingSummary } | { ok: false; error: string }> {
  const trimmed = notes.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "Colle le texte de la réunion (notes, transcription, dictée…).",
    };
  }
  if (trimmed.length < 60) {
    return {
      ok: false,
      error:
        "Texte trop court pour en tirer un compte-rendu utile (min 60 caractères).",
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
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: meetingSummarySchema,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: trimmed }],
        },
      ],
    });
    return { ok: true, summary: object };
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
          "Google AI bloque ta région (probablement à cause d'un VPN). Désactive le VPN, ou teste cette feature en prod (Vercel).",
      };
    }
    if (
      lower.includes("response did not match schema") ||
      lower.includes("no object generated")
    ) {
      return {
        ok: false,
        error:
          "L'IA n'a pas pu structurer ce texte. Vérifie qu'il décrit vraiment une réunion (notes ou transcription).",
      };
    }
    return { ok: false, error: msg };
  }
}
