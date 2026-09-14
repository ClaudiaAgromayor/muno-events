-- Perfiles: uno por usuario, creado automaticamente al registrarse.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  show_name boolean not null default false,
  linkedin_url text,
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
-- (ej. "luma:evt-xxx"). user_id referencia profiles(id), no auth.users(id): asi
-- Supabase puede resolver el join "rsvps -> profiles" para traer el nombre en la misma
-- consulta (profiles.id ya esta enlazado con auth.users, la integridad no se pierde).
--
-- event_name/event_start_at/event_address/event_url son una COPIA de los datos del
-- evento en el momento de marcar "voy" -- el pipeline de scraping solo guarda eventos
-- futuros, asi que en cuanto un evento pasa desaparece de data/processed/events.json.
-- Sin esta copia, "Mis eventos" no podria mostrar nada de los eventos pasados a los
-- que fuiste, porque ya no quedaria ningun rastro de como se llamaban.
create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_name text,
  event_start_at text,
  event_address text,
  event_url text,
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

-- "¿Con quien coincidiste?" despues del evento. Si A marca que coincidio con B, y B
-- tambien marca que coincidio con A, hay match mutuo y ambos ven el contacto del otro.
-- No se revela el gesto de una sola persona como si fuera un match hasta que las dos
-- partes lo confirmen -- evita presion o incomodidad si solo una quiere conectar.
create table public.connections (
  event_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  other_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id, other_user_id),
  check (user_id <> other_user_id)
);

alter table public.connections enable row level security;

-- Ves las filas donde participas (las que tu marcaste, y las que otros marcaron sobre
-- ti) -- asi el frontend puede calcular si hay match mutuo sin exponer nada mas.
create policy "Ves las conexiones donde participas" on public.connections
  for select using (auth.uid() = user_id or auth.uid() = other_user_id);

create policy "Marcas tus propias conexiones" on public.connections
  for insert with check (auth.uid() = user_id);

create policy "Borras tus propias conexiones" on public.connections
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.connections to authenticated;

-- Fotos, notas, documentos y enlaces de video que la gente comparte de un evento
-- despues de que pase. Solo lo ven quienes tambien marcaron "voy" a ese mismo evento
-- (no es publico para cualquiera, es un recuerdo compartido entre quienes fueron).
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('nota', 'foto', 'documento', 'video')),
  text_content text,
  storage_path text,
  created_at timestamptz not null default now(),
  check (text_content is not null or storage_path is not null)
);

alter table public.posts enable row level security;

create policy "Ves publicaciones de eventos a los que fuiste" on public.posts
  for select using (
    exists (select 1 from public.rsvps r where r.event_id = posts.event_id and r.user_id = auth.uid())
  );

create policy "Publicas en eventos a los que fuiste" on public.posts
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.rsvps r where r.event_id = posts.event_id and r.user_id = auth.uid())
  );

create policy "Borras tus propias publicaciones" on public.posts
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.posts to authenticated;

-- Bucket de almacenamiento privado para las fotos/documentos/videos de arriba (las
-- notas de solo texto no necesitan archivo). Los objetos se guardan con la ruta
-- "<event_id>/<user_id>/<nombre-archivo>" para que las politicas de abajo puedan
-- comprobar el event_id sin tocar la tabla posts.
insert into storage.buckets (id, name, public)
values ('event-posts', 'event-posts', false)
on conflict (id) do nothing;

create policy "Ves archivos de eventos a los que fuiste"
  on storage.objects for select
  using (
    bucket_id = 'event-posts'
    and exists (
      select 1 from public.rsvps r
      where r.event_id = (storage.foldername(name))[1] and r.user_id = auth.uid()
    )
  );

create policy "Subes archivos a eventos a los que fuiste"
  on storage.objects for insert
  with check (
    bucket_id = 'event-posts'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.rsvps r
      where r.event_id = (storage.foldername(name))[1] and r.user_id = auth.uid()
    )
  );

create policy "Borras tus propios archivos"
  on storage.objects for delete
  using (bucket_id = 'event-posts' and (storage.foldername(name))[2] = auth.uid()::text);
