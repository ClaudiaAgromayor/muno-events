import { formatEventDate, spotsLabel, spotsUrgent, type MunoEvent } from "@/app/lib/events";

export default function FeaturedEvents({ events }: { events: MunoEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className="border-b-2 border-foreground pb-10">
      <h2 className="font-display pb-4 text-2xl italic text-muted">Esta semana</h2>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {events.map((event) => {
          const parts = event.start_at ? formatEventDate(event.start_at) : null;
          const spots = spotsLabel(event);
          const urgent = spotsUrgent(event);
          return (
            <a
              key={event.id}
              href={event.url ? `/ir/${encodeURIComponent(event.id)}` : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-64 flex-shrink-0 flex-col gap-2 border border-foreground p-4 transition-colors hover:bg-foreground"
            >
              {parts && (
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted group-hover:text-background/70">
                  {parts.weekday} {parts.day} {parts.monthLabel}
                  {parts.time ? ` · ${parts.time}` : ""}
                </span>
              )}
              <span className="font-display text-xl italic leading-tight group-hover:text-background">
                {event.name}
              </span>
              {event.address && (
                <span className="text-xs text-muted group-hover:text-background/70">{event.address}</span>
              )}
              {spots && (
                <span
                  className={`font-mono text-xs font-medium group-hover:text-background ${urgent ? "text-accent" : "text-ok"}`}
                >
                  {spots}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </section>
  );
}
