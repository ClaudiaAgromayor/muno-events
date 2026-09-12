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
create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
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
