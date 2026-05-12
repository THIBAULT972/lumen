-- LUMEN — fix permissions (run once after schema.sql).
-- Required because we disabled "Automatically expose new tables" in the
-- Supabase project settings. Without these grants the Data API (PostgREST)
-- returns "permission denied for table ..." for every query.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;

grant all on all sequences in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

notify pgrst, 'reload schema';
