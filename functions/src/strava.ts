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
    const { page = 1, perPage = 200 } = request.data as {
      page?: number;
      perPage?: number;
    };
    const accessToken = await getValidAccessToken(uid);

    console.log(`[stravaImport] uid=${uid} page=${page} perPage=${perPage}`);

    const resp = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[stravaImport] Strava API failed: ${resp.status} ${errText}`);
      throw new HttpsError("internal", `Strava API failed: ${resp.status}`);
    }

    const stravaActivities: StravaActivity[] = await resp.json();
    console.log(`[stravaImport] Page ${page}: ${stravaActivities.length} activities returned from API`);

    if (stravaActivities.length === 0) {
      return { imported: 0, rides: 0, totalActivities: 0, hasMore: false };
    }

    // Broader cycling filter
    const CYCLING_TYPES = ["Ride", "VirtualRide", "EBikeRide", "Handcycle", "Velomobile"];
    const rides = stravaActivities.filter((a) => CYCLING_TYPES.includes(a.type));

    // Log date range for debugging
    if (rides.length > 0) {
      const newest = rides[0].start_date_local;
      const oldest = rides[rides.length - 1].start_date_local;
      console.log(`[stravaImport] Page ${page}: ${rides.length} rides (${newest} ~ ${oldest})`);
    }
    // Log non-ride types for debugging
    const otherTypes = [...new Set(stravaActivities.filter((a) => !CYCLING_TYPES.includes(a.type)).map((a) => a.type))];
    if (otherTypes.length > 0) {
      console.log(`[stravaImport] Page ${page}: skipped types: ${otherTypes.join(", ")}`);
    }

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

    const hasMore = stravaActivities.length >= perPage;
    console.log(`[stravaImport] Page ${page} done: ${imported} imported, ${rides.length} rides, hasMore=${hasMore}`);

    return { imported, rides: rides.length, totalActivities: stravaActivities.length, hasMore };
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
    if (cached.exists) {
      const cachedData = cached.data()!;
      if (typeof cachedData.json === "string") {
        const parsed = JSON.parse(cachedData.json);
        // Cache must include segment_efforts (added in v2)
        if ("segment_efforts" in parsed) {
          return parsed;
        }
        console.log(`[stravaStreams] Cache missing segments for ${stravaActivityId}, re-fetching`);
        await cacheRef.delete();
      } else {
        console.log(`[stravaStreams] Old cache for ${stravaActivityId}, re-fetching`);
        await cacheRef.delete();
      }
    }

    const accessToken = await getValidAccessToken(uid);
    const headers = { Authorization: `Bearer ${accessToken}` };

    // Fetch streams and activity detail (for segment efforts) in parallel
    const [streamsResp, detailResp] = await Promise.all([
      fetch(
        `https://www.strava.com/api/v3/activities/${stravaActivityId}/streams?keys=latlng,altitude,heartrate,watts,cadence,velocity_smooth,time,distance&key_by_type=true`,
        { headers },
      ),
      fetch(
        `https://www.strava.com/api/v3/activities/${stravaActivityId}?include_all_efforts=true`,
        { headers },
      ),
    ]);

    if (!streamsResp.ok) throw new HttpsError("internal", "Strava streams API failed");

    const streams = await streamsResp.json();
    const streamData: Record<string, unknown> = { userId: uid };

    if (Array.isArray(streams)) {
      for (const stream of streams) {
        const s = stream as { type: string; data: unknown };
        streamData[s.type] = s.data;
      }
    } else {
      for (const [key, value] of Object.entries(streams)) {
        streamData[key] = (value as { data: unknown }).data;
      }
    }

    // Extract segment efforts from activity detail
    if (detailResp.ok) {
      const detail = await detailResp.json();
      interface StravaSegmentEffort {
        id: number;
        name: string;
        elapsed_time: number;
        moving_time: number;
        distance: number;
        start_index: number;
        end_index: number;
        average_watts?: number;
        average_heartrate?: number;
        max_heartrate?: number;
        average_cadence?: number;
        pr_rank?: number | null;
        kom_rank?: number | null;
        achievements?: { type_id: number; type: string; rank: number }[];
        segment: {
          id: number;
          name: string;
          distance: number;
          average_grade: number;
          maximum_grade: number;
          elevation_high: number;
          elevation_low: number;
          climb_category: number;
          city?: string;
          state?: string;
          starred: boolean;
        };
      }
      const efforts = (detail.segment_efforts ?? []) as StravaSegmentEffort[];
      streamData.segment_efforts = efforts.map((e) => ({
        id: e.id,
        name: e.name,
        elapsedTime: e.elapsed_time * 1000,
        movingTime: e.moving_time * 1000,
        distance: e.distance,
        startIndex: e.start_index,
        endIndex: e.end_index,
        averageWatts: e.average_watts ?? null,
        averageHeartrate: e.average_heartrate ?? null,
        maxHeartrate: e.max_heartrate ?? null,
        averageCadence: e.average_cadence ?? null,
        prRank: e.pr_rank ?? null,
        komRank: e.kom_rank ?? null,
        achievements: e.achievements ?? [],
        segment: {
          id: e.segment.id,
          name: e.segment.name,
          distance: e.segment.distance,
          averageGrade: e.segment.average_grade,
          maximumGrade: e.segment.maximum_grade,
          elevationHigh: e.segment.elevation_high,
          elevationLow: e.segment.elevation_low,
          climbCategory: e.segment.climb_category,
          starred: e.segment.starred,
        },
      }));
      console.log(`[stravaStreams] activity=${stravaActivityId} segments=${efforts.length}`);

      // ── Step 1: Save segments & efforts to O-Rider DB ──
      const latlngArr = streamData.latlng as [number, number][] | undefined;
      const batch = db.batch();
      let segSaved = 0;
      let effortSaved = 0;

      for (const e of efforts) {
        const seg = e.segment;
        const segDocId = `strava_${seg.id}`;
        const segRef = db.doc(`segments/${segDocId}`);

        // Derive start/end GPS from stream latlng using effort indices
        const startLatlng = latlngArr?.[e.start_index] ?? null;
        const endLatlng = latlngArr?.[e.end_index] ?? null;

        // Upsert segment (merge to keep existing data like polyline)
        batch.set(segRef, {
          name: seg.name,
          distance: seg.distance,
          averageGrade: seg.average_grade,
          maximumGrade: seg.maximum_grade,
          elevationHigh: seg.elevation_high,
          elevationLow: seg.elevation_low,
          climbCategory: seg.climb_category,
          city: seg.city ?? null,
          state: seg.state ?? null,
          startLatlng: startLatlng,
          endLatlng: endLatlng,
          source: "strava",
          stravaSegmentId: seg.id,
          updatedAt: Date.now(),
        }, { merge: true });
        segSaved++;

        // Save effort
        const effortDocId = `strava_${e.id}`;
        const effortRef = db.doc(`segment_efforts/${segDocId}/${effortDocId}`);
        const startDate = detail.start_date
          ? new Date(detail.start_date as string).getTime()
          : Date.now();

        batch.set(effortRef, {
          segmentId: segDocId,
          activityId: `strava_${stravaActivityId}`,
          userId: uid,
          elapsedTime: e.elapsed_time * 1000,
          movingTime: e.moving_time * 1000,
          distance: e.distance,
          averageSpeed: e.distance > 0 && e.moving_time > 0
            ? (e.distance / e.moving_time) * 3.6 : 0,
          averageWatts: e.average_watts ?? null,
          averageHeartrate: e.average_heartrate ?? null,
          maxHeartrate: e.max_heartrate ?? null,
          averageCadence: e.average_cadence ?? null,
          prRank: e.pr_rank ?? null,
          komRank: e.kom_rank ?? null,
          startDate,
          source: "strava",
          stravaEffortId: e.id,
          createdAt: Date.now(),
        }, { merge: true });
        effortSaved++;
      }

      if (segSaved > 0 || effortSaved > 0) {
        await batch.commit();
        console.log(`[stravaStreams] Saved ${segSaved} segments, ${effortSaved} efforts to DB`);
      }
    }

    console.log(`[stravaStreams] activity=${stravaActivityId} keys=${Object.keys(streamData).filter((k) => k !== "userId").join(",")}`);

    // Cache as JSON string (avoids nested array & index limit issues)
    const jsonStr = JSON.stringify(streamData);
    if (jsonStr.length < 1_000_000) {
      await cacheRef.set({ userId: uid, json: jsonStr });
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
