-- LUMEN — Migration 009
-- Ajout du type "todo" (checklist) aux cartes du moodboard.
--
-- ⚠ ALTER TYPE ADD VALUE doit s'exécuter HORS transaction (limitation Postgres).
-- Donc pas de begin/commit ici — Supabase SQL Editor exécute la commande seule.

alter type board_item_type add value if not exists 'todo';

notify pgrst, 'reload schema';
