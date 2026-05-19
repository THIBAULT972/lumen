# `process-meeting-audio` — Supabase Edge Function

Traite l'audio d'une réunion uploaded dans Supabase Storage : envoi vers
Gemini File API + résumé structuré + persistance dans `meeting_reports`.

## Variables d'env (Supabase Edge Function secrets)

```bash
supabase secrets set GOOGLE_GENERATIVE_AI_API_KEY=...
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement
par Supabase à chaque Edge Function.

## Déploiement

```bash
supabase functions deploy process-meeting-audio
```

## Invocation

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/process-meeting-audio' \
  -H 'Authorization: Bearer <anon-or-service-key>' \
  -H 'Content-Type: application/json' \
  -d '{"report_id": "uuid-here"}'
```

Renvoie immédiatement `202` puis traite en arrière-plan via
`EdgeRuntime.waitUntil` (timeout effectif ~150s, suffisant pour 3h d'audio).

## Statuts mis à jour pendant le traitement

`pending` → `uploading` → `analyzing` → `done` (ou `error` avec
`error_message` rempli).

LUMEN s'abonne aux changements via Supabase Realtime pour notifier la UI.
