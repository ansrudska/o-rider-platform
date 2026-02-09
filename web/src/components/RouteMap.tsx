import { useMemo } from "react";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
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
        <Polyline
          positions={positions}
          pathOptions={{
            color: "#F97316",
            weight: 3,
            opacity: 0.9,
          }}
        />
        <FitBounds bounds={bounds} />
      </MapContainer>
    </div>
  );
}
