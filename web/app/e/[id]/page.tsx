import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Globe, MapPin, Ticket, Users } from "lucide-react";
import EventActions from "@/app/e/[id]/EventActions";
import EventMiniMap from "@/app/e/[id]/EventMiniMap";
import { Cover, StatusBadge } from "@/app/components/ui";
import { getEvent } from "@/app/lib/queries";
import { SOURCE_LABEL, TOPICS, isPast, kindInfo, longDate, plainText, priceLabel, timeLabel } from "@/app/lib/events";

export const revalidate = 300;

async function load(params: Promise<{ id: string }>) {
  const { id } = await params;
  return getEvent(decodeURIComponent(id));
}

export async function generateMetadata({ params }: PageProps<"/e/[id]">): Promise<Metadata> {
  const e = await load(params);
  if (!e) return { title: "Evento no encontrado" };
  const desc = `${longDate(e.start_at)} · ${timeLabel(e.start_at)} · ${e.venue_name ?? e.address ?? "Madrid"}`;
  return {
    title: e.title,
    description: desc,
    openGraph: { title: e.title, description: desc, images: e.image_url ? [e.image_url] : undefined },
  };
}

export default async function EventPage({ params }: PageProps<"/e/[id]">) {
  const e = await load(params);
  if (!e) notFound();

  const kind = kindInfo(e.kind);
  const price = priceLabel(e);
  const past = isPast(e);
  const sameDay = !e.end_at || e.end_at.slice(0, 10) === e.start_at.slice(0, 10);
  const mapsUrl =
    e.lat != null
      ? `https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}`
      : e.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.address)}`
        : null;

  return (
    <main className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 sm:pt-8">
      {/* Móvil: portada, info, acciones, detalles. Escritorio: portada+acciones a la izquierda. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-6 [grid-template-areas:'cover'_'info'_'actions'_'details'] md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:[grid-template-areas:'cover_info'_'actions_details']">
        <Cover src={e.image_url} title={e.title} className="aspect-square w-full rounded-3xl shadow-sm [grid-area:cover]" />
        <div className="[grid-area:actions] md:sticky md:top-20 md:self-start">
          <EventActions event={e} past={past} />
        </div>

        <article className="min-w-0 [grid-area:info]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">
              {kind.emoji} {kind.label.replace(/s$/, "")}
            </span>
            {e.topics.map((t) => (
              <span key={t} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
                {TOPICS[t] ?? t}
              </span>
            ))}
            {e.language === "en" && (
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">🇬🇧 En inglés</span>
            )}
          </div>

          <h1 className="mt-3 font-display text-3xl leading-tight font-extrabold tracking-tight sm:text-5xl">{e.title}</h1>
          {e.organizer && (
            <p className="mt-2 text-muted">
              Organiza{" "}
              {e.organizer_url ? (
                <a href={e.organizer_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground hover:underline">
                  {e.organizer}
                </a>
              ) : (
                <span className="font-semibold text-foreground">{e.organizer}</span>
              )}
            </p>
          )}

          <ul className="mt-6 space-y-4">
            <li className="flex gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface">
                <CalendarDays className="size-5" />
              </span>
              <div>
                <p className="font-semibold">{longDate(e.start_at)}</p>
                <p className="text-sm text-muted">
                  <Clock className="mr-1 inline size-3.5" />
                  {timeLabel(e.start_at)}
                  {e.end_at && (sameDay ? ` – ${timeLabel(e.end_at)}` : ` → ${longDate(e.end_at)}`)}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface">
                {e.is_online ? <Globe className="size-5" /> : <MapPin className="size-5" />}
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{e.is_online ? "Online" : e.venue_name || "Ubicación"}</p>
                {!e.is_online && e.address && (
                  <p className="text-sm text-muted">
                    {e.address}{" "}
                    {mapsUrl && (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand">
                        Cómo llegar ↗
                      </a>
                    )}
                  </p>
                )}
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface">
                <Ticket className="size-5" />
              </span>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={past ? "closed" : e.status} size="lg" />
                  {price && <span className="font-semibold">{price}</span>}
                </div>
                <p className="text-sm text-muted">
                  {e.going_count != null && e.going_count > 0 && (
                    <>
                      <Users className="mr-1 inline size-3.5" />
                      {e.going_count} apuntados en {SOURCE_LABEL[e.source]}
                      {e.capacity && e.capacity >= e.going_count ? ` de ${e.capacity} plazas` : ""}
                    </>
                  )}
                  {e.waitlist_count ? ` · ${e.waitlist_count} en lista de espera` : ""}
                </p>
              </div>
            </li>
          </ul>
        </article>

        <section className="min-w-0 [grid-area:details]">
          {e.description && (
            <section>
              <h2 className="mb-2 font-display text-xl font-bold">Sobre el evento</h2>
              <div className="text-[15px] leading-relaxed whitespace-pre-line text-foreground/85">{plainText(e.description)}</div>
            </section>
          )}

          {!e.is_online && e.lat != null && e.lng != null && (
            <section className="mt-8">
              <h2 className="mb-3 font-display text-xl font-bold">Dónde</h2>
              <EventMiniMap event={e} />
            </section>
          )}

          {e.also_on.length > 0 && (
            <p className="mt-6 text-sm text-muted">
              También publicado en{" "}
              {e.also_on.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand">
                  {SOURCE_LABEL[a.source]}
                  {i < e.also_on.length - 1 ? ", " : ""}
                </a>
              ))}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
