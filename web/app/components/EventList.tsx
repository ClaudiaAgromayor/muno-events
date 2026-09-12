"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/client";
import type { MunoEvent } from "@/app/lib/events";
import { formatEventDate, groupEventsByDay, spotsLabel, spotsUrgent } from "@/app/lib/events";
import RsvpControl, { type RsvpSummary } from "@/app/components/RsvpControl";

type RsvpRow = {
  event_id: string;
  user_id: string;
  profiles: { display_name: string | null; show_name: boolean } | null;
};

const EMPTY_SUMMARY: RsvpSummary = { count: 0, names: [], isGoing: false };

export default function EventList({ events }: { events: MunoEvent[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [rsvpRows, setRsvpRows] = useState<RsvpRow[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const loadRsvps = useCallback(async () => {
    // profiles(display_name, show_name) es un join -- si show_name es false para esa
    // fila y no es tu propio usuario, la RLS de "profiles" hace que venga null aqui,
    // sin exponer el nombre aunque se pida explicitamente en el select.
    const { data } = await supabase.from("rsvps").select("event_id, user_id, profiles(display_name, show_name)");
    setRsvpRows((data as unknown as RsvpRow[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    loadRsvps();
  }, [loadRsvps]);

  const summaries = useMemo(() => {
    const map = new Map<string, RsvpSummary>();
    for (const row of rsvpRows) {
      const existing = map.get(row.event_id) ?? { count: 0, names: [], isGoing: false };
      existing.count += 1;
      if (row.profiles?.show_name && row.profiles.display_name) {
        existing.names.push(row.profiles.display_name);
      }
      if (user && row.user_id === user.id) existing.isGoing = true;
      map.set(row.event_id, existing);
    }
    return map;
  }, [rsvpRows, user]);

  const toggleRsvp = async (eventId: string, isGoing: boolean) => {
    if (!user) {
      await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      return;
    }
    if (isGoing) {
      await supabase.from("rsvps").delete().eq("event_id", eventId).eq("user_id", user.id);
    } else {
      await supabase.from("rsvps").insert({ event_id: eventId, user_id: user.id });
    }
    loadRsvps();
  };

  const groups = groupEventsByDay(events);

  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="sticky top-0 bg-background pt-2 pb-2 font-display text-2xl italic text-muted">
            {group.label}
          </h2>
          <div className="flex flex-col">
            {group.events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                summary={summaries.get(event.id) ?? EMPTY_SUMMARY}
                signedIn={!!user}
                onToggleRsvp={() => toggleRsvp(event.id, (summaries.get(event.id) ?? EMPTY_SUMMARY).isGoing)}
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
  onToggleRsvp,
}: {
  event: MunoEvent;
  summary: RsvpSummary;
  signedIn: boolean;
  onToggleRsvp: () => void;
}) {
  const spots = spotsLabel(event);
  const urgent = spotsUrgent(event);
  const categories = event.extra.categories;
  const time = event.start_at ? formatEventDate(event.start_at).time : null;

  return (
    <a
      href={event.url ? `/ir/${encodeURIComponent(event.id)}` : "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-6 border-b border-line py-5 sm:gap-8"
    >
      <div className="w-14 flex-shrink-0 pt-1 text-sm text-muted sm:w-16">{time ?? ""}</div>

      <div className="flex min-w-0 flex-grow flex-col gap-1.5">
        <div className="font-body text-lg font-semibold group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 sm:text-xl">
          {event.name}
        </div>
        {event.address && <div className="text-sm text-muted">{event.address}</div>}
      </div>

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
        <RsvpControl summary={summary} signedIn={signedIn} onToggle={onToggleRsvp} />
      </div>
    </a>
  );
}
