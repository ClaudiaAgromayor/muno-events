-- Al desactivar "Automatically expose new tables" al crear el proyecto (a proposito,
-- por seguridad), las tablas nuevas no reciben acceso automatico para la API. RLS
-- decide QUE filas ves; esto decide si se te deja intentarlo siquiera. Sin este GRANT,
-- Postgres bloquea antes de mirar las politicas de RLS -- por eso el error era
-- "permission denied", no algo relacionado con las reglas que ya escribimos.

grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.profiles to anon;

grant select, insert, delete on public.rsvps to authenticated;
grant select on public.rsvps to anon;
