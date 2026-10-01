"use client";

import dynamic from "next/dynamic";
import type { MunoEvent } from "@/app/lib/events";

const EventsMap = dynamic(() => import("@/app/components/EventsMap"), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-2xl bg-surface-2" />,
});

export default function EventMiniMap({ event }: { event: MunoEvent }) {
  return <EventsMap events={[event]} height="224px" />;
}
