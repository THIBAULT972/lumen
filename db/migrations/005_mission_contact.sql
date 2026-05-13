-- LUMEN — Migration 005
-- Ajout contact_name + contact_phone sur les missions
-- (champ "Contact" demandé dans la modale de mandat : qui appeler sur place).

begin;

alter table public.missions
  add column if not exists contact_name  text,
  add column if not exists contact_phone text;

comment on column public.missions.contact_name  is 'Personne à contacter le jour du tournage (référent producteur, client, etc.)';
comment on column public.missions.contact_phone is 'Téléphone direct du contact mission (texte libre, format libre)';

notify pgrst, 'reload schema';

commit;
