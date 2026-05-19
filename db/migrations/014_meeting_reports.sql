-- LUMEN — Migration 014
-- Stockage des comptes-rendus de réunion.
--
-- Source possible : texte collé (Gemini résume directement) OU audio uploadé
-- (Gemini File API + analyse audio, traité par une Edge Function Supabase
-- pour ne pas dépendre du timeout Vercel).
--
-- Workflow status :
--   text  : pending → analyzing → done|error
--   audio : pending → uploading → analyzing → done|error
--
-- Le résumé structuré (titre, tldr, décisions, actions, etc.) est stocké
-- en jsonb. Une colonne search_text générée permet la recherche full-text
-- via tsvector français.

begin;

-- =========================================================================
-- ENUM status
-- =========================================================================
do $$ begin
  create type meeting_report_status as enum (
    'pending',     -- créé, en attente de traitement
    'uploading',   -- audio en cours d'upload vers Gemini File API
    'analyzing',   -- Gemini analyse + résume
    'done',        -- résumé prêt, voir summary
    'error'        -- échec, voir error_message
  );
exception when duplicate_object then null; end $$;

-- =========================================================================
-- TABLE meeting_reports
-- =========================================================================
create table if not exists public.meeting_reports (
  id                       uuid primary key default gen_random_uuid(),
  created_by               uuid not null references public.profiles(id) on delete cascade,
  -- Rattachement optionnel à un projet
  project_id               uuid references public.projects(id) on delete set null,
  -- Métadonnées
  title                    text not null default 'Compte-rendu',
  source_type              text not null check (source_type in ('text', 'audio')),
  source_text              text,              -- si type='text', le texte d'entrée
  audio_storage_path       text,              -- si type='audio', le path Storage
  audio_duration_seconds   int,
  audio_size_bytes         bigint,
  -- Pipeline
  status                   meeting_report_status not null default 'pending',
  error_message            text,
  -- Résultat (structuré par le schema Zod côté serveur)
  summary                  jsonb,
  -- Recherche full-text (extrait des champs principaux du summary)
  search_text              text generated always as (
    coalesce(title, '') || ' ' ||
    coalesce(summary->>'title', '') || ' ' ||
    coalesce(summary->>'tldr', '')
  ) stored,
  -- Timestamps
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  processed_at             timestamptz
);

drop trigger if exists set_updated_at on public.meeting_reports;
create trigger set_updated_at before update on public.meeting_reports
  for each row execute function public.tg_set_updated_at();

create index if not exists meeting_reports_created_by_idx on public.meeting_reports(created_by);
create index if not exists meeting_reports_project_id_idx on public.meeting_reports(project_id);
create index if not exists meeting_reports_status_idx on public.meeting_reports(status);
create index if not exists meeting_reports_created_at_idx on public.meeting_reports(created_at desc);
-- Index GIN pour recherche full-text en français
create index if not exists meeting_reports_search_idx on public.meeting_reports
  using gin(to_tsvector('french', search_text));

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.meeting_reports enable row level security;

drop policy if exists meeting_reports_select on public.meeting_reports;
create policy meeting_reports_select on public.meeting_reports
  for select using (public.is_producteur());

drop policy if exists meeting_reports_insert on public.meeting_reports;
create policy meeting_reports_insert on public.meeting_reports
  for insert with check (
    public.is_producteur()
    and created_by = auth.uid()
  );

drop policy if exists meeting_reports_update on public.meeting_reports;
create policy meeting_reports_update on public.meeting_reports
  for update using (public.is_producteur())
  with check  (public.is_producteur());

drop policy if exists meeting_reports_delete on public.meeting_reports;
create policy meeting_reports_delete on public.meeting_reports
  for delete using (public.is_producteur());

-- =========================================================================
-- GRANTS
-- =========================================================================
grant all on public.meeting_reports to service_role;
grant select, insert, update, delete on public.meeting_reports to authenticated;

-- =========================================================================
-- REALTIME (pour la notification client quand le traitement audio est fini)
-- =========================================================================
-- Sans ça, les UPDATE de la ligne par l'Edge Function ne sont pas broadcastés
-- aux producteurs connectés. Pattern identique à la migration 008 (board).
do $$
begin
  alter publication supabase_realtime add table public.meeting_reports;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';

commit;
