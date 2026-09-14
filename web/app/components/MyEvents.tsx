"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/client";
import { formatEventDate } from "@/app/lib/events";

type MyEventEntry = {
  event_id: string;
  event_name: string | null;
  event_start_at: string | null;
  event_address: string | null;
  event_url: string | null;
};

type Attendee = { user_id: string; display_name: string };
type ConnectionRow = { event_id: string; user_id: string; other_user_id: string };

export default function MyEvents() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [myEvents, setMyEvents] = useState<MyEventEntry[]>([]);
  const [attendeesByEvent, setAttendeesByEvent] = useState<Map<string, Attendee[]>>(new Map());
  const [connections, setConnections] = useState<ConnectionRow[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoaded(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const load = useCallback(async () => {
    if (!user) return;

    const { data: mine, error: mineError } = await supabase
      .from("rsvps")
      .select("event_id, event_name, event_start_at, event_address, event_url")
      .eq("user_id", user.id);
    if (mineError) {
      alert(`Error cargando tus eventos: ${mineError.message}`);
      return;
    }
    setMyEvents(mine ?? []);

    const ids = (mine ?? []).map((r) => r.event_id);
    if (ids.length === 0) return;

    const { data: allRows, error: allError } = await supabase
      .from("rsvps")
      .select("event_id, user_id, profiles(display_name, show_name)")
      .in("event_id", ids);
    if (allError) {
      alert(`Error cargando asistentes: ${allError.message}`);
      return;
    }
    const map = new Map<string, Attendee[]>();
    for (const row of (allRows ?? []) as unknown as {
      event_id: string;
      user_id: string;
      profiles: { display_name: string | null; show_name: boolean } | null;
    }[]) {
      if (row.user_id === user.id) continue;
      if (!row.profiles?.show_name || !row.profiles.display_name) continue;
      const list = map.get(row.event_id) ?? [];
      list.push({ user_id: row.user_id, display_name: row.profiles.display_name });
      map.set(row.event_id, list);
    }
    setAttendeesByEvent(map);

    const { data: conns, error: connError } = await supabase
      .from("connections")
      .select("event_id, user_id, other_user_id")
      .in("event_id", ids);
    if (connError) {
      alert(`Error cargando conexiones: ${connError.message}`);
      return;
    }
    setConnections(conns ?? []);
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  const markConnection = async (eventId: string, otherUserId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("connections")
      .insert({ event_id: eventId, user_id: user.id, other_user_id: otherUserId });
    if (error) {
      alert(`Error al marcar la conexion: ${error.message}`);
      return;
    }
    load();
  };

  if (!loaded) return null;

  if (!user) {
    return (
      <button
        onClick={() =>
          supabase.auth.signInWithOAuth({
            provider: "github",
            options: { redirectTo: `${window.location.origin}/auth/callback` },
          })
        }
        className="border border-foreground px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-colors hover:bg-foreground hover:text-background"
      >
        Entrar con GitHub para ver tus eventos
      </button>
    );
  }

  const now = new Date();
  const upcoming = myEvents.filter((e) => !e.event_start_at || new Date(e.event_start_at) >= now);
  const past = myEvents.filter((e) => e.event_start_at && new Date(e.event_start_at) < now);

  if (myEvents.length === 0) {
    return <p className="text-sm text-muted">Todavía no has marcado &quot;voy&quot; en ningún evento.</p>;
  }

  return (
    <div className="flex flex-col gap-12">
      {upcoming.length > 0 && (
        <section>
          <h2 className="font-display text-2xl italic text-muted">Próximos</h2>
          <div className="mt-4 flex flex-col">
            {upcoming.map((event) => (
              <a
                key={event.event_id}
                href={event.event_url ? `/ir/${encodeURIComponent(event.event_id)}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="block border-b border-line py-4 hover:underline"
              >
                <div className="font-body text-lg font-semibold">{event.event_name}</div>
                <div className="text-sm text-muted">
                  {event.event_start_at && formatWhen(event.event_start_at)}
                  {event.event_address && ` · ${event.event_address}`}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="font-display text-2xl italic text-muted">Pasados</h2>
          <div className="mt-4 flex flex-col gap-8">
            {past.map((event) => {
              const attendees = attendeesByEvent.get(event.event_id) ?? [];
              const myOutgoing = new Set(
                connections
                  .filter((c) => c.event_id === event.event_id && c.user_id === user.id)
                  .map((c) => c.other_user_id)
              );
              const myIncoming = new Set(
                connections
                  .filter((c) => c.event_id === event.event_id && c.other_user_id === user.id)
                  .map((c) => c.user_id)
              );

              return (
                <div key={event.event_id} className="border-b border-line pb-8">
                  <div className="font-body text-lg font-semibold">{event.event_name}</div>
                  <div className="text-sm text-muted">
                    {event.event_start_at && formatWhen(event.event_start_at)}
                  </div>

                  {attendees.length === 0 ? (
                    <p className="mt-3 text-xs text-muted">Nadie más que mostrara su nombre marcó &quot;voy&quot; aquí.</p>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2">
                      <p className="text-xs uppercase tracking-wider text-muted">¿Con quién coincidiste?</p>
                      {attendees.map((person) => {
                        const iMarked = myOutgoing.has(person.user_id);
                        const mutual = iMarked && myIncoming.has(person.user_id);
                        return (
                          <div key={person.user_id} className="flex items-center justify-between gap-3">
                            <span className="text-sm">{person.display_name}</span>
                            {mutual ? (
                              <a
                                href={`https://github.com/${person.display_name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="border border-ok bg-ok px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-background"
                              >
                                Coincidisteis · ver contacto
                              </a>
                            ) : iMarked ? (
                              <span className="text-[11px] uppercase tracking-wider text-muted">Pendiente de confirmar</span>
                            ) : (
                              <button
                                onClick={() => markConnection(event.event_id, person.user_id)}
                                className="border border-line px-2.5 py-1 text-[11px] uppercase tracking-wider text-muted hover:border-foreground hover:text-foreground"
                              >
                                Marcar que coincidimos
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function formatWhen(startAt: string): string {
  const d = formatEventDate(startAt);
  return `${d.weekday} ${d.day} ${d.monthLabel}${d.time ? ` · ${d.time}` : ""}`;
}
