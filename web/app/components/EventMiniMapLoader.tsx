"use client";

import dynamic from "next/dynamic";

const EventMiniMap = dynamic(() => import("@/app/components/EventMiniMap"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "160px" }} className="flex items-center justify-center border border-line text-xs text-muted">
      Cargando mapa…
    </div>
  ),
});

export default function EventMiniMapLoader({ lat, lng }: { lat: number; lng: number }) {
  return <EventMiniMap lat={lat} lng={lng} />;
}
