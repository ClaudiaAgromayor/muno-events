import AuthButton from "@/app/components/AuthButton";
import EventList from "@/app/components/EventList";
import EventMapLoader from "@/app/components/EventMapLoader";
import FeaturedEvents from "@/app/components/FeaturedEvents";
import { getEvents } from "@/app/lib/data";
import { getFeaturedEvents } from "@/app/lib/events";

export default function Home() {
  const events = getEvents();
  const featured = getFeaturedEvents(events);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-10 sm:py-16">
      <header className="flex flex-col gap-3 border-b-2 border-foreground pb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-display text-6xl leading-none sm:text-7xl">muno</h1>
          <div className="flex flex-col items-end gap-1.5">
            <p className="text-xs uppercase tracking-wider text-muted">Madrid</p>
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
