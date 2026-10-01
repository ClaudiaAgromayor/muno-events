"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { List, Map as MapIcon, Search, SlidersHorizontal, X } from "lucide-react";
import { EventCard } from "@/app/components/EventCard";
import { useSession } from "@/app/components/Session";
import { Chip, Cover, StatusBadge } from "@/app/components/ui";
import { useSocial, type RsvpStatus } from "@/app/components/useSocial";
import {
  KINDS,
  TOPICS,
  canJoin,
  dayKey,
  dayLabel,
  eventPath,
  kindInfo,
  shortDate,
  type EventKind,
  type MunoEvent,
} from "@/app/lib/events";

const EventsMap = dynamic(() => import("@/app/components/EventsMap"), {
  ssr: false,
  loading: () => <div className="h-[70vh] animate-pulse rounded-2xl bg-surface-2" />,
});

type When = "all" | "today" | "week" | "weekend" | "month";
const WHEN: { id: When; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "today", label: "Hoy" },
  { id: "week", label: "Esta semana" },
  { id: "weekend", label: "Finde" },
  { id: "month", label: "Este mes" },
];

function matchesWhen(e: MunoEvent, when: When, now: Date) {
  if (when === "all") return true;
  const key = dayKey(e.start_at);
  const today = dayKey(now.toISOString());
  const plus = (n: number) => dayKey(new Date(now.getTime() + n * 86400000).toISOString());
  if (when === "today") return key === today;
  if (when === "month") return key.slice(0, 7) === today.slice(0, 7);
  const dow = (now.getDay() + 6) % 7; // 0 = lunes
  if (when === "week") return key >= today && key <= plus(6 - dow);
  // finde: viernes tarde a domingo de esta semana (o el siguiente si ya pasó)
  const fri = plus(4 - dow), sun = plus(6 - dow);
  if (key < fri || key > sun) return false;
  return key !== fri || Number(new Date(e.start_at).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Madrid" })) >= 17;
}

export default function Discover({ events, updatedAt }: { events: MunoEvent[]; updatedAt: string | null }) {
  const router = useRouter();
  const { user } = useSession();
  const social = useSocial();
  const [q, setQ] = useState("");
  const [when, setWhen] = useState<When>("all");
  const [kinds, setKinds] = useState<EventKind[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [free, setFree] = useState(false);
  const [available, setAvailable] = useState(false);
  const [inPerson, setInPerson] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [showFilters, setShowFilters] = useState(false);

  const now = useMemo(() => new Date(), []);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter(
      (e) =>
        (!needle || `${e.title} ${e.organizer ?? ""} ${e.venue_name ?? ""}`.toLowerCase().includes(needle)) &&
        matchesWhen(e, when, now) &&
        (kinds.length === 0 || kinds.includes(e.kind)) &&
        (topics.length === 0 || topics.some((t) => e.topics.includes(t))) &&
        (!free || e.is_free) &&
        (!available || canJoin(e.status)) &&
        (!inPerson || !e.is_online)
    );
  }, [events, q, when, kinds, topics, free, available, inPerson, now]);

  const days = useMemo(() => {
    const m = new Map<string, MunoEvent[]>();
    for (const e of filtered) {
      const k = dayKey(e.start_at);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [filtered]);

  // "Lo más top esta semana": lo que más gente tiene apuntada (plataforma + muno)
  const trending = useMemo(() => {
    const limit = new Date(now.getTime() + 8 * 86400000).toISOString();
    return events
      .filter((e) => e.start_at < limit && canJoin(e.status) && !e.is_online)
      // Solo datos del servidor: si dependiera de los "voy" de muno (que llegan después),
      // el carrusel se reordenaría delante de la persona.
      .map((e) => ({ e, score: (e.going_count ?? 0) + (e.featured ? 1000 : 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.e);
  }, [events, now]);

  const onRsvp = async (e: MunoEvent, s: RsvpStatus) => {
    if (!user) return router.push(`/entrar?next=${encodeURIComponent(eventPath(e.id))}`);
    await social.setStatus(e, s);
  };

  const activeFilters = kinds.length + topics.length + (free ? 1 : 0) + (available ? 1 : 0) + (inPerson ? 1 : 0);
  const clearAll = () => {
    setKinds([]);
    setTopics([]);
    setFree(false);
    setAvailable(false);
    setInPerson(false);
    setWhen("all");
    setQ("");
  };

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="pt-8 pb-6 sm:pt-12">
        <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
          Todo el tech de Madrid.
          <br />
          <span className="bg-gradient-to-r from-brand to-coral bg-clip-text text-transparent">Y con quién ir.</span>
        </h1>
        <p className="mt-3 max-w-xl text-muted sm:text-lg">
          {events.length} meetups, conferencias, hackathons y networking de IA, data, dev y startups. Actualizado solo
          cada pocas horas desde Luma, Meetup y Eventbrite.
        </p>
      </section>

      {/* Lo más top */}
      {trending.length > 0 && (
        <section className="pb-8">
          <h2 className="mb-3 font-display text-xl font-bold">🔥 Lo más top esta semana</h2>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
            {trending.map((e) => {
              const d = shortDate(e.start_at);
              return (
                <Link
                  key={e.id}
                  href={eventPath(e.id)}
                  className="w-64 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-surface transition hover:shadow-md"
                >
                  <Cover src={e.image_url} title={e.title} className="aspect-[16/9] w-full" />
                  <div className="p-3">
                    <p className="text-xs font-semibold text-brand uppercase">
                      {d.weekday} {d.day} {d.month} · {d.time}
                    </p>
                    <p className="mt-1 line-clamp-2 leading-snug font-semibold">{e.title}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                      <span>{kindInfo(e.kind).emoji}</span>
                      {e.going_count ? <span>{e.going_count} apuntados</span> : null}
                      {e.status !== "open" && <StatusBadge status={e.status} />}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Barra de búsqueda y filtros (pegajosa) */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-line/70 bg-background/90 px-4 pt-3 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 focus-within:border-brand">
            <Search className="size-4 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busca: LLMs, PyData, hackathon…"
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Borrar búsqueda">
                <X className="size-4 text-muted" />
              </button>
            )}
          </label>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`relative flex items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium ${
              showFilters || activeFilters ? "border-foreground" : "border-line bg-surface"
            }`}
          >
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilters > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[11px] text-white">
                {activeFilters}
              </span>
            )}
          </button>
          <div className="flex rounded-full border border-line bg-surface p-0.5">
            {(["list", "map"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-label={v === "list" ? "Ver lista" : "Ver mapa"}
                className={`flex items-center rounded-full px-3 ${view === v ? "bg-foreground text-background" : "text-muted"}`}
              >
                {v === "list" ? <List className="size-4" /> : <MapIcon className="size-4" />}
              </button>
            ))}
          </div>
        </div>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {WHEN.map((w) => (
            <Chip key={w.id} active={when === w.id} onClick={() => setWhen(w.id)}>
              {w.label}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-line" />
          {KINDS.map((k) => (
            <Chip key={k.id} active={kinds.includes(k.id)} onClick={() => setKinds(toggle(kinds, k.id))}>
              {k.emoji} {k.label}
            </Chip>
          ))}
        </div>

        {showFilters && (
          <div className="mt-3 space-y-3 rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap gap-2">
              <Chip active={available} onClick={() => setAvailable(!available)}>
                ✅ Aún puedo apuntarme
              </Chip>
              <Chip active={free} onClick={() => setFree(!free)}>
                🆓 Gratis
              </Chip>
              <Chip active={inPerson} onClick={() => setInPerson(!inPerson)}>
                📍 Solo presencial
              </Chip>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Temas</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TOPICS).map(([id, label]) => (
                  <Chip key={id} active={topics.includes(id)} onClick={() => setTopics(toggle(topics, id))}>
                    {label}
                  </Chip>
                ))}
              </div>
            </div>
            {activeFilters > 0 && (
              <button onClick={clearAll} className="text-sm font-medium text-brand">
                Quitar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Resultados */}
      <p className="pt-4 pb-2 text-sm text-muted">
        {filtered.length} {filtered.length === 1 ? "evento" : "eventos"}
        {updatedAt && <> · actualizado {updatedAt}</>}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-2 font-semibold">Nada con esos filtros</p>
          <button onClick={clearAll} className="mt-2 text-sm font-medium text-brand">
            Ver todos los eventos
          </button>
        </div>
      ) : view === "map" ? (
        <EventsMap events={filtered} />
      ) : (
        <div className="space-y-8 pt-2">
          {days.map(([key, list]) => {
            const label = dayLabel(key, now);
            return (
              <section key={key} className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                <h2 className="self-start py-1 sm:sticky sm:top-44">
                  <span className="font-display text-xl font-bold">{label.main}</span>{" "}
                  <span className="text-muted capitalize sm:block">{label.sub}</span>
                </h2>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
                  {list.map((e) => (
                    <EventCard key={e.id} event={e} social={social.get(e.id)} onRsvp={(s) => onRsvp(e, s)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
