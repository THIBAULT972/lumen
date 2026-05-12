-- LUMEN — Migration 003
-- Enrichissement des épisodes : statut workflow, format, infos de prod,
-- lieu, intervenants, équipement, plateforme, heure, durée.

begin;

-- =========================================================================
-- ENUM episode_status
-- =========================================================================
do $$ begin
  create type episode_status as enum (
    'idea',        -- idée à creuser
    'planning',    -- en préparation (brief, repérage, casting)
    'shooting',    -- en tournage (jour J)
    'editing',     -- en montage
    'delivered',   -- livré au client / prêt à publier
    'published'    -- publié sur la plateforme
  );
exception when duplicate_object then null; end $$;

-- =========================================================================
-- NEW COLUMNS on public.episodes
-- =========================================================================
alter table public.episodes
  add column if not exists status               episode_status not null default 'idea',
  add column if not exists format               text,
  add column if not exists production_time      time,
  add column if not exists duration_minutes     int,
  add column if not exists location             text,
  add column if not exists location_lat         numeric(9,6),
  add column if not exists location_lng         numeric(9,6),
  add column if not exists guests               jsonb not null default '[]'::jsonb,
  add column if not exists notes                text,
  add column if not exists equipment            jsonb not null default '[]'::jsonb,
  add column if not exists platform             text;

comment on column public.episodes.status           is 'Workflow étape: idea → planning → shooting → editing → delivered → published';
comment on column public.episodes.format           is 'Format/type : Reportage, Interview, Capsule, etc. (texte libre)';
comment on column public.episodes.production_time  is 'Heure de début de tournage (heure locale Martinique)';
comment on column public.episodes.duration_minutes is 'Durée prévue du tournage en minutes';
comment on column public.episodes.guests           is 'Liste d''intervenants (jsonb array of strings)';
comment on column public.episodes.equipment        is 'Liste équipement requis (jsonb array of strings)';
comment on column public.episodes.platform         is 'Plateforme de diffusion : YouTube, Instagram, TF1, …';

create index if not exists episodes_status_idx on public.episodes(status);

-- =========================================================================
-- Refresh PostgREST cache so new columns are visible immediately.
-- =========================================================================
notify pgrst, 'reload schema';

commit;
