// LUMEN — Edge Function `process-meeting-audio`
//
// Pipeline complet de traitement d'un audio de réunion :
//   1. Lit le record meeting_reports
//   2. Download audio depuis Supabase Storage
//   3. Upload vers Google Gemini File API (resumable upload, max 2 GB)
//   4. Appelle Gemini 2.5 pour résumer l'audio + retourner un JSON structuré
//   5. Cleanup le fichier remote chez Google
//   6. Update meeting_reports avec status='done' + summary
//
// Pourquoi Edge Function et pas server action Next.js ?
//   - Vercel Free a un timeout de 10s. Le traitement Gemini d'un audio de
//     3h peut prendre 60-120s.
//   - Supabase Edge Functions ont un timeout de 150s en gratuit → assez.
//
// Trigger : POST depuis LUMEN avec `{ report_id }`. La fonction tourne en
// background ; LUMEN n'attend pas la réponse, il utilise Supabase Realtime
// pour être notifié quand `meeting_reports.status` passe à 'done'.
//
// Schéma de sortie Gemini : titre, tldr, decisions[], actions[], key_points[],
// open_questions[]. Identique au format texte (déjà géré côté UI).

// @ts-expect-error — Deno globals available in Supabase Edge Functions runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GEMINI_API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STORAGE_BUCKET = "files";

const FILES_API_BASE = "https://generativelanguage.googleapis.com/v1beta/files";
const GENERATE_API = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// JSON schema for Gemini (structured output)
const SUMMARY_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Titre court de la réunion, 3-8 mots.",
    },
    tldr: {
      type: "string",
      description: "Résumé exécutif en 2-3 phrases.",
    },
    decisions: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          outcome: { type: "string" },
        },
        required: ["topic", "outcome"],
      },
    },
    actions: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          what: { type: "string" },
          owner: { type: "string" },
          deadline: { type: "string" },
        },
        required: ["what"],
      },
    },
    key_points: {
      type: "array",
      maxItems: 8,
      items: { type: "string" },
    },
    open_questions: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
    },
  },
  required: ["title", "tldr", "decisions", "actions", "key_points", "open_questions"],
};

const SYSTEM_PROMPT = `Tu es l'assistant de production de LUMEN, studio audiovisuel basé en Martinique. Équipe : 3 producteurs (Thibault, Meghane, Anthony), prestataires freelance, clients tiers.

On te donne l'audio brut d'une réunion. Tu en sors un compte-rendu STRUCTURÉ et ACTIONNABLE.

Règles :
- Écoute toute la réunion. Identifie les voix si tu peux ('un homme dit que...', 'une voix féminine propose...').
- Décisions : que des trucs vraiment tranchés.
- Actions : verbe d'action en tête ('Appeler X', 'Réserver le studio'). Attribue à un owner si mentionné, sinon omet le champ owner.
- Deadlines : extrais les délais explicites (avant vendredi, fin de semaine, 15 juin). N'invente pas.
- Points clés : risques, contraintes, idées créatives à creuser.
- Questions ouvertes : ce qui n'a pas été tranché.
- Réponds toujours en français même si l'audio mélange créole/français.
- N'invente RIEN. Si tu doutes, omets ou mets dans open_questions.`;

type MeetingReportRow = {
  id: string;
  audio_storage_path: string | null;
  source_type: "text" | "audio";
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: { report_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  const reportId = body.report_id;
  if (!reportId) {
    return new Response("Missing report_id", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Lit le record
  const { data: report, error: readErr } = await supabase
    .from("meeting_reports")
    .select("id, audio_storage_path, source_type")
    .eq("id", reportId)
    .maybeSingle();
  if (readErr || !report) {
    return new Response(`Report not found: ${readErr?.message ?? "no row"}`, {
      status: 404,
    });
  }
  if (report.source_type !== "audio" || !report.audio_storage_path) {
    return new Response("Report is not an audio source", { status: 400 });
  }

  // On répond immédiatement 202 et on traite en arrière-plan.
  // Supabase Edge Functions supportent EdgeRuntime.waitUntil pour ça.
  // @ts-expect-error — EdgeRuntime is a Deno-specific global
  EdgeRuntime.waitUntil(processInBackground(supabase, report as MeetingReportRow));

  return new Response(JSON.stringify({ ok: true, started: true }), {
    headers: { "Content-Type": "application/json" },
    status: 202,
  });
});

async function processInBackground(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  report: MeetingReportRow,
) {
  const reportId = report.id;
  const audioPath = report.audio_storage_path!;
  let geminiFileName: string | null = null;

  try {
    // 1. Update status -> uploading
    await supabase
      .from("meeting_reports")
      .update({ status: "uploading", error_message: null })
      .eq("id", reportId);

    // 2. Download audio from Supabase Storage
    const { data: blob, error: dlErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(audioPath);
    if (dlErr || !blob) {
      throw new Error(`Storage download: ${dlErr?.message ?? "no blob"}`);
    }
    const audioBytes = new Uint8Array(await blob.arrayBuffer());
    const mimeType = blob.type || "audio/mpeg";
    const sizeBytes = audioBytes.length;

    // 3. Upload to Gemini File API (resumable)
    // Step 3a: start upload session
    const startRes = await fetch(
      `${FILES_API_BASE}?uploadType=resumable&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(sizeBytes),
          "X-Goog-Upload-Header-Content-Type": mimeType,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file: {
            display_name: `meeting-${reportId}.${mimeType.split("/")[1] || "mp3"}`,
          },
        }),
      },
    );
    if (!startRes.ok) {
      throw new Error(
        `File API start (${startRes.status}): ${await startRes.text()}`,
      );
    }
    const uploadUrl = startRes.headers.get("X-Goog-Upload-URL");
    if (!uploadUrl) {
      throw new Error("File API : no upload URL returned");
    }

    // Step 3b: upload bytes
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(sizeBytes),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: audioBytes,
    });
    if (!uploadRes.ok) {
      throw new Error(
        `File API upload (${uploadRes.status}): ${await uploadRes.text()}`,
      );
    }
    const uploadJson = await uploadRes.json();
    const fileUri: string | undefined = uploadJson?.file?.uri;
    geminiFileName = uploadJson?.file?.name ?? null;
    if (!fileUri) {
      throw new Error("File API : no file URI returned");
    }

    // Wait for the file to become ACTIVE (Gemini needs to process it).
    // Audio files are usually ready in a few seconds.
    await waitForFileActive(geminiFileName!, 60_000);

    // 4. Update status -> analyzing
    await supabase
      .from("meeting_reports")
      .update({ status: "analyzing" })
      .eq("id", reportId);

    // 5. Call Gemini to summarize
    const genRes = await fetch(
      `${GENERATE_API("gemini-2.5-flash")}?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [
                { file_data: { mime_type: mimeType, file_uri: fileUri } },
                { text: "Sors le compte-rendu structuré de cette réunion." },
              ],
            },
          ],
          generation_config: {
            response_mime_type: "application/json",
            response_schema: SUMMARY_JSON_SCHEMA,
            // Disable thinking on 2.5 Flash to keep tokens for output
            thinking_config: { thinking_budget: 0 },
            max_output_tokens: 8192,
          },
        }),
      },
    );
    if (!genRes.ok) {
      throw new Error(
        `Gemini generate (${genRes.status}): ${await genRes.text()}`,
      );
    }
    const genJson = await genRes.json();
    const textPart = genJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textPart) {
      throw new Error("Gemini : no text in response");
    }
    let summary: unknown;
    try {
      summary = JSON.parse(textPart);
    } catch (e) {
      throw new Error(`Gemini : invalid JSON response: ${(e as Error).message}`);
    }

    // 6. Extract title for the row
    const title =
      typeof (summary as { title?: unknown }).title === "string"
        ? (summary as { title: string }).title.slice(0, 200)
        : "Compte-rendu";

    // 7. Update record with summary
    const { error: upErr } = await supabase
      .from("meeting_reports")
      .update({
        status: "done",
        summary,
        title,
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", reportId);
    if (upErr) throw new Error(`Final update: ${upErr.message}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[process-meeting-audio:${reportId}] error: ${msg}`);
    await supabase
      .from("meeting_reports")
      .update({
        status: "error",
        error_message: msg.slice(0, 1000),
      })
      .eq("id", reportId);
  } finally {
    // 8. Cleanup Google File API (best-effort)
    if (geminiFileName) {
      try {
        await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${geminiFileName}?key=${GEMINI_API_KEY}`,
          { method: "DELETE" },
        );
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Poll Gemini Files API until the file becomes ACTIVE (processed and ready
 * for inference). Throws if the file becomes FAILED or after the timeout.
 */
async function waitForFileActive(
  fileName: string,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`;
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`File API status (${res.status}): ${await res.text()}`);
    }
    const json = await res.json();
    const state: string = json?.state ?? "UNKNOWN";
    if (state === "ACTIVE") return;
    if (state === "FAILED") {
      throw new Error("File API : file processing FAILED");
    }
    // wait 2s and retry
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("File API : timeout waiting for ACTIVE state");
}
