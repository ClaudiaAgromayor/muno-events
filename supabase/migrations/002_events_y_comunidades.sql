-- =====================================================================================
-- muno v2 — eventos en Supabase + comunidades
-- Se pega ENTERO en el SQL Editor de Supabase (después de supabase_schema.sql, que ya
-- está aplicado). Es idempotente: se puede volver a ejecutar sin romper nada.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1. EVENTOS
-- Antes vivían en data/processed/events.json (solo eventos futuros, y solo cambiaban al
-- redesplegar). Ahora el scraper hace upsert aquí cada pocas horas y la web lee en
-- directo. Los eventos pasados NO se borran: hacen falta para "quién fue" y las fotos.
-- -------------------------------------------------------------------------------------
create table if not exists public.events (
  id               text primary key,             -- "luma:evt-xxx", "meetup:123", "user:<uuid>"
  city             text not null default 'madrid',
  source           text not null check (source in ('luma','meetup','eventbrite','user','web')),
  source_id        text not null,
  url              text,                          -- link para apuntarse en la plataforma original
  also_on          jsonb not null default '[]',   -- [{source, url}] si el mismo evento está en varias

  title            text not null,
  description      text,
  image_url        text,
  organizer        text,
  organizer_url    text,

  kind             text not null default 'meetup'
                   check (kind in ('meetup','conferencia','hackathon','networking','workshop','charla','otro')),
  topics           text[] not null default '{}',  -- ['ia','data','cloud','startups', ...]

  start_at         timestamptz not null,
  end_at           timestamptz,
  is_online        boolean not null default false,
  venue_name       text,
  address          text,
  lat              double precision,
  lng              double precision,

  is_free          boolean,
  price_min        numeric,
  currency         text,

  -- Estado de plazas normalizado entre plataformas (lo que se enseña en la web):
  --   open      → hay plazas
  --   few_left  → quedan pocas (<15% o <10 plazas)
  --   waitlist  → lleno pero puedes apuntarte a la lista de espera
  --   sold_out  → lleno y sin lista de espera
  --   closed    → inscripción cerrada (por fecha o por el organizador)
  --   cancelled → cancelado
  --   unknown   → la fuente no lo dice
  status           text not null default 'unknown'
                   check (status in ('open','few_left','waitlist','sold_out','closed','cancelled','unknown')),
  capacity         integer,
  going_count      integer,
  waitlist_count   integer,

  language         text,                          -- 'es' | 'en' | null
  tech_score       real,                          -- 0..1, cuánto de tech es (clasificador)
  hidden           boolean not null default false,-- ocultar a mano sin borrar
  featured         boolean not null default false,

  submitted_by     uuid references public.profiles(id) on delete set null,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists events_city_start_idx on public.events (city, start_at);
create index if not exists events_start_idx on public.events (start_at);

alter table public.events enable row level security;

drop policy if exists "Eventos visibles para todos" on public.events;
create policy "Eventos visibles para todos" on public.events
  for select using (hidden = false);

-- Los usuarios logueados pueden añadir eventos a mano (source='user'), siempre a su nombre.
-- Los del scraper entran con la service_role key, que se salta RLS.
drop policy if exists "Usuarios añaden eventos" on public.events;
create policy "Usuarios añaden eventos" on public.events
  for insert with check (source = 'user' and submitted_by = auth.uid());

drop policy if exists "Quien lo añadió lo edita" on public.events;
create policy "Quien lo añadió lo edita" on public.events
  for update using (source = 'user' and submitted_by = auth.uid());

grant select on public.events to anon, authenticated;
grant insert, update on public.events to authenticated;

-- -------------------------------------------------------------------------------------
-- 2. EJECUCIONES DEL SCRAPER (para saber de verdad si algo falla)
-- -------------------------------------------------------------------------------------
create table if not exists public.scrape_runs (
  id          bigint generated always as identity primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  stats       jsonb not null default '{}',   -- {"luma": {"found": 80, "kept": 52, "error": null}, ...}
  ok          boolean
);
alter table public.scrape_runs enable row level security;
drop policy if exists "Runs visibles" on public.scrape_runs;
create policy "Runs visibles" on public.scrape_runs for select using (true);
grant select on public.scrape_runs to anon, authenticated;

-- -------------------------------------------------------------------------------------
-- 3. PERFILES: avatar y titular, y soporte para Google / LinkedIn / email además de GitHub
-- -------------------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists headline text;   -- "ML Engineer @ X"
alter table public.profiles add column if not exists github_user text;

create or replace function public.handle_new_user()
returns trigger as $$
declare
  m jsonb := new.raw_user_meta_data;
begin
  insert into public.profiles (id, display_name, avatar_url, github_user)
  values (
    new.id,
    coalesce(m->>'full_name', m->>'name', m->>'user_name', split_part(new.email, '@', 1), 'Alguien'),
    coalesce(m->>'avatar_url', m->>'picture'),
    case when new.raw_app_meta_data->>'provider' = 'github' then m->>'user_name' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- -------------------------------------------------------------------------------------
-- 4. COMUNIDADES (antes "grupos"): ahora pueden ser públicas o privadas, con descripción
--    y un emoji. Las privadas siguen funcionando igual que antes (link de invitación).
-- -------------------------------------------------------------------------------------
alter table public.groups add column if not exists description text;
alter table public.groups add column if not exists emoji text default '🚀';
alter table public.groups add column if not exists is_public boolean not null default false;

-- Las comunidades públicas se ven sin ser miembro (para poder descubrirlas y unirse).
drop policy if exists "Comunidades públicas visibles" on public.groups;
create policy "Comunidades públicas visibles" on public.groups
  for select using (is_public = true);
grant select on public.groups to anon;

-- El dueño puede editar su comunidad.
drop policy if exists "El dueño edita su comunidad" on public.groups;
create policy "El dueño edita su comunidad" on public.groups
  for update using (auth.uid() = owner_id);
grant update on public.groups to authenticated;

-- Unirse a una comunidad pública sin link de invitación.
create or replace function public.join_public_group(p_group_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.groups where id = p_group_id and is_public) then
    raise exception 'Esta comunidad no es pública';
  end if;
  insert into public.group_members (group_id, user_id) values (p_group_id, auth.uid())
  on conflict do nothing;
end;
$$;
grant execute on function public.join_public_group(uuid) to authenticated;

-- Salir de una comunidad.
drop policy if exists "Sales de tus comunidades" on public.group_members;
create policy "Sales de tus comunidades" on public.group_members
  for delete using (auth.uid() = user_id);
grant delete on public.group_members to authenticated;

-- Número de miembros (visible aunque no seas miembro, sin exponer quién).
create or replace function public.group_member_count(p_group_id uuid)
returns integer
language sql security definer set search_path = public stable
as $$ select count(*)::int from public.group_members where group_id = p_group_id; $$;
grant execute on function public.group_member_count(uuid) to anon, authenticated;

-- -------------------------------------------------------------------------------------
-- 5. RSVP: "voy" / "me interesa", y confirmar que fuiste
-- -------------------------------------------------------------------------------------
alter table public.rsvps add column if not exists status text not null default 'going';
alter table public.rsvps drop constraint if exists rsvps_status_check;
alter table public.rsvps add constraint rsvps_status_check check (status in ('going','interested'));

drop policy if exists "Cada usuario cambia su propio voy" on public.rsvps;
create policy "Cada usuario cambia su propio voy" on public.rsvps
  for update using (auth.uid() = user_id);
grant update on public.rsvps to authenticated;

-- -------------------------------------------------------------------------------------
-- 6. Contadores por evento en una sola consulta (para pintar la lista rápido)
-- -------------------------------------------------------------------------------------
create or replace view public.event_rsvp_counts
with (security_invoker = true) as
  select event_id,
         count(*) filter (where status = 'going')      as going,
         count(*) filter (where status = 'interested') as interested
  from public.rsvps
  group by event_id;
grant select on public.event_rsvp_counts to anon, authenticated;

-- Fotos: además de las de posts privados, permitir marcar una foto como pública del evento.
alter table public.posts add column if not exists is_public boolean not null default false;
drop policy if exists "Fotos públicas visibles" on public.posts;
create policy "Fotos públicas visibles" on public.posts for select using (is_public = true);
grant select on public.posts to anon;

drop policy if exists "Archivos de fotos públicas visibles" on storage.objects;
create policy "Archivos de fotos públicas visibles" on storage.objects for select
  using (
    bucket_id = 'event-posts'
    and exists (select 1 from public.posts p where p.storage_path = storage.objects.name and p.is_public)
  );
