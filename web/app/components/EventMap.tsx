"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { MunoEvent } from "@/app/lib/events";
import { formatEventDate, spotsLabel, spotsUrgent } from "@/app/lib/events";

const MADRID_CENTER: [number, number] = [40.4168, -3.7038];

function pinIcon(urgent: boolean) {
  const color = urgent ? "#8a3a1f" : "#1b1b1f";
  return L.divIcon({
    className: "",
    html: `<svg width="26" height="34" viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 33C13 33 24 20.8 24 13C24 6.37258 18.9036 1 13 1C7.09644 1 2 6.37258 2 13C2 20.8 13 33 13 33Z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="13" cy="13" r="5" fill="white"/>
    </svg>`,
    iconSize: [26, 34],
    iconAnchor: [13, 33],
    popupAnchor: [0, -30],
  });
}

export default function EventMap({ events }: { events: MunoEvent[] }) {
  const located = events.filter((e): e is MunoEvent & { lat: number; lng: number } => e.lat != null && e.lng != null);

  return (
    <MapContainer
      center={MADRID_CENTER}
      zoom={12}
      scrollWheelZoom={false}
      style={{ height: "480px", width: "100%", borderRadius: "6px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {located.map((event) => {
        const date = event.start_at ? formatEventDate(event.start_at) : null;
        const spots = spotsLabel(event);
        const urgent = spotsUrgent(event);
        return (
          <Marker key={event.id} position={[event.lat, event.lng]} icon={pinIcon(urgent)}>
            <Popup>
              <div style={{ fontFamily: "var(--font-body), sans-serif", minWidth: "180px" }}>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>{event.name}</div>
                <div style={{ fontSize: "13px", color: "#666" }}>
                  {date && (date.weekday + " " + date.day + " " + date.monthLabel + (date.time ? " · " + date.time : ""))}
                </div>
                {event.address && <div style={{ fontSize: "13px", color: "#666" }}>{event.address}</div>}
                {spots && (
                  <div style={{ fontSize: "12px", fontWeight: 500, marginTop: "4px", color: urgent ? "#8a3a1f" : "#2d6a4f" }}>
                    {spots}
                  </div>
                )}
                <a
                  href={`/ir/${encodeURIComponent(event.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-block", marginTop: "6px", fontSize: "13px", textDecoration: "underline" }}
                >
                  Ver evento
                </a>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
