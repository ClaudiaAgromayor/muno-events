"use client";

import Link from "next/link";
import { Check, MapPin, Star } from "lucide-react";
import { AvatarStack, Cover, StatusBadge } from "@/app/components/ui";
import type { EventSocial, RsvpStatus } from "@/app/components/useSocial";
import { eventPath, kindInfo, priceLabel, shortDate, timeLabel, type MunoEvent } from "@/app/lib/events";

export function EventCard({
  event,
  social,
  onRsvp,
  showDate = false,
}: {
  event: MunoEvent;
  social: EventSocial;
  onRsvp: (status: RsvpStatus) => void;
  showDate?: boolean;
}) {
  const kind = kindInfo(event.kind);
  const price = priceLabel(event);
  const d = shortDate(event.start_at);
  const muno = social.going + social.interested;

  return (
    <article className="group relative flex gap-4 rounded-2xl border border-line bg-surface p-3 transition hover:border-foreground/25 hover:shadow-sm sm:p-4">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
          {showDate && (
            <span className="text-foreground">
              {d.weekday} {d.day} {d.month} ·
            </span>
          )}
          <span className="text-brand">{timeLabel(event.start_at)}</span>
          {event.organizer && <span className="truncate">· {event.organizer}</span>}
        </p>

        <h3 className="mt-0.5 line-clamp-2 text-[17px] leading-snug font-semibold">
          <Link href={eventPath(event.id)} className="after:absolute after:inset-0">
            {event.title}
          </Link>
        </h3>

        <p className="mt-1 flex items-center gap-1 truncate text-[13px] text-muted">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{event.is_online ? "Online" : event.venue_name || event.address || "Madrid"}</span>
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium">
            {kind.emoji} {kind.label.replace(/s$/, "")}
          </span>
          {price && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                event.is_free ? "bg-brand-soft text-brand" : "bg-surface-2"
              }`}
            >
              {price}
            </span>
          )}
          {event.status !== "open" && <StatusBadge status={event.status} />}
          {event.language === "en" && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium">🇬🇧 EN</span>
          )}
        </div>

        {muno > 0 && (
          <div className="mt-2.5 flex items-center gap-2 text-[12px] text-muted">
            <AvatarStack
              people={social.people.map((p) => ({ name: p.name, url: p.url }))}
              extra={muno - Math.min(4, social.people.length)}
              size={20}
            />
            <span>
              {social.going > 0 && `${social.going} ${social.going === 1 ? "va" : "van"}`}
              {social.going > 0 && social.interested > 0 && " · "}
              {social.interested > 0 && `${social.interested} interesad${social.interested === 1 ? "o" : "os"}`}
              {" en muno"}
            </span>
          </div>
        )}
      </div>

      <div className="relative flex shrink-0 flex-col items-end gap-2">
        <Cover src={event.image_url} title={event.title} className="size-24 rounded-xl sm:size-28" />
        <div className="relative z-10 flex gap-1.5">
          <button
            type="button"
            onClick={() => onRsvp("interested")}
            aria-label="Me interesa"
            title="Me interesa"
            className={`flex size-8 items-center justify-center rounded-full border transition ${
              social.mine === "interested"
                ? "animate-pop border-warn bg-warn-soft text-warn"
                : "border-line text-muted hover:text-foreground"
            }`}
          >
            <Star className="size-4" fill={social.mine === "interested" ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            onClick={() => onRsvp("going")}
            className={`flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold transition ${
              social.mine === "going"
                ? "animate-pop bg-ok text-white"
                : "bg-foreground text-background hover:opacity-90"
            }`}
          >
            {social.mine === "going" ? (
              <>
                <Check className="size-4" /> Voy
              </>
            ) : (
              "Voy"
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
