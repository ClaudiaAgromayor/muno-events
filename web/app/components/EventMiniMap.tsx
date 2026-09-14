"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker } from "react-leaflet";

function pinIcon() {
  return L.divIcon({
    className: "",
    html: `<svg width="22" height="29" viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 33C13 33 24 20.8 24 13C24 6.37258 18.9036 1 13 1C7.09644 1 2 6.37258 2 13C2 20.8 13 33 13 33Z" fill="#1b1b1f" stroke="white" stroke-width="1.5"/>
      <circle cx="13" cy="13" r="5" fill="white"/>
    </svg>`,
    iconSize: [22, 29],
    iconAnchor: [11, 28],
  });
}

export default function EventMiniMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom={false}
      dragging={false}
      zoomControl={false}
      style={{ height: "160px", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={pinIcon()} />
    </MapContainer>
  );
}
