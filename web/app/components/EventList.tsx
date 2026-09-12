import type { MunoEvent } from "@/app/lib/events";
import { formatEventDate, groupEventsByDay, spotsLabel, spotsUrgent } from "@/app/lib/events";

export default function EventList({ events }: { events: MunoEvent[] }) {
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
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EventRow({ event }: { event: MunoEvent }) {
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
      </div>
    </a>
  );
}
