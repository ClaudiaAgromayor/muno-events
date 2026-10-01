"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Share2, Star, Users } from "lucide-react";
import EventPhotos from "@/app/e/[id]/EventPhotos";
import { useSession } from "@/app/components/Session";
import { useToast } from "@/app/components/Toast";
import { Avatar } from "@/app/components/ui";
import { useSocial, type RsvpStatus } from "@/app/components/useSocial";
import { SOURCE_LABEL, eventPath, type MunoEvent } from "@/app/lib/events";

export default function EventActions({ event, past }: { event: MunoEvent; past: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const social = useSocial([event.id]);
  const s = social.get(event.id);
  const [groupOpen, setGroupOpen] = useState(false);

  const need = () => {
    if (user) return false;
    router.push(`/entrar?next=${encodeURIComponent(eventPath(event.id))}`);
    return true;
  };
  const rsvp = (status: RsvpStatus) => !need() && social.setStatus(event, status);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    }
  };

  const platform = SOURCE_LABEL[event.source];
  const cta =
    event.status === "waitlist"
      ? `Apuntarme a la lista de espera en ${platform}`
      : event.status === "sold_out"
        ? `Agotado · ver en ${platform}`
        : event.status === "closed" || event.status === "cancelled"
          ? `Ver en ${platform}`
          : `Conseguir entrada en ${platform}`;
  const ctaMuted = ["sold_out", "closed", "cancelled"].includes(event.status);

  const goingPeople = s.people.filter((p) => p.status === "going");
  const anonGoing = s.going - goingPeople.length;

  return (
    <div className="space-y-4">
      {!past && event.url && (
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-center font-semibold transition ${
            ctaMuted ? "border border-line bg-surface text-muted" : "bg-brand text-white shadow-sm hover:opacity-90"
          }`}
        >
          {cta} <ArrowUpRight className="size-4" />
        </a>
      )}

      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold">{past ? "¿Fuiste?" : "¿Te vienes? Avisa a tu gente en muno"}</p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => rsvp("going")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 font-semibold transition ${
              s.mine === "going" ? "animate-pop bg-ok text-white" : "bg-foreground text-background hover:opacity-90"
            }`}
          >
            {s.mine === "going" && <Check className="size-4" />}
            {past ? (s.mine === "going" ? "Fui" : "Yo fui") : "Voy"}
          </button>
          {!past && (
            <button
              onClick={() => rsvp("interested")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 font-semibold transition ${
                s.mine === "interested" ? "animate-pop border-warn bg-warn-soft text-warn" : "border-line hover:border-foreground/40"
              }`}
            >
              <Star className="size-4" fill={s.mine === "interested" ? "currentColor" : "none"} />
              Me interesa
            </button>
          )}
          <button
            onClick={share}
            aria-label="Compartir"
            className="flex items-center justify-center rounded-xl border border-line px-3.5 hover:border-foreground/40"
          >
            <Share2 className="size-4" />
          </button>
        </div>

        {!past && social.groups.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setGroupOpen((o) => !o)} className="flex items-center gap-1.5 text-sm font-medium text-brand">
              <Users className="size-4" /> Ir con mi comunidad
            </button>
            {groupOpen && (
              <div className="mt-2 flex flex-wrap gap-2">
                {social.groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      social.goWithGroup(event, g);
                      setGroupOpen(false);
                    }}
                    className="rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:border-brand hover:text-brand"
                  >
                    {g.emoji} {g.name}
                  </button>
                ))}
                <p className="w-full text-xs text-muted">Apunta a todos los miembros de golpe.</p>
              </div>
            )}
          </div>
        )}

        {(s.going > 0 || s.interested > 0) && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm font-semibold">
              {past ? "Quién fue" : "Quién va"} · {s.going}
              {s.interested > 0 && !past && <span className="font-normal text-muted"> · {s.interested} interesados</span>}
            </p>
            <ul className="mt-2 space-y-2">
              {goingPeople.slice(0, 12).map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={p.name} url={p.url} size={28} />
                  {p.name}
                </li>
              ))}
            </ul>
            {anonGoing > 0 && (
              <p className="mt-2 text-xs text-muted">
                + {anonGoing} {anonGoing === 1 ? "persona" : "personas"} con el nombre oculto
              </p>
            )}
          </div>
        )}
      </div>

      {past && <EventPhotos event={event} attended={s.mine === "going"} />}
    </div>
  );
}
