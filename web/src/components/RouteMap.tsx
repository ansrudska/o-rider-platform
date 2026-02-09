import { useMemo } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import { decodePolyline } from "../utils/polyline";

interface RouteMapProps {
  /** Encoded polyline string (from Strava summary_polyline) */
  polyline?: string;
  /** Raw latlng array (from Strava streams) */
  latlng?: [number, number][];
  /** CSS height class or pixel value */
  height?: string;
  /** Show interactive controls */
  interactive?: boolean;
  /** Rounded corners */
  rounded?: boolean;
  /** Highlight marker position (synced from chart hover) */
  markerPosition?: [number, number] | null;
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useMemo(() => {
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, bounds]);
  return null;
}

export default function RouteMap({
  polyline,
  latlng,
  height = "h-48",
  interactive = false,
  rounded = true,
  markerPosition,
}: RouteMapProps) {
  const positions: LatLngTuple[] = useMemo(() => {
    if (latlng && latlng.length > 0) {
      return latlng as LatLngTuple[];
    }
    if (polyline && polyline.length > 0) {
      return decodePolyline(polyline) as LatLngTuple[];
    }
    return [];
  }, [polyline, latlng]);

  if (positions.length === 0) {
    return (
      <div
        className={`${height} bg-gray-100 ${rounded ? "rounded-lg" : ""} flex items-center justify-center text-gray-400 text-sm`}
      >
        경로 데이터 없음
      </div>
    );
  }

  const bounds: LatLngBoundsExpression = [
    [
      Math.min(...positions.map((p) => p[0])),
      Math.min(...positions.map((p) => p[1])),
    ],
    [
      Math.max(...positions.map((p) => p[0])),
      Math.max(...positions.map((p) => p[1])),
    ],
  ];

  return (
    <div className={`${height} ${rounded ? "rounded-lg" : ""} overflow-hidden`}>
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [20, 20] }}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        attributionControl={false}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {/* Glow layer */}
        <Polyline
          positions={positions}
          pathOptions={{
            color: "#FDBA74",
            weight: 10,
            opacity: 0.45,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
        {/* Main route line */}
        <Polyline
          positions={positions}
          pathOptions={{
            color: "#F97316",
            weight: 4,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
        {/* Hover marker from chart interaction */}
        {markerPosition && (
          <CircleMarker
            center={markerPosition}
            radius={7}
            pathOptions={{
              color: "#F97316",
              fillColor: "#ffffff",
              fillOpacity: 1,
              weight: 3,
            }}
          />
        )}
        <FitBounds bounds={bounds} />
      </MapContainer>
    </div>
  );
}
