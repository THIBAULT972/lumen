-- LUMEN — Migration 002
-- Multi-producteurs par projet. Un projet n'apparait que dans le hub des
-- producteurs explicitement assignés.

begin;

-- =========================================================================
-- TABLE
-- =========================================================================
create table if not exists public.project_producteurs (
  project_id uuid not null references public.projects(id)  on delete cascade,
  user_id    uuid not null references public.profiles(id)  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists pp_user_id_idx     on public.project_producteurs(user_id);
create index if not exists pp_project_id_idx  on public.project_producteurs(project_id);

alter table public.project_producteurs enable row level security;

-- =========================================================================
-- HELPERS
-- =========================================================================
create or replace function public.is_project_producteur(p_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_producteurs
    where project_id = p_id and user_id = auth.uid()
  );
$$;

-- =========================================================================
-- BACKFILL: tout projet existant est assigné à TOUS les producteurs actuels
-- (sinon ils deviendraient invisibles d'un coup après cette migration).
-- =========================================================================
insert into public.project_producteurs (project_id, user_id)
select p.id, prof.id
from public.projects p
cross join public.profiles prof
where prof.role = 'producteur'
on conflict do nothing;

-- =========================================================================
-- RLS — projects
-- =========================================================================
drop policy if exists projects_select_role_scoped on public.projects;
create policy projects_select_role_scoped on public.projects
  for select using (
    public.is_project_producteur(id)
    or client_id = auth.uid()
  );

drop policy if exists projects_write_producteur on public.projects;

-- Insert: tout producteur peut créer (il s'assignera juste après dans pp).
drop policy if exists projects_insert_producteur on public.projects;
create policy projects_insert_producteur on public.projects
  for insert with check (public.is_producteur());

drop policy if exists projects_update_assigned on public.projects;
create policy projects_update_assigned on public.projects
  for update using (public.is_project_producteur(id))
  with check  (public.is_project_producteur(id));

drop policy if exists projects_delete_assigned on public.projects;
create policy projects_delete_assigned on public.projects
  for delete using (public.is_project_producteur(id));

-- =========================================================================
-- RLS — project_producteurs
-- =========================================================================
drop policy if exists pp_select on public.project_producteurs;
create policy pp_select on public.project_producteurs
  for select using (
    user_id = auth.uid()
    or public.is_project_producteur(project_id)
  );

-- Insert: tout producteur peut s'ajouter ou ajouter quelqu'un à un projet qu'il gère
-- déjà OU à un projet qu'il vient de créer (case in `with check` checks the new row).
drop policy if exists pp_insert on public.project_producteurs;
create policy pp_insert on public.project_producteurs
  for insert with check (
    public.is_producteur()
    and (
      public.is_project_producteur(project_id)
      or not exists (
        select 1 from public.project_producteurs
        where project_id = project_producteurs.project_id
      )
    )
  );

drop policy if exists pp_delete on public.project_producteurs;
create policy pp_delete on public.project_producteurs
  for delete using (public.is_project_producteur(project_id));

-- =========================================================================
-- RLS — episodes (cascade par projet)
-- =========================================================================
drop policy if exists episodes_select_role_scoped on public.episodes;
create policy episodes_select_role_scoped on public.episodes
  for select using (
    public.is_project_producteur(project_id)
    or exists (
      select 1 from public.projects p
      where p.id = episodes.project_id and p.client_id = auth.uid()
    )
  );

drop policy if exists episodes_write_producteur on public.episodes;
create policy episodes_write_assigned on public.episodes
  for all using (public.is_project_producteur(project_id))
  with check  (public.is_project_producteur(project_id));

-- =========================================================================
-- RLS — text_documents (suit les épisodes)
-- =========================================================================
drop policy if exists td_select_producteur_or_assigned on public.text_documents;
create policy td_select_role_scoped on public.text_documents
  for select using (
    exists (
      select 1 from public.episodes ep
      where ep.id = text_documents.episode_id
        and public.is_project_producteur(ep.project_id)
    )
    or exists (
      select 1 from public.missions m
      where m.episode_id = text_documents.episode_id
        and m.accepted_by = auth.uid()
    )
  );

drop policy if exists td_write_producteur on public.text_documents;
create policy td_write_assigned on public.text_documents
  for all using (
    exists (
      select 1 from public.episodes ep
      where ep.id = text_documents.episode_id
        and public.is_project_producteur(ep.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.episodes ep
      where ep.id = text_documents.episode_id
        and public.is_project_producteur(ep.project_id)
    )
  );

-- =========================================================================
-- GRANTS pour la nouvelle table (Data API access)
-- =========================================================================
grant all    on public.project_producteurs to service_role;
grant select, insert, update, delete on public.project_producteurs to authenticated;

notify pgrst, 'reload schema';

commit;
