"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/client";

type Group = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
};

type Member = { user_id: string; display_name: string | null };

export default function Groups() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [membersByGroup, setMembersByGroup] = useState<Map<string, Member[]>>(new Map());
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
      alert(`Error cargando grupos: ${error.message}`);
      return;
    }
    setGroups(data ?? []);

    if ((data ?? []).length === 0) return;
    const { data: members, error: membersError } = await supabase
      .from("group_members")
      .select("group_id, user_id, profiles(display_name)")
      .in("group_id", (data ?? []).map((g) => g.id));
    if (membersError) {
      alert(`Error cargando miembros: ${membersError.message}`);
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
  }, [supabase, user]);

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
      alert(`Error creando el grupo: ${error.message}`);
      return;
    }
    const { error: memberError } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, user_id: user.id });
    if (memberError) {
      alert(`Error uniendote a tu propio grupo: ${memberError.message}`);
      return;
    }
    setNewName("");
    load();
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
        <p className="text-sm text-muted">Todavía no tienes ningún grupo.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => {
            const members = membersByGroup.get(group.id) ?? [];
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
