-- LUMEN — Migration 012
-- Augmente la limite de taille par fichier sur le bucket `files` à 5 GB.
-- Justification : livrables vidéo bruts (4K 60fps, masters multi-pistes) peuvent
-- dépasser 1 GB facilement. L'ancienne limite de 500 MB renvoyait un 413
-- "Payload too large" sur les uploads PUT directs.
--
-- 5 GB est la limite max pour un upload standard (PUT) chez Supabase ; au-delà
-- il faudra basculer sur les uploads resumables (TUS protocol, tus-js-client).

begin;

update storage.buckets
   set file_size_limit = 5368709120   -- 5 * 1024 * 1024 * 1024 = 5 GB
 where id = 'files';

commit;
