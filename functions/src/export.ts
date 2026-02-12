import { onCall, HttpsError } from "firebase-functions/v2/https";

const ALLOWED_HOSTS = [
  "dgalywyr863hv.cloudfront.net",  // Strava CDN (primary)
  "d3o5xota0a1fcr.cloudfront.net", // Strava CDN (legacy)
  "d1fv7zhqf71wlq.cloudfront.net", // Strava CDN (alt)
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export const proxyPhotoDownload = onCall(
  { timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

    const { url } = request.data as { url: string };
    if (!url || typeof url !== "string") {
      throw new HttpsError("invalid-argument", "url is required");
    }

    // Validate URL against allowlist (SSRF prevention)
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new HttpsError("invalid-argument", "Invalid URL");
    }

    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      throw new HttpsError("permission-denied", `Host not allowed: ${parsed.hostname}`);
    }

    // Fetch image
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new HttpsError("internal", `Photo fetch failed: ${resp.status}`);
    }

    const contentType = resp.headers.get("content-type") ?? "image/jpeg";
    const contentLength = parseInt(resp.headers.get("content-length") ?? "0", 10);
    if (contentLength > MAX_SIZE) {
      throw new HttpsError("resource-exhausted", "Photo too large");
    }

    const buffer = await resp.arrayBuffer();
    if (buffer.byteLength > MAX_SIZE) {
      throw new HttpsError("resource-exhausted", "Photo too large");
    }

    // Convert to base64
    const base64 = Buffer.from(buffer).toString("base64");

    return { data: base64, contentType };
  },
);
