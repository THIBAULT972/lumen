-- LUMEN — Migration 006
-- Création du bucket Supabase Storage pour les fichiers attachés
-- (scripts, briefs PDF/Word, rushs vidéo, etc.)

begin;

-- Bucket privé. Tout passe par signed URLs côté server actions, donc
-- pas besoin de policies storage.objects custom (service_role bypass).
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 524288000)   -- 500 MB par fichier
on conflict (id) do nothing;

commit;
