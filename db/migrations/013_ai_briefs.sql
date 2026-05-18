-- LUMEN — Migration 013
-- Stocke les briefs structurés générés par l'IA (Gemini) lors de la création
-- d'un projet via le wizard "Créer avec l'IA". Ces briefs sont riches :
-- target audience, ton éditorial, moodboard prompts pour le projet ; script
-- (hook/sections/CTA), shot list, prompts d'images pour les épisodes.
--
-- Stockés en jsonb pour évoluer librement le schéma côté UI sans migration.
-- L'UI les affiche en lecture seule pour le moment (post-MVP : éditer + chat
-- continu avec l'IA pour itérer dessus).

begin;

alter table public.projects
  add column if not exists ai_brief jsonb;

alter table public.episodes
  add column if not exists ai_brief jsonb;

comment on column public.projects.ai_brief is
  'Brief IA du projet : target_audience, tone, moodboard_prompts, production_tips, inspiration_references, etc.';
comment on column public.episodes.ai_brief is
  'Brief IA de l''émission : script structuré (hook/sections/cta), shot list, visual_prompts, location_suggestion, guests_suggestion, etc.';

notify pgrst, 'reload schema';

commit;
