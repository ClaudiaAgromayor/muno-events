"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { canJoin, eventPath, kindInfo, shortDate, type MunoEvent } from "@/app/lib/events";

const MADRID: [number, number] = [40.4168, -3.7038];

function pin(emoji: string, full: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;background:${
      full ? "#9ca3af" : "#6d4aff"
    };border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);font-size:16px">${emoji}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}

export default function EventsMap({ events, height = "70vh" }: { events: MunoEvent[]; height?: string }) {
  const located = events.filter((e) => e.lat != null && e.lng != null);
  const single = located.length === 1 ? located[0] : null;
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <MapContainer
        center={single ? [single.lat!, single.lng!] : MADRID}
        zoom={single ? 15 : 12}
        scrollWheelZoom={!single}
        style={{ height, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {located.map((e) => {
          const d = shortDate(e.start_at);
          return (
            <Marker key={e.id} position={[e.lat!, e.lng!]} icon={pin(kindInfo(e.kind).emoji, !canJoin(e.status))}>
              {!single && (
                <Popup>
                  <a href={eventPath(e.id)} style={{ color: "inherit", textDecoration: "none" }}>
                    <div style={{ fontSize: 12, color: "#6d4aff", fontWeight: 600 }}>
                      {d.weekday} {d.day} {d.month} · {d.time}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{e.title}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{e.venue_name ?? e.address}</div>
                  </a>
                </Popup>
              )}
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
