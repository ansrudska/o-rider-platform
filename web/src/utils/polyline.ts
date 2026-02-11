/**
 * Decode a track string to [lat, lng] array.
 * Supports both "lat,lon;lat,lon;..." (O-Rider) and Google Encoded Polyline (Strava).
 */
export function decodeTrack(str: string): [number, number][] {
  if (!str || str.length === 0) return [];

  // O-Rider format: "lat,lon;lat,lon;..."
  if (str.includes(";") && str.includes(",")) {
    const points: [number, number][] = [];
    for (const pair of str.split(";")) {
      const parts = pair.split(",");
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          points.push([lat, lng]);
        }
      }
    }
    if (points.length > 0) return points;
  }

  // Fallback: Google Encoded Polyline
  return decodePolyline(str);
}

/**
 * Decode Google Encoded Polyline to [lat, lng] array.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}
