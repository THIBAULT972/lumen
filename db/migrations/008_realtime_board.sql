-- LUMEN — Migration 008
-- Active la replication Postgres pour Supabase Realtime sur les tables
-- du moodboard. Sans ça, les events INSERT/UPDATE/DELETE ne sont pas
-- broadcastés aux clients connectés.

begin;

-- board_items : déplacements, ajouts, suppressions, édits de contenu
alter publication supabase_realtime add table public.board_items;

-- board_connections : pour la phase C (flèches) à venir
alter publication supabase_realtime add table public.board_connections;

-- (boards lui-même est stable, pas besoin de Realtime dessus pour l'instant)

commit;
