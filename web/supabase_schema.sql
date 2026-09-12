-- Perfiles: uno por usuario, creado automaticamente al registrarse.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  show_name boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- El nombre solo es visible si el propio usuario decidio mostrarlo (show_name = true),
-- o si es tu propio perfil (para que tu mismo veas tu nombre en tu ajustes aunque este
-- oculto para los demas). Esto se aplica a nivel de base de datos, no solo en la web --
-- asi una consulta directa a Supabase con la key publica tampoco puede saltarselo.
create policy "Perfiles visibles solo si show_name o es el propio" on public.profiles
  for select using (show_name = true or auth.uid() = id);

create policy "Cada usuario edita su propio perfil" on public.profiles
  for update using (auth.uid() = id);

-- Crea el perfil automaticamente cuando alguien se registra con GitHub, usando su
-- nombre de usuario de GitHub como nombre por defecto (con show_name en false: el
-- usuario decide activarlo, no viene activado de fabrica).
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'full_name', 'Alguien'));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Quien marca "voy" a un evento. event_id es el id que ya usamos en el pipeline
-- (ej. "luma:evt-xxx"), no hace falta duplicar los datos del evento aqui.
-- user_id referencia profiles(id), no auth.users(id): asi Supabase puede resolver el
-- join "rsvps -> profiles" para traer el nombre en la misma consulta (profiles.id ya
-- esta enlazado con auth.users, asi que la cadena de integridad no se pierde).
create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

alter table public.rsvps enable row level security;

-- El "voy" en si (event_id + user_id) es visible para cualquiera -- hace falta para
-- contar asistentes y para el matching futuro. Lo que protege la privacidad es la
-- politica de "profiles" de arriba: veras que alguien va, pero su nombre solo si
-- esa persona activo show_name.
create policy "Cualquiera puede ver quien marco voy" on public.rsvps
  for select using (true);

create policy "Cada usuario marca su propio voy" on public.rsvps
  for insert with check (auth.uid() = user_id);

create policy "Cada usuario quita su propio voy" on public.rsvps
  for delete using (auth.uid() = user_id);

-- Con "Automatically expose new tables" desactivado en el proyecto (a proposito, por
-- seguridad), las tablas nuevas no reciben acceso de API por defecto. RLS decide QUE
-- filas ves; esto decide si se te deja intentarlo siquiera -- sin este GRANT, Postgres
-- bloquea con "permission denied" antes de mirar las politicas de arriba.
grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.profiles to anon;

grant select, insert, delete on public.rsvps to authenticated;
grant select on public.rsvps to anon;
