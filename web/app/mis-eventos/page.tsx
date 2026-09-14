import MyEvents from "@/app/components/MyEvents";
import { getEvents } from "@/app/lib/data";

export default function MisEventosPage() {
  const events = getEvents();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-10 sm:py-16">
      <a href="/" className="text-xs uppercase tracking-wider text-muted underline decoration-1 underline-offset-2 hover:text-foreground">
        ← Volver
      </a>
      <h1 className="font-display mt-4 text-5xl leading-none">Mis eventos</h1>
      <div className="pt-10">
        <MyEvents events={events} />
      </div>
    </main>
  );
}
