"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, LogOut } from "lucide-react";
import type { Community } from "@/app/comunidades/page";
import { useSession } from "@/app/components/Session";
import { useToast } from "@/app/components/Toast";
import { Avatar, AvatarStack, Cover } from "@/app/components/ui";
import { LIST_COLUMNS, eventPath, isPast, shortDate, type MunoEvent } from "@/app/lib/events";

type Member = { user_id: string; profiles: { display_name: string | null; avatar_url: string | null; headline: string | null } | null };
type Rsvp = { event_id: string; user_id: string; status: string; event_name: string | null; event_start_at: string | null };

export default function CommunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { supabase, user, loaded } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [group, setGroup] = useState<(Community & { invite_code?: string }) | null | undefined>(undefined);
  const [members, setMembers] = useState<Member[]>([]);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [events, setEvents] = useState<Map<string, MunoEvent>>(new Map());

  const isMember = !!user && members.some((m) => m.user_id === user.id);

  const fetchAll = useCallback(async () => {
    const { data: g } = await supabase
      .from("groups")
      .select("id, name, description, emoji, is_public, owner_id, invite_code")
      .eq("id", id)
      .maybeSingle();
    const out = { group: (g as Community) ?? null, members: [] as Member[], rsvps: [] as Rsvp[], events: new Map<string, MunoEvent>() };
    if (!g) return out;
    const { data: m } = await supabase
      .from("group_members")
      .select("user_id, profiles(display_name, avatar_url, headline)")
      .eq("group_id", id);
    out.members = (m ?? []) as unknown as Member[];
    if (out.members.length === 0) return out;
    const { data: r } = await supabase
      .from("rsvps")
      .select("event_id, user_id, status, event_name, event_start_at")
      .in("user_id", out.members.map((x) => x.user_id));
    out.rsvps = (r ?? []) as Rsvp[];
    const ids = [...new Set(out.rsvps.map((x) => x.event_id))];
    if (ids.length) {
      const { data: evs } = await supabase.from("events").select(LIST_COLUMNS).in("id", ids);
      out.events = new Map(((evs ?? []) as unknown as MunoEvent[]).map((e) => [e.id, e]));
    }
    return out;
  }, [supabase, id]);

  const apply = useCallback((d: Awaited<ReturnType<typeof fetchAll>>) => {
    setGroup(d.group);
    setMembers(d.members);
    setRsvps(d.rsvps);
    setEvents(d.events);
  }, []);
  const load = () => fetchAll().then(apply);

  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    fetchAll().then((d) => alive && apply(d));
    return () => {
      alive = false;
    };
  }, [loaded, fetchAll, apply]);

  const agenda = useMemo(() => {
    const byEvent = new Map<string, { id: string; title: string; start: string; ev: MunoEvent | null; people: Member[] }>();
    for (const r of rsvps) {
      const ev = events.get(r.event_id) ?? null;
      const item = byEvent.get(r.event_id) ?? {
        id: r.event_id,
        title: ev?.title ?? r.event_name ?? "Evento",
        start: ev?.start_at ?? r.event_start_at ?? "",
        ev,
        people: [],
      };
      const m = members.find((x) => x.user_id === r.user_id);
      if (m) item.people.push(m);
      byEvent.set(r.event_id, item);
    }
    const all = [...byEvent.values()].filter((x) => x.start);
    return {
      upcoming: all.filter((x) => !isPast({ start_at: x.start, end_at: x.ev?.end_at ?? null })).sort((a, b) => a.start.localeCompare(b.start)),
      past: all.filter((x) => isPast({ start_at: x.start, end_at: x.ev?.end_at ?? null })).sort((a, b) => b.start.localeCompare(a.start)),
    };
  }, [rsvps, events, members]);

  if (group === undefined) return <main className="mx-auto max-w-2xl px-4 pt-8"><div className="h-32 animate-pulse rounded-2xl bg-surface-2" /></main>;
  if (group === null)
    return (
      <main className="mx-auto max-w-2xl px-4 pt-16 text-center">
        <p className="text-4xl">🔒</p>
        <p className="mt-2 font-semibold">Esta comunidad es privada</p>
        <p className="text-sm text-muted">Necesitas el link de invitación de alguien de dentro.</p>
      </main>
    );

  const inviteUrl = typeof window !== "undefined" && group.invite_code ? `${window.location.origin}/comunidades/unirse/${group.invite_code}` : "";

  const copyInvite = async () => {
    if (navigator.share) {
      try {
        return await navigator.share({ title: `Únete a ${group.name} en muno`, url: inviteUrl });
      } catch {}
    }
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Link de invitación copiado");
  };

  const join = async () => {
    if (!user) return router.push(`/entrar?next=/comunidades/${id}`);
    const { error } = await supabase.rpc("join_public_group", { p_group_id: id });
    if (error) return toast.error(error.message);
    load();
  };

  const leave = async () => {
    if (!user || !confirm(`¿Salir de ${group.name}?`)) return;
    const { error } = await supabase.from("group_members").delete().eq("group_id", id).eq("user_id", user.id);
    if (error) return toast.error(error.message);
    router.push("/comunidades");
  };

  const EventRow = ({ x }: { x: (typeof agenda.upcoming)[number] }) => {
    const d = shortDate(x.start);
    return (
      <Link href={eventPath(x.id)} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-foreground/25">
        <Cover src={x.ev?.image_url ?? null} title={x.title} className="size-14 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-brand uppercase">
            {d.weekday} {d.day} {d.month}
          </p>
          <p className="truncate font-semibold">{x.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            <AvatarStack people={x.people.map((p) => ({ name: p.profiles?.display_name ?? null, url: p.profiles?.avatar_url }))} size={18} />
            {x.people.length} de la comunidad
          </div>
        </div>
      </Link>
    );
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8">
      <div className="flex items-start gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-brand-soft text-4xl">{group.emoji ?? "🚀"}</span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-extrabold">{group.name}</h1>
          <p className="text-muted">
            {members.length} {members.length === 1 ? "miembro" : "miembros"} · {group.is_public ? "Abierta" : "Privada"}
          </p>
          {group.description && <p className="mt-2">{group.description}</p>}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {isMember ? (
          <>
            {group.invite_code && (
              <button onClick={copyInvite} className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">
                <Copy className="size-4" /> Invitar gente
              </button>
            )}
            <button onClick={leave} className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-medium text-muted">
              <LogOut className="size-4" /> Salir
            </button>
          </>
        ) : (
          group.is_public && (
            <button onClick={join} className="rounded-full bg-brand px-5 py-2 font-semibold text-white">
              Unirme
            </button>
          )
        )}
      </div>

      {isMember && (
        <p className="mt-4 rounded-2xl bg-surface-2 p-3 text-sm text-muted">
          💡 En la página de cualquier evento pulsa <b>«Ir con mi comunidad»</b> para apuntar a todos de golpe.
        </p>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-bold">Próximos planes</h2>
        {agenda.upcoming.length === 0 ? (
          <p className="text-sm text-muted">
            Nadie se ha apuntado a nada todavía. <Link href="/" className="font-medium text-brand">Buscar un evento →</Link>
          </p>
        ) : (
          <div className="space-y-2">{agenda.upcoming.map((x) => <EventRow key={x.id} x={x} />)}</div>
        )}
      </section>

      {agenda.past.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-bold">Donde habéis estado · {agenda.past.length}</h2>
          <div className="space-y-2">{agenda.past.map((x) => <EventRow key={x.id} x={x} />)}</div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-bold">Miembros</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
              <Avatar name={m.profiles?.display_name ?? null} url={m.profiles?.avatar_url} size={36} />
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {m.profiles?.display_name ?? "Miembro"}
                  {m.user_id === group.owner_id && <span className="ml-1 text-xs text-muted">· admin</span>}
                </p>
                {m.profiles?.headline && <p className="truncate text-xs text-muted">{m.profiles.headline}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
