"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useSession } from "@/app/components/Session";
import { useToast } from "@/app/components/Toast";
import { rsvpSnapshot, type MunoEvent } from "@/app/lib/events";

export type RsvpStatus = "going" | "interested";

type RsvpRow = {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

export type EventSocial = {
  going: number;
  interested: number;
  /** Gente con nombre visible (show_name o de tus comunidades) */
  people: { id: string; name: string | null; url: string | null; status: RsvpStatus }[];
  mine: RsvpStatus | null;
};

const EMPTY: EventSocial = { going: 0, interested: 0, people: [], mine: null };

export type MyGroup = { id: string; name: string; emoji: string | null };

/**
 * Carga los "voy"/"me interesa" de muno. Si se pasan eventIds se piden solo esos (página de
 * evento); si no, los de los últimos 120 días (listado).
 */
export function useSocial(eventIds?: string[]) {
  const { supabase, user } = useSession();
  const toast = useToast();
  const [rows, setRows] = useState<RsvpRow[]>([]);
  const [myGroups, setMyGroups] = useState<MyGroup[]>([]);
  const groups = user ? myGroups : [];
  const idsKey = eventIds?.join("|") ?? "";
  const instance = useId();

  const fetchRows = useCallback(async () => {
    let q = supabase.from("rsvps").select("event_id, user_id, status, profiles(display_name, avatar_url)");
    if (idsKey) q = q.in("event_id", idsKey.split("|"));
    else q = q.gte("created_at", new Date(Date.now() - 120 * 86400000).toISOString()).limit(5000);
    const { data } = await q;
    return (data ?? []) as unknown as RsvpRow[];
  }, [supabase, idsKey]);

  const load = useCallback(() => fetchRows().then(setRows), [fetchRows]);

  useEffect(() => {
    let alive = true;
    const refresh = () => fetchRows().then((r) => alive && setRows(r));
    refresh();
    // Tiempo real: si alguien se apunta mientras miras, se actualiza solo.
    const ch = supabase
      .channel(`rsvps-${instance}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rsvps" }, refresh)
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [supabase, fetchRows, instance]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("group_members")
      .select("groups(id, name, emoji)")
      .eq("user_id", user.id)
      .then(({ data }) =>
        setMyGroups(
          ((data ?? []) as unknown as { groups: MyGroup | null }[]).map((r) => r.groups).filter((g): g is MyGroup => !!g)
        )
      );
  }, [supabase, user]);

  const byEvent = useMemo(() => {
    const m = new Map<string, EventSocial>();
    for (const r of rows) {
      const s = m.get(r.event_id) ?? { going: 0, interested: 0, people: [], mine: null };
      if (r.status === "going") s.going++;
      else s.interested++;
      if (user && r.user_id === user.id) s.mine = r.status;
      if (r.profiles?.display_name)
        s.people.push({ id: r.user_id, name: r.profiles.display_name, url: r.profiles.avatar_url, status: r.status });
      m.set(r.event_id, s);
    }
    return m;
  }, [rows, user]);

  const get = useCallback((id: string) => byEvent.get(id) ?? EMPTY, [byEvent]);

  /** Marca/desmarca. Pulsar el estado que ya tienes lo quita. */
  const setStatus = useCallback(
    async (event: MunoEvent, status: RsvpStatus) => {
      if (!user) return false;
      const current = get(event.id).mine;
      const prev = rows;
      if (current === status) {
        setRows(rows.filter((r) => !(r.event_id === event.id && r.user_id === user.id)));
        const { error } = await supabase.from("rsvps").delete().eq("event_id", event.id).eq("user_id", user.id);
        if (error) {
          setRows(prev);
          toast.error(error.message);
        }
        return true;
      }
      setRows([
        ...rows.filter((r) => !(r.event_id === event.id && r.user_id === user.id)),
        { event_id: event.id, user_id: user.id, status, profiles: null },
      ]);
      const { error } = await supabase
        .from("rsvps")
        .upsert({ ...rsvpSnapshot(event), user_id: user.id, status }, { onConflict: "event_id,user_id" });
      if (error) {
        setRows(prev);
        toast.error(error.message);
        return false;
      }
      toast.success(status === "going" ? "¡Apuntada en muno! 🎉" : "Guardado en Mis planes");
      load();
      return true;
    },
    [user, rows, get, supabase, toast, load]
  );

  const goWithGroup = useCallback(
    async (event: MunoEvent, group: MyGroup) => {
      const s = rsvpSnapshot(event);
      const { error } = await supabase.rpc("rsvp_group", {
        p_group_id: group.id,
        p_event_id: s.event_id,
        p_event_name: s.event_name,
        p_event_start_at: s.event_start_at,
        p_event_address: s.event_address,
        p_event_url: s.event_url,
      });
      if (error) return toast.error(error.message);
      toast.success(`${group.emoji ?? "🚀"} ${group.name} va al evento`);
      load();
    },
    [supabase, toast, load]
  );

  return { get, setStatus, groups, goWithGroup, reload: load };
}
