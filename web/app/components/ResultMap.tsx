"use client";
// The map. Shows one circle per result pin. Uses OpenStreetMap tiles, so no API key is needed.
// If the map ever gives you trouble, you can delete this file and the <ResultMap> line in page.tsx:
// the rest of the app works without it.
import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Pin } from "@/lib/types";

// Roughly the middle of the Virginia Tech campus. Check it on Google Maps and adjust if needed.
const CAMPUS: [number, number] = [37.2284, -80.4234];

function FitToPins({ pins }: { pins: Pin[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 16);
      return;
    }
    map.fitBounds(
      pins.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [40, 40] }
    );
  }, [pins, map]);
  return null;
}

export default function ResultMap({ pins }: { pins: Pin[] }) {
  return (
    <MapContainer center={CAMPUS} zoom={15} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToPins pins={pins} />
      {pins.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={11}
          pathOptions={{
            color: p.agent === "dining" ? "#861F41" : "#E5751F",
            fillOpacity: 0.7,
          }}
        >
          <Popup>
            <strong>{p.title}</strong>
            <br />
            {p.detail}
            <br />
            {[p.when, p.where].filter(Boolean).join(" · ")}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
