import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

const STRAVA_CLIENT_ID = defineSecret("STRAVA_CLIENT_ID");
const STRAVA_CLIENT_SECRET = defineSecret("STRAVA_CLIENT_SECRET");

const db = admin.firestore();

// ── Helpers ──────────────────────────────────────────────────────────

async function getValidAccessToken(uid: string): Promise<string> {
  const tokenDoc = await db.doc(`users/${uid}/strava_tokens/current`).get();
  if (!tokenDoc.exists) throw new HttpsError("not-found", "Strava not connected");

  const data = tokenDoc.data()!;
  const now = Math.floor(Date.now() / 1000);

  if (data.expiresAt > now + 60) {
    return data.accessToken as string;
  }

  // Refresh token
  const resp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID.value(),
      client_secret: STRAVA_CLIENT_SECRET.value(),
      grant_type: "refresh_token",
      refresh_token: data.refreshToken,
    }),
  });

  if (!resp.ok) throw new HttpsError("internal", "Strava token refresh failed");

  const tokens = await resp.json();
  await db.doc(`users/${uid}/strava_tokens/current`).update({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_at,
  });

  return tokens.access_token as string;
}

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  start_date: string;
  start_date_local: string;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  max_watts?: number;
  weighted_average_watts?: number;
  average_cadence?: number;
  kilojoules?: number;
  map?: { summary_polyline: string };
}

function convertStravaActivity(sa: StravaActivity, uid: string, nickname: string) {
  const startTime = new Date(sa.start_date).getTime();
  return {
    userId: uid,
    nickname,
    profileImage: null,
    type: "ride" as const,
    createdAt: startTime,
    startTime,
    endTime: startTime + sa.elapsed_time * 1000,
    summary: {
      distance: sa.distance,
      ridingTimeMillis: sa.moving_time * 1000,
      averageSpeed: sa.average_speed * 3.6,
      maxSpeed: sa.max_speed * 3.6,
      averageCadence: sa.average_cadence ?? null,
      maxCadence: null,
      averageHeartRate: sa.average_heartrate ?? null,
      maxHeartRate: sa.max_heartrate ?? null,
      averagePower: sa.average_watts ?? null,
      maxPower: sa.max_watts ?? null,
      normalizedPower: sa.weighted_average_watts ?? null,
      elevationGain: sa.total_elevation_gain,
      calories: sa.kilojoules ? Math.round(sa.kilojoules * 1.045) : null,
      relativeEffort: null,
    },
    thumbnailTrack: sa.map?.summary_polyline ?? "",
    groupId: null,
    groupRideId: null,
    photoCount: 0,
    kudosCount: 0,
    commentCount: 0,
    segmentEffortCount: 0,
    description: sa.name,
    visibility: "everyone" as const,
    gpxPath: null,
    source: "strava" as const,
    stravaActivityId: sa.id,
  };
}

// ── Callables ────────────────────────────────────────────────────────

export const stravaExchangeToken = onCall(
  { secrets: [STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

    const { code } = request.data as { code: string };
    if (!code) throw new HttpsError("invalid-argument", "code is required");

    const body = {
      client_id: STRAVA_CLIENT_ID.value(),
      client_secret: STRAVA_CLIENT_SECRET.value(),
      code,
      grant_type: "authorization_code",
    };
    console.log("Strava token exchange request:", { client_id: body.client_id, code: code.substring(0, 8) + "...", grant_type: body.grant_type });

    const resp = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("Strava token exchange failed:", resp.status, err);
      throw new HttpsError("internal", `Strava token exchange failed: ${err}`);
    }

    const data = await resp.json();
    const uid = request.auth.uid;

    // Save tokens (server-only)
    await db.doc(`users/${uid}/strava_tokens/current`).set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      athleteId: data.athlete.id,
    });

    // Update user profile
    await db.doc(`users/${uid}`).set(
      {
        stravaConnected: true,
        stravaAthleteId: data.athlete.id,
        stravaNickname: `${data.athlete.firstname} ${data.athlete.lastname}`.trim(),
      },
      { merge: true },
    );

    return {
      athleteId: data.athlete.id,
      firstname: data.athlete.firstname,
      lastname: data.athlete.lastname,
    };
  },
);

export const stravaImportActivities = onCall(
  { secrets: [STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

    const uid = request.auth.uid;
    const { page = 1, perPage = 30 } = request.data as { page?: number; perPage?: number };
    const accessToken = await getValidAccessToken(uid);

    const resp = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!resp.ok) throw new HttpsError("internal", "Strava API call failed");

    const stravaActivities: StravaActivity[] = await resp.json();
    const rides = stravaActivities.filter(
      (a) => a.type === "Ride" || a.type === "VirtualRide",
    );

    // Get user nickname
    const userDoc = await db.doc(`users/${uid}`).get();
    const nickname = userDoc.data()?.nickname ?? "Rider";

    const batch = db.batch();
    let imported = 0;

    for (const sa of rides) {
      const docId = `strava_${sa.id}`;
      const docRef = db.doc(`activities/${docId}`);
      const existing = await docRef.get();
      if (existing.exists) continue;

      batch.set(docRef, convertStravaActivity(sa, uid, nickname));
      imported++;
    }

    if (imported > 0) await batch.commit();

    return { imported, total: rides.length };
  },
);

export const stravaGetActivityStreams = onCall(
  { secrets: [STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

    const uid = request.auth.uid;
    const { stravaActivityId } = request.data as { stravaActivityId: number };
    if (!stravaActivityId) throw new HttpsError("invalid-argument", "stravaActivityId required");

    // Check cache
    const cacheDocId = `strava_${stravaActivityId}`;
    const cacheRef = db.doc(`activity_streams/${cacheDocId}`);
    const cached = await cacheRef.get();
    if (cached.exists) return cached.data();

    const accessToken = await getValidAccessToken(uid);

    const resp = await fetch(
      `https://www.strava.com/api/v3/activities/${stravaActivityId}/streams?keys=latlng,altitude,heartrate,watts,cadence,velocity_smooth,time,distance&key_by_type=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!resp.ok) throw new HttpsError("internal", "Strava streams API failed");

    const streams = await resp.json();
    const streamData: Record<string, unknown> = { userId: uid };

    for (const [key, value] of Object.entries(streams)) {
      streamData[key] = (value as { data: unknown }).data;
    }

    // Cache if under 1MB (Firestore doc limit)
    const jsonSize = JSON.stringify(streamData).length;
    if (jsonSize < 1_000_000) {
      await cacheRef.set(streamData);
    }

    return streamData;
  },
);

export const stravaDisconnect = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

  const uid = request.auth.uid;

  await db.doc(`users/${uid}/strava_tokens/current`).delete();
  await db.doc(`users/${uid}`).set(
    { stravaConnected: false, stravaAthleteId: null, stravaNickname: null },
    { merge: true },
  );

  return { success: true };
});
