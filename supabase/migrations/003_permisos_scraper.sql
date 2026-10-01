-- El proyecto tiene desactivado "Automatically expose new tables", así que ni siquiera
-- la service_role (la clave del scraper) recibe permisos sobre las tablas nuevas.
-- RLS no le afecta (se la salta), pero sin GRANT Postgres la para antes.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.events to service_role;
grant select, insert, update on public.scrape_runs to service_role;
grant usage, select on all sequences in schema public to service_role;
