"use client";

import dynamic from "next/dynamic";
import type { MunoEvent } from "@/app/lib/events";

// Leaflet toca `window` al cargarse, así que no puede renderizarse en el servidor.
// Este loader hace el import dinamico con ssr:false, que solo se permite desde un
// Client Component (page.tsx, al ser Server Component, no puede hacerlo directamente).
const EventMap = dynamic(() => import("@/app/components/EventMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: "480px" }}
      className="flex items-center justify-center rounded-md border border-line text-sm text-muted"
    >
      Cargando mapa…
    </div>
  ),
});

export default function EventMapLoader({ events }: { events: MunoEvent[] }) {
  return <EventMap events={events} />;
}
