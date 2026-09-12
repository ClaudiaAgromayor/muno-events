-- Rellena el perfil que falta para cualquier usuario que se registrara antes de que
-- la tabla profiles existiera (el trigger solo se dispara en registros nuevos, no
-- retroactivamente).
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'user_name', u.raw_user_meta_data->>'full_name', 'Alguien')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- rsvps.user_id apuntaba a auth.users directamente, igual que profiles.id -- pero eran
-- dos referencias "hermanas" sin relacion directa entre si, y Supabase necesita una
-- relacion directa rsvps -> profiles para poder traer el nombre en la misma consulta.
alter table public.rsvps drop constraint rsvps_user_id_fkey;

alter table public.rsvps
  add constraint rsvps_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- Fuerza a que se entere del cambio ya, en vez de esperar a que lo detecte solo.
notify pgrst, 'reload schema';
