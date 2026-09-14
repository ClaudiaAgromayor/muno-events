"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/client";
import type { MunoEvent } from "@/app/lib/events";
import { formatEventDate, groupEventsByDay, registrationDeadlineLabel, spotsLabel, spotsUrgent } from "@/app/lib/events";
import RsvpControl, { type RsvpSummary } from "@/app/components/RsvpControl";
import { useToast } from "@/app/components/Toast";
import EventMiniMapLoader from "@/app/components/EventMiniMapLoader";
import ShareEvent from "@/app/components/ShareEvent";

type RsvpRow = {
  event_id: string;
  user_id: string;
  profiles: { display_name: string | null; show_name: boolean } | null;
};

const EMPTY_SUMMARY: RsvpSummary = { count: 0, names: [], isGoing: false, groupmates: [], knownFromBefore: [] };

type MyGroup = { id: string; name: string };

export default function EventList({ events }: { events: MunoEvent[] }) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [rsvpRows, setRsvpRows] = useState<RsvpRow[]>([]);
  const [myGroups, setMyGroups] = useState<MyGroup[]>([]);
  const [groupMates, setGroupMates] = useState<Map<string, string>>(new Map());
  const [mutualConnections, setMutualConnections] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user) {
      setMyGroups([]);
      return;
    }
    supabase
      .from("group_members")
      .select("groups(id, name)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const groups = ((data ?? []) as unknown as { groups: MyGroup | null }[])
          .map((r) => r.groups)
          .filter((g): g is MyGroup => g !== null);
        setMyGroups(groups);
      });
  }, [supabase, user]);

  useEffect(() => {
    // Companeros de grupo (de cualquiera de tus grupos, no solo uno): se usan para
    // destacar "va alguien de tu grupo" en la fila del evento. Los nombres vienen de la
    // politica "Ves nombres de miembros de tus grupos" (se ve siempre dentro del grupo,
    // aunque esa persona tenga show_name desactivado de cara al publico).
    if (!user || myGroups.length === 0) {
      setGroupMates(new Map());
      return;
    }
    supabase
      .from("group_members")
      .select("user_id, profiles(display_name)")
      .in(
        "group_id",
        myGroups.map((g) => g.id)
      )
      .then(({ data }) => {
        const map = new Map<string, string>();
        for (const row of (data ?? []) as unknown as {
          user_id: string;
          profiles: { display_name: string | null } | null;
        }[]) {
          if (row.user_id !== user.id && row.profiles?.display_name) {
            map.set(row.user_id, row.profiles.display_name);
          }
        }
        setGroupMates(map);
      });
  }, [supabase, user, myGroups]);

  useEffect(() => {
    // "Tambien va alguien con quien coincidiste antes": reutiliza el match mutuo de
    // "Mis eventos" > Pasados (las dos partes tuvieron que marcar "coincidimos" para el
    // mismo evento pasado), pero aqui cruzado contra TODOS los eventos futuros, no solo
    // aquel en el que os conocisteis. RLS de "connections" ya limita esta consulta a las
    // filas en las que participas, no hace falta filtrar por usuario aqui.
    if (!user) {
      setMutualConnections(new Set());
      return;
    }
    supabase
      .from("connections")
      .select("event_id, user_id, other_user_id")
      .then(({ data }) => {
        const rows = (data ?? []) as { event_id: string; user_id: string; other_user_id: string }[];
        const outgoingKeys = new Set(
          rows.filter((r) => r.user_id === user.id).map((r) => `${r.event_id}:${r.other_user_id}`)
        );
        const mutual = new Set<string>();
        for (const r of rows) {
          if (r.other_user_id === user.id && outgoingKeys.has(`${r.event_id}:${r.user_id}`)) {
            mutual.add(r.user_id);
          }
        }
        setMutualConnections(mutual);
      });
  }, [supabase, user]);

  const loadRsvps = useCallback(async () => {
    // profiles(display_name, show_name) es un join -- si show_name es false para esa
    // fila y no es tu propio usuario, la RLS de "profiles" hace que venga null aqui,
    // sin exponer el nombre aunque se pida explicitamente en el select.
    const { data, error } = await supabase.from("rsvps").select("event_id, user_id, profiles(display_name, show_name)");
    if (error) {
      toast.error(`Error cargando quien va: ${error.message}`);
      return;
    }
    setRsvpRows((data as unknown as RsvpRow[]) ?? []);
  }, [supabase, toast]);

  useEffect(() => {
    loadRsvps();
  }, [loadRsvps]);

  useEffect(() => {
    // Realtime: si OTRA persona marca o quita un "voy" mientras tienes la pagina
    // abierta, el contador se actualiza solo, sin que nadie tenga que recargar.
    // Hace falta tener activado Realtime para la tabla "rsvps" en Supabase (no viene
    // activado por defecto: alter publication supabase_realtime add table rsvps;).
    const channel = supabase
      .channel("rsvps-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "rsvps" }, () => {
        loadRsvps();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadRsvps]);

  const summaries = useMemo(() => {
    const map = new Map<string, RsvpSummary>();
    for (const row of rsvpRows) {
      const existing = map.get(row.event_id) ?? { count: 0, names: [], isGoing: false, groupmates: [], knownFromBefore: [] };
      existing.count += 1;
      if (row.profiles?.show_name && row.profiles.display_name) {
        existing.names.push(row.profiles.display_name);
        if (mutualConnections.has(row.user_id)) existing.knownFromBefore.push(row.profiles.display_name);
      }
      if (user && row.user_id === user.id) existing.isGoing = true;
      const groupmateName = groupMates.get(row.user_id);
      if (groupmateName) existing.groupmates.push(groupmateName);
      map.set(row.event_id, existing);
    }
    return map;
  }, [rsvpRows, user, groupMates, mutualConnections]);

  const toggleRsvp = async (event: MunoEvent, isGoing: boolean) => {
    if (!user) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) toast.error(`Error al entrar con GitHub: ${error.message}`);
      return;
    }
    // Optimista: cambia la pantalla ya, sin esperar la ida y vuelta al servidor. Si
    // falla, se revierte trayendo el estado real; si funciona, el canal de Realtime de
    // arriba acabara confirmando lo mismo (sin nombre/show_name todavia si es un alta,
    // eso llega con esa confirmacion).
    const previousRows = rsvpRows;
    setRsvpRows((prev) =>
      isGoing
        ? prev.filter((r) => !(r.event_id === event.id && r.user_id === user.id))
        : [...prev, { event_id: event.id, user_id: user.id, profiles: null }]
    );

    // Copiamos nombre/fecha/direccion/url del evento tal cual esta ahora: el pipeline
    // solo guarda eventos futuros, asi que en cuanto pase la fecha este sera el unico
    // sitio donde queda constancia de como se llamaba (ver "Mis eventos" -> Pasados).
    const { error } = isGoing
      ? await supabase.from("rsvps").delete().eq("event_id", event.id).eq("user_id", user.id)
      : await supabase.from("rsvps").insert({
          event_id: event.id,
          user_id: user.id,
          event_name: event.name,
          event_start_at: event.start_at,
          event_address: event.address,
          event_url: event.url,
        });
    if (error) {
      setRsvpRows(previousRows);
      toast.error(`Error al marcar "voy": ${error.message}`);
    }
  };

  const rsvpGroup = async (event: MunoEvent, groupId: string) => {
    const { error } = await supabase.rpc("rsvp_group", {
      p_group_id: groupId,
      p_event_id: event.id,
      p_event_name: event.name,
      p_event_start_at: event.start_at,
      p_event_address: event.address,
      p_event_url: event.url,
    });
    if (error) {
      toast.error(`Error marcando "vamos" para el grupo: ${error.message}`);
      return;
    }
    // rsvp_group no dice cuantas filas nuevas creo (usa "on conflict do nothing"), asi
    // que sin este aviso no hay forma de saber si la accion hizo algo quien la pulsa --
    // sobre todo si ya estabas apuntada tu sola, como en el caso mas comun de prueba.
    const groupName = myGroups.find((g) => g.id === groupId)?.name ?? "el grupo";
    toast.success(`"${groupName}" marcado en este evento`);
    loadRsvps();
  };

  const dayGroups = groupEventsByDay(events);

  return (
    <div className="flex flex-col">
      {dayGroups.map((dayGroup) => (
        <section key={dayGroup.label}>
          <h2 className="sticky top-0 bg-background pt-2 pb-2 font-display text-2xl italic text-muted">
            {dayGroup.label}
          </h2>
          <div className="flex flex-col">
            {dayGroup.events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                summary={summaries.get(event.id) ?? EMPTY_SUMMARY}
                signedIn={!!user}
                full={spotsUrgent(event)}
                myGroups={myGroups}
                onToggleRsvp={() => toggleRsvp(event, (summaries.get(event.id) ?? EMPTY_SUMMARY).isGoing)}
                onGroupRsvp={(groupId) => rsvpGroup(event, groupId)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EventRow({
  event,
  summary,
  signedIn,
  full,
  myGroups,
  onToggleRsvp,
  onGroupRsvp,
}: {
  event: MunoEvent;
  summary: RsvpSummary;
  signedIn: boolean;
  full: boolean;
  myGroups: MyGroup[];
  onToggleRsvp: () => void;
  onGroupRsvp: (groupId: string) => void;
}) {
  const spots = spotsLabel(event);
  const urgent = spotsUrgent(event);
  const deadline = registrationDeadlineLabel(event);
  const categories = event.extra.categories;
  const time = event.start_at ? formatEventDate(event.start_at).time : null;
  const [showMap, setShowMap] = useState(false);

  // El enlace SOLO envuelve la parte que debe llevar al evento (fecha/titulo/direccion).
  // Antes el <select> de grupos vivia dentro del <a>, y abrir un <select> nativo no se
  // puede "cancelar" de forma fiable con preventDefault/stopPropagation -- el navegador
  // seguia navegando. Sacar los controles fuera del enlace evita el problema de raiz en
  // vez de parchear el evento de clic.
  return (
    <div className="group flex flex-col gap-3 border-b border-line py-5">
      <div className="flex items-start gap-6 sm:gap-8">
        <a
          href={event.url ? `/ir/${encodeURIComponent(event.id)}` : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-grow gap-6 sm:gap-8"
        >
          <div className="w-14 flex-shrink-0 pt-1 text-sm text-muted sm:w-16">{time ?? ""}</div>

          <div className="flex min-w-0 flex-grow flex-col gap-1.5">
            <div className="font-body text-lg font-semibold group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 sm:text-xl">
              {event.name}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {event.address && <span className="text-sm text-muted">{event.address}</span>}
              {event.lat != null && event.lng != null && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMap((v) => !v);
                  }}
                  className="text-[11px] uppercase tracking-wider text-muted underline decoration-dotted underline-offset-2 hover:text-foreground"
                >
                  {showMap ? "Ocultar mapa" : "Ver ubicación"}
                </button>
              )}
              <ShareEvent event={event} />
            </div>
          </div>
        </a>

        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          {categories?.map((c) => (
            <span
              key={c}
              className="rounded-full border border-foreground px-2.5 py-0.5 text-[11px] uppercase tracking-wider"
            >
              {c}
            </span>
          ))}
          {spots && (
            <span className={`text-xs font-medium ${urgent ? "text-accent" : "text-ok"}`}>{spots}</span>
          )}
          {deadline && <span className="text-[11px] text-muted">{deadline}</span>}
          <RsvpControl
            summary={summary}
            signedIn={signedIn}
            full={full}
            myGroups={myGroups}
            onToggle={onToggleRsvp}
            onGroupRsvp={onGroupRsvp}
          />
        </div>
      </div>

      {showMap && event.lat != null && event.lng != null && (
        <div className="ml-[80px] max-w-xs sm:ml-[104px]">
          <EventMiniMapLoader lat={event.lat} lng={event.lng} />
        </div>
      )}
    </div>
  );
}
