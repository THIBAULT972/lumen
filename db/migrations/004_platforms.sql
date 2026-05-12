-- LUMEN — Migration 004
-- Plateformes de diffusion : référentiel global + multi-select par épisode.

begin;

-- =========================================================================
-- TABLE platforms (référentiel CRUDable par producteur)
-- =========================================================================
create table if not exists public.platforms (
  id         uuid primary key default gen_random_uuid(),
  name       citext not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

alter table public.platforms enable row level security;

drop policy if exists platforms_select_all on public.platforms;
create policy platforms_select_all on public.platforms
  for select using (auth.uid() is not null);

drop policy if exists platforms_write_producteur on public.platforms;
create policy platforms_write_producteur on public.platforms
  for all using (public.is_producteur())
  with check  (public.is_producteur());

grant select on public.platforms to authenticated;
grant all on public.platforms to service_role;

-- =========================================================================
-- episodes.platforms (jsonb array of names) — multi
-- =========================================================================
alter table public.episodes
  add column if not exists platforms jsonb not null default '[]'::jsonb;

-- Backfill: si la vieille colonne `platform` avait une valeur, on la copie.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'episodes'
       and column_name = 'platform'
  ) then
    update public.episodes
       set platforms = jsonb_build_array(platform)
     where platform is not null and platform <> ''
       and platforms = '[]'::jsonb;
  end if;
end $$;

-- On garde la vieille colonne `platform` pour l'instant (rollback safe).
-- Si tout marche bien et qu'on en est certain, on pourra
-- `alter table public.episodes drop column if exists platform;`

-- =========================================================================
-- SEED — plateformes par défaut
-- =========================================================================
insert into public.platforms (name) values
  ('YouTube'),
  ('Instagram'),
  ('TikTok'),
  ('Facebook'),
  ('X (Twitter)'),
  ('LinkedIn'),
  ('Snapchat'),
  ('Twitch'),
  ('Vimeo'),
  ('Dailymotion'),
  ('Spotify'),
  ('Apple Podcasts'),
  ('TF1'),
  ('France 2'),
  ('France 3'),
  ('France 4'),
  ('France 5'),
  ('Arte'),
  ('Canal+'),
  ('M6'),
  ('W9'),
  ('TMC'),
  ('Site web client'),
  ('Newsletter')
on conflict (name) do nothing;

notify pgrst, 'reload schema';

commit;
