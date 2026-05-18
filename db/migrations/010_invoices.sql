-- LUMEN — Migration 010
-- Module de facturation par projet client.
--   - invoices : en-tête (numéro auto unique, dates, statut, totaux, snapshots)
--   - invoice_lines : lignes de la facture (description, qté, PU, TVA)
-- RLS : producteurs assignés au projet voient tout ; client voit les factures
-- non-brouillon de SES projets.

begin;

-- =========================================================================
-- ENUM
-- =========================================================================
do $$ begin
  create type invoice_status as enum (
    'draft',     -- brouillon, invisible au client
    'sent',      -- envoyée au client (visible côté client)
    'paid',      -- payée
    'overdue',   -- en retard (set manuellement ou par cron plus tard)
    'cancelled'  -- annulée
  );
exception when duplicate_object then null; end $$;

-- =========================================================================
-- INVOICES
-- =========================================================================
create table if not exists public.invoices (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  number            text not null unique,
  status            invoice_status not null default 'draft',
  issued_at         date not null default current_date,
  due_at            date,
  paid_at           date,
  -- Snapshots: capture les infos studio + client au moment de l'émission
  -- (les changements futurs ne réécrivent pas l'historique)
  studio_snapshot   jsonb not null default '{}'::jsonb,
  client_snapshot   jsonb not null default '{}'::jsonb,
  notes             text,
  -- Totaux dérivés, recalculés à chaque save côté serveur
  total_ht_cents    int not null default 0,
  total_tva_cents   int not null default 0,
  total_ttc_cents   int not null default 0,
  currency          text not null default 'EUR',
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.invoices;
create trigger set_updated_at before update on public.invoices
  for each row execute function public.tg_set_updated_at();

create index if not exists invoices_project_id_idx on public.invoices(project_id);
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists invoices_issued_at_idx on public.invoices(issued_at);

-- =========================================================================
-- INVOICE LINES
-- =========================================================================
create table if not exists public.invoice_lines (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  description     text not null,
  quantity        numeric(10, 2) not null default 1,
  unit_price_cents int not null default 0,
  vat_rate        numeric(5, 2) not null default 0,  -- en % (ex: 20.00, 0.00)
  order_index     int not null default 0,
  total_ht_cents  int not null default 0,
  total_ttc_cents int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists invoice_lines_invoice_id_idx on public.invoice_lines(invoice_id);

-- =========================================================================
-- AUTO-NUMBERING (LUM-YYYY-NNN)
-- Génère le prochain numéro disponible pour l'année courante.
-- Utilisé via SELECT next_invoice_number() côté server action.
-- =========================================================================
create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  yr int;
  last_num int;
  next_num int;
begin
  yr := extract(year from current_date)::int;
  -- Trouve le plus grand suffixe NNN pour cette année.
  select coalesce(max(
    nullif(regexp_replace(number, '^LUM-' || yr || '-', ''), '')::int
  ), 0)
    into last_num
    from public.invoices
   where number ~ ('^LUM-' || yr || '-\d+$');
  next_num := last_num + 1;
  return 'LUM-' || yr || '-' || lpad(next_num::text, 3, '0');
end;
$$;

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.invoices       enable row level security;
alter table public.invoice_lines  enable row level security;

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select using (
    -- producteurs assignés au projet voient tout (même les drafts)
    public.is_project_producteur(project_id)
    or (
      -- client du projet voit les factures non-draft de son projet
      status <> 'draft'
      and exists (
        select 1 from public.projects p
        where p.id = invoices.project_id and p.client_id = auth.uid()
      )
    )
  );

drop policy if exists invoices_write_producteur on public.invoices;
create policy invoices_write_producteur on public.invoices
  for all using (public.is_project_producteur(project_id))
  with check  (public.is_project_producteur(project_id));

drop policy if exists invoice_lines_select on public.invoice_lines;
create policy invoice_lines_select on public.invoice_lines
  for select using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_lines.invoice_id
        and (
          public.is_project_producteur(i.project_id)
          or (
            i.status <> 'draft'
            and exists (
              select 1 from public.projects p
              where p.id = i.project_id and p.client_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists invoice_lines_write on public.invoice_lines;
create policy invoice_lines_write on public.invoice_lines
  for all using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_lines.invoice_id
        and public.is_project_producteur(i.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_lines.invoice_id
        and public.is_project_producteur(i.project_id)
    )
  );

-- =========================================================================
-- GRANTS
-- =========================================================================
grant all on public.invoices       to service_role;
grant all on public.invoice_lines  to service_role;
grant select, insert, update, delete on public.invoices      to authenticated;
grant select, insert, update, delete on public.invoice_lines to authenticated;
grant execute on function public.next_invoice_number() to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
