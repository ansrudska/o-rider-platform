import { useMemo } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import L from "leaflet";
import { decodePolyline } from "../utils/polyline";

export interface PhotoMarker {
  id: string;
  url: string;
  location: [number, number];
  caption?: string | null;
}

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
  /** Photo markers on the route */
  photos?: PhotoMarker[];
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useMemo(() => {
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, bounds]);
  return null;
}

function createPhotoIcon(url: string) {
  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
    html: `<div style="width:36px;height:36px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);overflow:hidden;background:#f3f4f6;">
      <img src="${url}" style="width:100%;height:100%;object-fit:cover;" />
    </div>`,
  });
}

export default function RouteMap({
  polyline,
  latlng,
  height = "h-48",
  interactive = false,
  rounded = true,
  markerPosition,
  photos,
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
        {/* Photo markers */}
        {photos?.map((photo) => (
          <Marker
            key={photo.id}
            position={photo.location}
            icon={createPhotoIcon(photo.url)}
          >
            <Popup minWidth={240} maxWidth={320} autoPan={false}>
              <div style={{ margin: "-14px -20px -14px -20px" }}>
                <img
                  src={photo.url}
                  alt={photo.caption || ""}
                  style={{ width: "100%", borderRadius: "4px" }}
                />
                {photo.caption && (
                  <p style={{ margin: "8px 12px", fontSize: "12px", color: "#374151" }}>{photo.caption}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
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
