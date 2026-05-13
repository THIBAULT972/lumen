-- LUMEN — Migration 007
-- Moodboards (espace de création style Milanote) : 1 board par projet,
-- avec des items repositionnables (notes, images, liens). La table
-- board_connections est pré-créée pour la phase C (flèches entre cartes).

begin;

-- =========================================================================
-- BOARD : 1 par projet (créé lazy à la 1re ouverture)
-- =========================================================================
create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null unique references public.projects(id) on delete cascade,
  name        text not null default 'Moodboard',
  background  text,  -- couleur ou pattern de fond (libre, optionnel)
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.boards;
create trigger set_updated_at before update on public.boards
  for each row execute function public.tg_set_updated_at();

create index if not exists boards_project_id_idx on public.boards(project_id);

-- =========================================================================
-- BOARD ITEMS : note / image / link, position absolue dans le canvas
-- =========================================================================
do $$ begin
  create type board_item_type as enum ('note', 'image', 'link');
exception when duplicate_object then null; end $$;

create table if not exists public.board_items (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards(id) on delete cascade,
  type        board_item_type not null,
  content     jsonb not null default '{}'::jsonb,
  position_x  int not null default 0,
  position_y  int not null default 0,
  width       int not null default 240,
  height      int not null default 160,
  z_index     int not null default 0,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.board_items;
create trigger set_updated_at before update on public.board_items
  for each row execute function public.tg_set_updated_at();

create index if not exists board_items_board_id_idx on public.board_items(board_id);

-- =========================================================================
-- BOARD CONNECTIONS (flèches) — phase C, table pré-créée pour ne pas
-- avoir à refaire une migration plus tard
-- =========================================================================
create table if not exists public.board_connections (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.boards(id) on delete cascade,
  from_item_id uuid not null references public.board_items(id) on delete cascade,
  to_item_id   uuid not null references public.board_items(id) on delete cascade,
  label        text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  check (from_item_id <> to_item_id)
);

create index if not exists board_connections_board_id_idx on public.board_connections(board_id);

-- =========================================================================
-- RLS — alignée sur project_producteurs (les boards suivent le projet)
-- =========================================================================
alter table public.boards            enable row level security;
alter table public.board_items       enable row level security;
alter table public.board_connections enable row level security;

drop policy if exists boards_select on public.boards;
create policy boards_select on public.boards
  for select using (public.is_project_producteur(project_id));

drop policy if exists boards_write on public.boards;
create policy boards_write on public.boards
  for all using (public.is_project_producteur(project_id))
  with check  (public.is_project_producteur(project_id));

drop policy if exists items_select on public.board_items;
create policy items_select on public.board_items
  for select using (
    exists (
      select 1 from public.boards b
      where b.id = board_items.board_id
        and public.is_project_producteur(b.project_id)
    )
  );

drop policy if exists items_write on public.board_items;
create policy items_write on public.board_items
  for all using (
    exists (
      select 1 from public.boards b
      where b.id = board_items.board_id
        and public.is_project_producteur(b.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.boards b
      where b.id = board_items.board_id
        and public.is_project_producteur(b.project_id)
    )
  );

drop policy if exists connections_select on public.board_connections;
create policy connections_select on public.board_connections
  for select using (
    exists (
      select 1 from public.boards b
      where b.id = board_connections.board_id
        and public.is_project_producteur(b.project_id)
    )
  );

drop policy if exists connections_write on public.board_connections;
create policy connections_write on public.board_connections
  for all using (
    exists (
      select 1 from public.boards b
      where b.id = board_connections.board_id
        and public.is_project_producteur(b.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.boards b
      where b.id = board_connections.board_id
        and public.is_project_producteur(b.project_id)
    )
  );

-- =========================================================================
-- GRANTS
-- =========================================================================
grant all on public.boards            to service_role;
grant all on public.board_items       to service_role;
grant all on public.board_connections to service_role;
grant select, insert, update, delete on public.boards            to authenticated;
grant select, insert, update, delete on public.board_items       to authenticated;
grant select, insert, update, delete on public.board_connections to authenticated;

notify pgrst, 'reload schema';

commit;
