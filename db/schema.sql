-- LUMEN — Initial schema
-- Run this in the Supabase SQL Editor (one-shot).
-- Idempotent where possible: safe to re-run.

-- =========================================================================
-- EXTENSIONS
-- =========================================================================
create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "citext";   -- case-insensitive text for emails

-- =========================================================================
-- ENUMS
-- =========================================================================
do $$ begin
  create type user_role as enum ('producteur', 'prestataire', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mission_status as enum (
    'draft',         -- created by producteur, not yet broadcast
    'broadcast',     -- sent to all matching prestataires, awaiting accept
    'accepted',      -- one prestataire accepted, locked
    'in_progress',   -- happening now (after scheduled_at)
    'completed',     -- done
    'cancelled'      -- cancelled by producteur OR after cancellation by prestataire
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type file_target as enum (
    'project',        -- attached to a project (visible to producteurs only)
    'episode',        -- attached to an episode
    'mission',        -- attached to a mission (rushes uploaded by prestataire)
    'hub_client',     -- delivered to a client hub
    'hub_prestataire' -- shared to a specific prestataire (briefs, docs)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum (
    'mission_broadcast',
    'mission_accepted',
    'mission_cancelled',
    'mission_reminder',
    'file_uploaded',
    'project_assigned',
    'system'
  );
exception when duplicate_object then null; end $$;

-- =========================================================================
-- TABLES
-- =========================================================================

-- Profile — extends auth.users, one row per user.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null,
  email       citext not null unique,
  first_name  text,
  last_name   text,
  avatar_url  text,
  -- 1-month penalty if a prestataire backs out after accepting a mission
  banned_until timestamptz,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.profiles.banned_until is
  'Used to enforce 1-month penalty when a prestataire cancels after accepting. While now() < banned_until, they receive no new broadcasts.';

-- Sensitive personal data, stricter access.
create table if not exists public.prestataire_profiles (
  user_id                  uuid primary key references public.profiles(id) on delete cascade,
  phone                    text,
  address                  text,
  emergency_contact_name   text,
  emergency_contact_phone  text,
  iban                     text,
  bic                      text,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Skills are CRUDable by producteurs.
create table if not exists public.skills (
  id         uuid primary key default gen_random_uuid(),
  name       citext not null unique,
  created_at timestamptz not null default now()
);

-- Many-to-many: prestataire <-> skills.
create table if not exists public.user_skills (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  skill_id   uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

-- A project = a client dossier (e.g. "Histwa").
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  client_id   uuid references public.profiles(id) on delete set null,
  description text,
  archived_at timestamptz,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- An episode = one shootable contenu inside a project.
create table if not exists public.episodes (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  name             text not null,
  description      text,
  order_index      int not null default 0,
  production_date  timestamptz,
  publication_date timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists episodes_project_id_idx on public.episodes(project_id);
create index if not exists episodes_production_date_idx on public.episodes(production_date);
create index if not exists episodes_publication_date_idx on public.episodes(publication_date);

-- A mission = one chunk of work for a prestataire on an episode.
create table if not exists public.missions (
  id                  uuid primary key default gen_random_uuid(),
  episode_id          uuid not null references public.episodes(id) on delete cascade,
  required_skill_id   uuid not null references public.skills(id),
  title               text not null,
  description         text,
  location            text,
  location_lat        numeric(9,6),
  location_lng        numeric(9,6),
  scheduled_at        timestamptz not null,
  duration_minutes    int not null default 60,
  price_cents         int not null default 0,
  status              mission_status not null default 'draft',
  accepted_by         uuid references public.profiles(id),
  accepted_at         timestamptz,
  broadcast_at        timestamptz,
  cancelled_at        timestamptz,
  cancellation_reason text,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- A mission can only be accepted once
  constraint missions_accepted_consistency check (
    (accepted_by is null and accepted_at is null)
    or (accepted_by is not null and accepted_at is not null)
  )
);

create index if not exists missions_episode_id_idx on public.missions(episode_id);
create index if not exists missions_status_idx on public.missions(status);
create index if not exists missions_required_skill_idx on public.missions(required_skill_id);
create index if not exists missions_accepted_by_idx on public.missions(accepted_by);
create index if not exists missions_scheduled_at_idx on public.missions(scheduled_at);

-- Files (stored in Supabase Storage, path tracked here).
create table if not exists public.files (
  id                  uuid primary key default gen_random_uuid(),
  storage_path        text not null,           -- path in storage bucket
  filename            text not null,
  mime_type           text,
  size_bytes          bigint,
  target              file_target not null,
  project_id          uuid references public.projects(id) on delete cascade,
  episode_id          uuid references public.episodes(id) on delete cascade,
  mission_id          uuid references public.missions(id) on delete cascade,
  -- For hub_client / hub_prestataire: the user this file is intended for.
  destination_user_id uuid references public.profiles(id) on delete set null,
  uploaded_by         uuid references public.profiles(id),
  created_at          timestamptz not null default now()
);

create index if not exists files_project_id_idx on public.files(project_id);
create index if not exists files_episode_id_idx on public.files(episode_id);
create index if not exists files_mission_id_idx on public.files(mission_id);
create index if not exists files_destination_user_id_idx on public.files(destination_user_id);

-- Text documents (collab editing later — JSON content from Tiptap).
create table if not exists public.text_documents (
  id           uuid primary key default gen_random_uuid(),
  episode_id   uuid not null references public.episodes(id) on delete cascade,
  title        text not null default 'Document sans titre',
  content_json jsonb not null default '{}'::jsonb,
  created_by   uuid references public.profiles(id),
  updated_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists text_documents_episode_id_idx on public.text_documents(episode_id);

-- In-app notifications.
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       notification_type not null,
  title      text not null,
  body       text,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read_at is null;

-- =========================================================================
-- HELPER FUNCTIONS
-- =========================================================================

-- Maintain updated_at automatically.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Attach trigger to every table with an updated_at column.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'prestataire_profiles', 'projects', 'episodes',
    'missions', 'text_documents'
  ] loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I;
       create trigger set_updated_at before update on public.%I
       for each row execute function public.tg_set_updated_at();',
      t, t
    );
  end loop;
end $$;

-- Returns the role of the current auth.uid().
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- True if current user is a producteur.
create or replace function public.is_producteur()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'producteur'
  );
$$;

-- True if current user is banned (penalty active).
create or replace function public.is_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and banned_until is not null and banned_until > now()
  );
$$;

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================
-- Pattern:
--   - producteur: full access on everything
--   - prestataire: their own profile, their accepted/broadcast missions,
--                  their skills, their notifications, files they uploaded or
--                  that are addressed to them
--   - client: their projects (where they are client_id), the files in
--             their hub (destination_user_id = them)

alter table public.profiles enable row level security;
alter table public.prestataire_profiles enable row level security;
alter table public.skills enable row level security;
alter table public.user_skills enable row level security;
alter table public.projects enable row level security;
alter table public.episodes enable row level security;
alter table public.missions enable row level security;
alter table public.files enable row level security;
alter table public.text_documents enable row level security;
alter table public.notifications enable row level security;

-- --- profiles ---
drop policy if exists profiles_select_self_or_producteur on public.profiles;
create policy profiles_select_self_or_producteur on public.profiles
  for select using (
    id = auth.uid() or public.is_producteur()
  );

drop policy if exists profiles_update_self_or_producteur on public.profiles;
create policy profiles_update_self_or_producteur on public.profiles
  for update using (id = auth.uid() or public.is_producteur())
  with check  (id = auth.uid() or public.is_producteur());

drop policy if exists profiles_insert_producteur on public.profiles;
create policy profiles_insert_producteur on public.profiles
  for insert with check (public.is_producteur());

drop policy if exists profiles_delete_producteur on public.profiles;
create policy profiles_delete_producteur on public.profiles
  for delete using (public.is_producteur());

-- --- prestataire_profiles (RIB, contacts urgence — sensible) ---
drop policy if exists pp_select_self_or_producteur on public.prestataire_profiles;
create policy pp_select_self_or_producteur on public.prestataire_profiles
  for select using (user_id = auth.uid() or public.is_producteur());

drop policy if exists pp_upsert_self_or_producteur on public.prestataire_profiles;
create policy pp_upsert_self_or_producteur on public.prestataire_profiles
  for all using (user_id = auth.uid() or public.is_producteur())
  with check  (user_id = auth.uid() or public.is_producteur());

-- --- skills ---
drop policy if exists skills_select_all on public.skills;
create policy skills_select_all on public.skills
  for select using (auth.uid() is not null);

drop policy if exists skills_write_producteur on public.skills;
create policy skills_write_producteur on public.skills
  for all using (public.is_producteur()) with check (public.is_producteur());

-- --- user_skills ---
drop policy if exists us_select_self_or_producteur on public.user_skills;
create policy us_select_self_or_producteur on public.user_skills
  for select using (user_id = auth.uid() or public.is_producteur());

drop policy if exists us_write_producteur on public.user_skills;
create policy us_write_producteur on public.user_skills
  for all using (public.is_producteur()) with check (public.is_producteur());

-- --- projects ---
drop policy if exists projects_select_role_scoped on public.projects;
create policy projects_select_role_scoped on public.projects
  for select using (
    public.is_producteur()
    or client_id = auth.uid()
  );

drop policy if exists projects_write_producteur on public.projects;
create policy projects_write_producteur on public.projects
  for all using (public.is_producteur()) with check (public.is_producteur());

-- --- episodes ---
drop policy if exists episodes_select_role_scoped on public.episodes;
create policy episodes_select_role_scoped on public.episodes
  for select using (
    public.is_producteur()
    or exists (
      select 1 from public.projects p
      where p.id = episodes.project_id and p.client_id = auth.uid()
    )
  );

drop policy if exists episodes_write_producteur on public.episodes;
create policy episodes_write_producteur on public.episodes
  for all using (public.is_producteur()) with check (public.is_producteur());

-- --- missions ---
-- A prestataire sees:
--   - broadcast missions where they hold the required_skill (and not banned)
--   - any mission they accepted
drop policy if exists missions_select_role_scoped on public.missions;
create policy missions_select_role_scoped on public.missions
  for select using (
    public.is_producteur()
    or accepted_by = auth.uid()
    or (
      status = 'broadcast'
      and not public.is_banned()
      and exists (
        select 1 from public.user_skills us
        where us.user_id = auth.uid() and us.skill_id = missions.required_skill_id
      )
    )
  );

drop policy if exists missions_write_producteur on public.missions;
create policy missions_write_producteur on public.missions
  for insert with check (public.is_producteur());

drop policy if exists missions_delete_producteur on public.missions;
create policy missions_delete_producteur on public.missions
  for delete using (public.is_producteur());

-- A prestataire can update the mission ONLY to accept it or cancel their own.
-- (We will tighten this with a server-side function later — for now,
--  RLS lets them update missions they have access to, and the app layer
--  controls the allowed state transitions.)
drop policy if exists missions_update_role_scoped on public.missions;
create policy missions_update_role_scoped on public.missions
  for update using (
    public.is_producteur()
    or accepted_by = auth.uid()
    or (
      status = 'broadcast'
      and exists (
        select 1 from public.user_skills us
        where us.user_id = auth.uid() and us.skill_id = missions.required_skill_id
      )
    )
  )
  with check (
    public.is_producteur()
    or accepted_by = auth.uid()
  );

-- --- files ---
drop policy if exists files_select_role_scoped on public.files;
create policy files_select_role_scoped on public.files
  for select using (
    public.is_producteur()
    or uploaded_by = auth.uid()
    or destination_user_id = auth.uid()
    or (
      -- prestataire sees files of their accepted missions
      mission_id is not null
      and exists (
        select 1 from public.missions m
        where m.id = files.mission_id and m.accepted_by = auth.uid()
      )
    )
    or (
      -- client sees files of their projects
      project_id is not null
      and exists (
        select 1 from public.projects p
        where p.id = files.project_id and p.client_id = auth.uid()
      )
    )
  );

drop policy if exists files_insert_authed on public.files;
create policy files_insert_authed on public.files
  for insert with check (uploaded_by = auth.uid());

drop policy if exists files_delete_producteur_or_owner on public.files;
create policy files_delete_producteur_or_owner on public.files
  for delete using (public.is_producteur() or uploaded_by = auth.uid());

-- --- text_documents ---
drop policy if exists td_select_producteur_or_assigned on public.text_documents;
create policy td_select_producteur_or_assigned on public.text_documents
  for select using (
    public.is_producteur()
    or exists (
      -- prestataire of a mission attached to this episode
      select 1 from public.missions m
      where m.episode_id = text_documents.episode_id
        and m.accepted_by = auth.uid()
    )
  );

drop policy if exists td_write_producteur on public.text_documents;
create policy td_write_producteur on public.text_documents
  for all using (public.is_producteur()) with check (public.is_producteur());

-- --- notifications ---
drop policy if exists notif_select_self on public.notifications;
create policy notif_select_self on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notif_update_self on public.notifications;
create policy notif_update_self on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notif_insert_producteur on public.notifications;
create policy notif_insert_producteur on public.notifications
  for insert with check (public.is_producteur());

-- =========================================================================
-- GRANTS — expose tables to PostgREST (anon, authenticated, service_role)
-- (We disabled "Automatically expose new tables" in project settings, so
--  these grants are required to access the schema via the Data API.)
-- =========================================================================
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- anon stays denied — public traffic must never hit our tables.

grant all on all sequences in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated;

-- Apply same grants to any future tables/sequences created later.
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- Force PostgREST to reload its schema cache so the new permissions take effect.
notify pgrst, 'reload schema';

-- =========================================================================
-- SEED — default skills
-- =========================================================================
insert into public.skills (name) values
  ('Cameraman'),
  ('Droniste'),
  ('Monteur'),
  ('Photographe'),
  ('Ingénieur du son'),
  ('Éclairage'),
  ('Cadreur')
on conflict (name) do nothing;
