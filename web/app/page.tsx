import AuthButton from "@/app/components/AuthButton";
import EventList from "@/app/components/EventList";
import EventMapLoader from "@/app/components/EventMapLoader";
import FeaturedEvents from "@/app/components/FeaturedEvents";
import { getEvents } from "@/app/lib/data";
import { getFeaturedEvents } from "@/app/lib/events";

// Formulario publico de envio de eventos (Google Form) -- lo rellena cualquiera, no
// hace falta cuenta. Las respuestas las recoge el scraper manual.py via el CSV publicado.
const SUBMIT_EVENT_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSefqlVtLarqYrZVDILwC_Wl_547fR0FQ6yW9ipbhgCUaP2HUg/viewform";

export default function Home() {
  const events = getEvents();
  const featured = getFeaturedEvents(events);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-10 sm:py-16">
      <header className="flex flex-col gap-3 border-b-2 border-foreground pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-6xl leading-none sm:text-7xl">muno</h1>
            <a
              href={SUBMIT_EVENT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit border border-accent px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-accent transition-colors hover:bg-accent hover:text-background"
            >
              Apunta tu evento
            </a>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <p className="font-mono text-xs uppercase tracking-wider text-muted">Madrid</p>
            <AuthButton />
          </div>
        </div>
        <p className="font-display max-w-xl text-xl italic text-muted sm:text-2xl">
          Todo el tech de Madrid en un sitio. Lo demás es ruido.
        </p>
      </header>

      {featured.length > 0 && (
        <section className="pt-10">
          <FeaturedEvents events={featured} />
        </section>
      )}

      <section className="mx-auto max-w-3xl pt-10">
        <EventList events={events} />
      </section>

      <section className="pt-16">
        <h2 className="font-display pb-4 text-2xl italic text-muted">Mapa</h2>
        <EventMapLoader events={events} />
      </section>
    </main>
  );
}
