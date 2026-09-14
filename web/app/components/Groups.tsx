"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/client";
import { formatEventDate } from "@/app/lib/events";
import { useToast } from "@/app/components/Toast";

type Group = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
};

type Member = { user_id: string; display_name: string | null };

type GroupEvent = {
  event_id: string;
  event_name: string | null;
  event_start_at: string | null;
  event_url: string | null;
  goingCount: number;
};

export default function Groups() {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [membersByGroup, setMembersByGroup] = useState<Map<string, Member[]>>(new Map());
  const [eventsByGroup, setEventsByGroup] = useState<Map<string, GroupEvent[]>>(new Map());
  const [newName, setNewName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    const { data, error } = await supabase.from("groups").select("id, name, invite_code, owner_id");
    if (error) {
      toast.error(`Error cargando grupos: ${error.message}`);
      return;
    }
    setGroups(data ?? []);

    if ((data ?? []).length === 0) return;
    const { data: members, error: membersError } = await supabase
      .from("group_members")
      .select("group_id, user_id, profiles(display_name)")
      .in("group_id", (data ?? []).map((g) => g.id));
    if (membersError) {
      toast.error(`Error cargando miembros: ${membersError.message}`);
      return;
    }
    const map = new Map<string, Member[]>();
    for (const row of (members ?? []) as unknown as {
      group_id: string;
      user_id: string;
      profiles: { display_name: string | null } | null;
    }[]) {
      const list = map.get(row.group_id) ?? [];
      list.push({ user_id: row.user_id, display_name: row.profiles?.display_name ?? null });
      map.set(row.group_id, list);
    }
    setMembersByGroup(map);

    const allMemberIds = Array.from(new Set((members ?? []).map((m) => (m as { user_id: string }).user_id)));
    const { data: rsvpRows, error: rsvpError } = await supabase
      .from("rsvps")
      .select("user_id, event_id, event_name, event_start_at, event_url")
      .in("user_id", allMemberIds);
    if (rsvpError) {
      toast.error(`Error cargando la agenda del grupo: ${rsvpError.message}`);
      return;
    }
    const eventsMap = new Map<string, GroupEvent[]>();
    for (const [groupId, groupMembers] of map.entries()) {
      const memberIds = new Set(groupMembers.map((m) => m.user_id));
      const byEvent = new Map<string, GroupEvent>();
      for (const row of (rsvpRows ?? []) as {
        user_id: string;
        event_id: string;
        event_name: string | null;
        event_start_at: string | null;
        event_url: string | null;
      }[]) {
        if (!memberIds.has(row.user_id)) continue;
        const existing = byEvent.get(row.event_id);
        if (existing) {
          existing.goingCount += 1;
        } else {
          byEvent.set(row.event_id, {
            event_id: row.event_id,
            event_name: row.event_name,
            event_start_at: row.event_start_at,
            event_url: row.event_url,
            goingCount: 1,
          });
        }
      }
      eventsMap.set(
        groupId,
        Array.from(byEvent.values()).sort((a, b) => (a.event_start_at ?? "").localeCompare(b.event_start_at ?? ""))
      );
    }
    setEventsByGroup(eventsMap);
  }, [supabase, user, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const createGroup = async () => {
    if (!user || !newName.trim()) return;
    // Generamos el id en el navegador en vez de pedirselo de vuelta a la insercion:
    // justo despues de crear el grupo todavia no eres miembro (eso pasa en el segundo
    // paso, aqui abajo), y la politica de SELECT de "groups" exige ya serlo -- pedir el
    // id de vuelta con .select() fallaria por ese mismo motivo de "huevo y gallina".
    const groupId = crypto.randomUUID();
    const { error } = await supabase.from("groups").insert({ id: groupId, name: newName.trim(), owner_id: user.id });
    if (error) {
      toast.error(`Error creando el grupo: ${error.message}`);
      return;
    }
    const { error: memberError } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, user_id: user.id });
    if (memberError) {
      toast.error(`Error uniendote a tu propio grupo: ${memberError.message}`);
      return;
    }
    // En vez de recargar todo (grupos + miembros + agenda de cada uno), anadimos el
    // grupo nuevo directamente al estado local -- ya sabemos su forma exacta (tu como
    // unico miembro, sin eventos todavia), no hace falta volver a preguntarselo al
    // servidor para algo que ya conocemos.
    setGroups((prev) => [...prev, { id: groupId, name: newName.trim(), invite_code: "", owner_id: user.id }]);
    setMembersByGroup((prev) => {
      const next = new Map(prev);
      next.set(groupId, [{ user_id: user.id, display_name: null }]);
      return next;
    });
    setNewName("");
    toast.success("Grupo creado");
    load(); // en segundo plano, para traer el invite_code real generado por la base de datos
  };

  const copyInviteLink = (group: Group) => {
    const link = `${window.location.origin}/grupos/unirse/${group.invite_code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(group.id);
    setTimeout(() => setCopiedId(null), 2000);
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
        Entrar con GitHub para ver tus grupos
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre del grupo (ej. Las de siempre)"
          className="flex-grow border border-line bg-transparent px-3 py-2 text-sm"
        />
        <button
          onClick={createGroup}
          className="border border-foreground px-4 py-2 text-[11px] uppercase tracking-wider hover:bg-foreground hover:text-background"
        >
          Crear grupo
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="font-display text-xl italic text-muted">Ningún grupo por aquí — crea el primero y manda el link.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => {
            const members = membersByGroup.get(group.id) ?? [];
            const groupEvents = eventsByGroup.get(group.id) ?? [];
            return (
              <div key={group.id} className="border-b border-line pb-6">
                <div className="flex items-center justify-between">
                  <div className="font-body text-lg font-semibold">{group.name}</div>
                  <button
                    onClick={() => copyInviteLink(group)}
                    className="border border-line px-2.5 py-1 text-[11px] uppercase tracking-wider text-muted hover:border-foreground hover:text-foreground"
                  >
                    {copiedId === group.id ? "¡Copiado!" : "Copiar link de invitación"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {members.length} {members.length === 1 ? "miembro" : "miembros"}
                  {members.some((m) => m.display_name) &&
                    ` · ${members
                      .map((m) => m.display_name)
                      .filter(Boolean)
                      .join(", ")}`}
                </p>

                {groupEvents.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    <p className="text-xs uppercase tracking-wider text-muted">A dónde va el grupo</p>
                    {groupEvents.map((ev) => (
                      <a
                        key={ev.event_id}
                        href={ev.event_url ? `/ir/${encodeURIComponent(ev.event_id)}` : "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-3 text-sm hover:underline"
                      >
                        <span>{ev.event_name}</span>
                        <span className="flex-shrink-0 font-mono text-[11px] text-muted">
                          {ev.event_start_at && formatWhen(ev.event_start_at)} · {ev.goingCount}/{members.length}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatWhen(startAt: string): string {
  const d = formatEventDate(startAt);
  return `${d.weekday} ${d.day} ${d.monthLabel}`;
}
