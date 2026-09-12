import EventList from "@/app/components/EventList";
import { getEvents } from "@/app/lib/data";

export default function Home() {
  const events = getEvents();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12 sm:px-10 sm:py-16">
      <header className="flex flex-col gap-3 border-b-2 border-foreground pb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-display text-6xl leading-none sm:text-7xl">muno</h1>
          <p className="text-xs uppercase tracking-wider text-muted">Madrid</p>
        </div>
        <p className="font-display max-w-xl text-xl italic text-muted sm:text-2xl">
          Eventos de tech, IA y ML en Madrid. Curados a mano, sin genéricos ni relleno.
        </p>
      </header>

      <section className="pt-10">
        <EventList events={events} />
      </section>
    </main>
  );
}
