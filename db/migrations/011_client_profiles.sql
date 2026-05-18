-- LUMEN — Migration 011
-- Infos étendues côté client : raison sociale, adresse de facturation,
-- numéro TVA intra, etc. Suit le pattern `prestataire_profiles` : table
-- séparée pour ne pas polluer `profiles`.
--
-- Sert principalement à enrichir le bloc « Client » sur les factures PDF.

begin;

-- =========================================================================
-- CLIENT PROFILES
-- =========================================================================
create table if not exists public.client_profiles (
  id              uuid primary key references public.profiles(id) on delete cascade,
  -- Identité commerciale
  company_name    text,          -- raison sociale (si entreprise), sinon null
  legal_form      text,          -- SAS, SARL, EI, association, particulier…
  -- Adresse de facturation
  address_line1   text,
  address_line2   text,
  postal_code     text,
  city            text,
  country         text default 'France',
  -- Identifiants entreprise (facultatifs)
  siret           text,
  vat_number      text,          -- TVA intra (ex: FR12345678901)
  -- Contact
  phone           text,
  contact_name    text,          -- interlocuteur principal côté client
  -- Divers
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.client_profiles;
create trigger set_updated_at before update on public.client_profiles
  for each row execute function public.tg_set_updated_at();

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.client_profiles enable row level security;

-- SELECT : le client voit son propre profil, les producteurs voient tout.
drop policy if exists client_profiles_select on public.client_profiles;
create policy client_profiles_select on public.client_profiles
  for select using (
    public.is_producteur()
    or id = auth.uid()
  );

-- INSERT/UPDATE/DELETE : producteurs uniquement.
drop policy if exists client_profiles_write on public.client_profiles;
create policy client_profiles_write on public.client_profiles
  for all using (public.is_producteur())
  with check  (public.is_producteur());

-- =========================================================================
-- GRANTS
-- =========================================================================
grant all on public.client_profiles to service_role;
grant select, insert, update, delete on public.client_profiles to authenticated;

notify pgrst, 'reload schema';

commit;
