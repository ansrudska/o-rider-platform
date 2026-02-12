import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
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
  total_photo_count?: number;
  achievement_count?: number;
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
    photoCount: sa.total_photo_count ?? 0,
    kudosCount: 0,
    commentCount: 0,
    segmentEffortCount: sa.achievement_count ?? 0,
    description: sa.name,
    visibility: "everyone" as string,
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
  { secrets: [STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET], timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

    const uid = request.auth.uid;
    const { page = 1, perPage = 200, after, migrationMode } = request.data as {
      page?: number;
      perPage?: number;
      after?: number;
      migrationMode?: boolean;
    };
    const accessToken = await getValidAccessToken(uid);

    let url = `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`;
    if (after) url += `&after=${after}`;

    console.log(`[stravaImport] uid=${uid} page=${page} perPage=${perPage} after=${after ?? "none"} migration=${migrationMode ?? false}`);

    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[stravaImport] Strava API failed: ${resp.status} ${errText}`);

      // Rate limited — return retry info instead of failing
      if (resp.status === 429) {
        const rateLimit = parseRateLimitHeaders(resp);
        const check = checkRateLimit(rateLimit);
        console.log(`[stravaImport] Rate limited: 15min=${rateLimit.usage15min}/${rateLimit.limit15min} daily=${rateLimit.usageDaily}/${rateLimit.limitDaily}`);
        return {
          imported: 0, skipped: 0, rides: 0, totalActivities: 0,
          hasMore: true, photos: 0, achievements: 0,
          rateLimited: true,
          retryAfterSeconds: check.retryAfterSeconds || 60,
        };
      }

      if (migrationMode) {
        await db.doc(`users/${uid}`).set(
          { migration: { status: "FAILED", progress: { updatedAt: Date.now() } } },
          { merge: true },
        );
      }
      throw new HttpsError("internal", `Strava API failed: ${resp.status}`);
    }

    const stravaActivities: StravaActivity[] = await resp.json();
    console.log(`[stravaImport] Page ${page}: ${stravaActivities.length} activities returned from API`);

    if (stravaActivities.length === 0) {
      return { imported: 0, skipped: 0, rides: 0, totalActivities: 0, hasMore: false, photos: 0, achievements: 0 };
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

    // Get user profile
    const userDoc = await db.doc(`users/${uid}`).get();
    const userData = userDoc.data();
    const nickname = userData?.nickname ?? "Rider";
    const defaultVisibility = userData?.defaultVisibility ?? "everyone";

    const batch = db.batch();
    let imported = 0;
    let skipped = 0;
    let photos = 0;
    let achievements = 0;

    for (const sa of rides) {
      const docId = `strava_${sa.id}`;
      const docRef = db.doc(`activities/${docId}`);
      const existing = await docRef.get();
      if (existing.exists) {
        skipped++;
        continue;
      }

      const activityData = convertStravaActivity(sa, uid, nickname);
      activityData.visibility = defaultVisibility;
      batch.set(docRef, activityData);
      imported++;
      photos += sa.total_photo_count ?? 0;
      achievements += sa.achievement_count ?? 0;
    }

    if (imported > 0) await batch.commit();

    const hasMore = stravaActivities.length >= perPage;

    // Update migration progress in user document
    if (migrationMode) {
      await db.doc(`users/${uid}`).set(
        {
          migration: {
            progress: {
              importedActivities: admin.firestore.FieldValue.increment(imported),
              skippedActivities: admin.firestore.FieldValue.increment(skipped),
              currentPage: page,
              updatedAt: Date.now(),
            },
          },
        },
        { merge: true },
      );
    }

    // Parse rate limit from response headers
    const rateLimit = parseRateLimitHeaders(resp);
    const rateLimitCheck = checkRateLimit(rateLimit);

    console.log(`[stravaImport] Page ${page} done: ${imported} imported, ${skipped} skipped, ${rides.length} rides, hasMore=${hasMore} rateLimit=${rateLimit.usage15min}/${rateLimit.limit15min}`);

    return {
      imported, skipped, rides: rides.length, totalActivities: stravaActivities.length, hasMore, photos, achievements,
      rateLimited: rateLimitCheck.paused,
      retryAfterSeconds: rateLimitCheck.retryAfterSeconds,
    };
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
        // Cache must include segment_efforts and photos (v3)
        if ("segment_efforts" in parsed && "photos" in parsed) {
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

    // Get user nickname for effort records
    const userDoc = await db.doc(`users/${uid}`).get();
    const nickname = userDoc.data()?.nickname ?? "Rider";

    // Fetch streams, activity detail, and photos in parallel
    const [streamsResp, detailResp, photosResp] = await Promise.all([
      fetch(
        `https://www.strava.com/api/v3/activities/${stravaActivityId}/streams?keys=latlng,altitude,heartrate,watts,cadence,velocity_smooth,time,distance&key_by_type=true`,
        { headers },
      ),
      fetch(
        `https://www.strava.com/api/v3/activities/${stravaActivityId}?include_all_efforts=true`,
        { headers },
      ),
      fetch(
        `https://www.strava.com/api/v3/activities/${stravaActivityId}/photos?size=600&photo_sources=true`,
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
        const effortRef = db.doc(`segment_efforts/${segDocId}/efforts/${effortDocId}`);
        const startDate = detail.start_date
          ? new Date(detail.start_date as string).getTime()
          : Date.now();

        batch.set(effortRef, {
          segmentId: segDocId,
          activityId: `strava_${stravaActivityId}`,
          userId: uid,
          nickname,
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

    // Extract photos
    if (photosResp.ok) {
      interface StravaPhoto {
        unique_id: string;
        urls: Record<string, string>;
        caption?: string;
        location?: [number, number];
        created_at?: string;
      }
      const photos = (await photosResp.json()) as StravaPhoto[];
      if (photos.length > 0) {
        streamData.photos = photos.map((p) => ({
          id: p.unique_id,
          url: p.urls?.["600"] ?? p.urls?.["100"] ?? Object.values(p.urls ?? {})[0] ?? null,
          caption: p.caption ?? null,
          location: p.location ?? null,
        }));
        console.log(`[stravaStreams] activity=${stravaActivityId} photos=${photos.length}`);
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

// ── Rate Limit Helpers ───────────────────────────────────────────────

interface RateLimitInfo {
  usage15min: number;
  limit15min: number;
  usageDaily: number;
  limitDaily: number;
}

function parseRateLimitHeaders(resp: Response): RateLimitInfo {
  // Strava headers: "X-RateLimit-Limit: 100,1000" and "X-RateLimit-Usage: 42,350"
  const limitHeader = resp.headers.get("X-RateLimit-Limit") ?? "100,1000";
  const usageHeader = resp.headers.get("X-RateLimit-Usage") ?? "0,0";

  const [limit15min, limitDaily] = limitHeader.split(",").map(Number);
  const [usage15min, usageDaily] = usageHeader.split(",").map(Number);

  return {
    usage15min: usage15min || 0,
    limit15min: limit15min || 100,
    usageDaily: usageDaily || 0,
    limitDaily: limitDaily || 1000,
  };
}

function checkRateLimit(info: RateLimitInfo): { paused: boolean; retryAfterSeconds: number } {
  if (info.usageDaily >= info.limitDaily - 5) {
    return { paused: true, retryAfterSeconds: 3600 };
  }
  if (info.usage15min >= info.limit15min - 5) {
    return { paused: true, retryAfterSeconds: 60 };
  }
  return { paused: false, retryAfterSeconds: 0 };
}

// ── Batch Stream Fetcher ─────────────────────────────────────────────

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

interface StravaPhoto {
  unique_id: string;
  urls: Record<string, string>;
  caption?: string;
  location?: [number, number];
  created_at?: string;
}

async function fetchAndCacheStreams(
  stravaActivityId: number,
  uid: string,
  nickname: string,
  accessToken: string,
  includeSegments: boolean,
  includePhotos: boolean,
): Promise<{ resp: Response; apiCalls: number }> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  let apiCalls = 0;

  // Always fetch streams
  const streamsResp = await fetch(
    `https://www.strava.com/api/v3/activities/${stravaActivityId}/streams?keys=latlng,altitude,heartrate,watts,cadence,velocity_smooth,time,distance&key_by_type=true`,
    { headers },
  );
  apiCalls++;

  if (!streamsResp.ok) {
    return { resp: streamsResp, apiCalls };
  }

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

  // Optionally fetch detail (for segments) and photos
  let detailResp: Response | null = null;
  let photosResp: Response | null = null;

  if (includeSegments && includePhotos) {
    const [dr, pr] = await Promise.all([
      fetch(`https://www.strava.com/api/v3/activities/${stravaActivityId}?include_all_efforts=true`, { headers }),
      fetch(`https://www.strava.com/api/v3/activities/${stravaActivityId}/photos?size=600&photo_sources=true`, { headers }),
    ]);
    detailResp = dr;
    photosResp = pr;
    apiCalls += 2;
  } else if (includeSegments) {
    detailResp = await fetch(`https://www.strava.com/api/v3/activities/${stravaActivityId}?include_all_efforts=true`, { headers });
    apiCalls++;
  } else if (includePhotos) {
    photosResp = await fetch(`https://www.strava.com/api/v3/activities/${stravaActivityId}/photos?size=600&photo_sources=true`, { headers });
    apiCalls++;
  }

  // Process segments
  if (detailResp?.ok) {
    const detail = await detailResp.json();
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

    // Save segments & efforts to DB
    const latlngArr = streamData.latlng as [number, number][] | undefined;
    const batch = db.batch();
    for (const e of efforts) {
      const seg = e.segment;
      const segDocId = `strava_${seg.id}`;
      batch.set(db.doc(`segments/${segDocId}`), {
        name: seg.name,
        distance: seg.distance,
        averageGrade: seg.average_grade,
        maximumGrade: seg.maximum_grade,
        elevationHigh: seg.elevation_high,
        elevationLow: seg.elevation_low,
        climbCategory: seg.climb_category,
        city: seg.city ?? null,
        state: seg.state ?? null,
        startLatlng: latlngArr?.[e.start_index] ?? null,
        endLatlng: latlngArr?.[e.end_index] ?? null,
        source: "strava",
        stravaSegmentId: seg.id,
        updatedAt: Date.now(),
      }, { merge: true });

      const effortDocId = `strava_${e.id}`;
      const startDate = detail.start_date
        ? new Date(detail.start_date as string).getTime()
        : Date.now();
      batch.set(db.doc(`segment_efforts/${segDocId}/efforts/${effortDocId}`), {
        segmentId: segDocId,
        activityId: `strava_${stravaActivityId}`,
        userId: uid,
        nickname,
        elapsedTime: e.elapsed_time * 1000,
        movingTime: e.moving_time * 1000,
        distance: e.distance,
        averageSpeed: e.distance > 0 && e.moving_time > 0 ? (e.distance / e.moving_time) * 3.6 : 0,
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
    }
    if (efforts.length > 0) await batch.commit();
  }

  // Process photos
  if (photosResp?.ok) {
    const photos = (await photosResp.json()) as StravaPhoto[];
    if (photos.length > 0) {
      streamData.photos = photos.map((p) => ({
        id: p.unique_id,
        url: p.urls?.["600"] ?? p.urls?.["100"] ?? Object.values(p.urls ?? {})[0] ?? null,
        caption: p.caption ?? null,
        location: p.location ?? null,
      }));
    }
  }

  // Only set default keys if they were actually fetched.
  // If not fetched, leave keys absent so stravaGetActivityStreams re-fetches.
  if (includeSegments && !("segment_efforts" in streamData)) streamData.segment_efforts = [];
  if (includePhotos && !("photos" in streamData)) streamData.photos = [];

  // Cache as JSON string
  const cacheDocId = `strava_${stravaActivityId}`;
  const jsonStr = JSON.stringify(streamData);
  if (jsonStr.length < 1_000_000) {
    await db.doc(`activity_streams/${cacheDocId}`).set({ userId: uid, json: jsonStr });
  }

  // Update activity doc with actual photo/segment counts
  const photoCount = Array.isArray(streamData.photos) ? (streamData.photos as unknown[]).length : 0;
  const segmentCount = Array.isArray(streamData.segment_efforts) ? (streamData.segment_efforts as unknown[]).length : 0;
  if (photoCount > 0 || segmentCount > 0) {
    await db.doc(`activities/${cacheDocId}`).set(
      { photoCount, segmentEffortCount: segmentCount },
      { merge: true },
    );
  }

  return { resp: streamsResp, apiCalls };
}

export const stravaBatchFetchStreams = onCall(
  { secrets: [STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET], timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

    const uid = request.auth.uid;
    const { batchSize = 10, includePhotos = false, includeSegments = false } = request.data as {
      batchSize?: number;
      includePhotos?: boolean;
      includeSegments?: boolean;
    };

    const accessToken = await getValidAccessToken(uid);

    // Get user nickname
    const userDoc = await db.doc(`users/${uid}`).get();
    const nickname = userDoc.data()?.nickname ?? "Rider";

    // Query all strava activities for this user
    const activitiesSnap = await db
      .collection("activities")
      .where("userId", "==", uid)
      .where("source", "==", "strava")
      .get();

    const allActivityIds = activitiesSnap.docs
      .map((doc) => doc.data().stravaActivityId as number)
      .filter(Boolean);

    // Query cached streams for this user
    const cachedSnap = await db
      .collection("activity_streams")
      .where("userId", "==", uid)
      .select()
      .get();
    const cachedIds = new Set(cachedSnap.docs.map((doc) => doc.id));

    // Find activities without cached streams
    const uncachedIds = allActivityIds.filter((id) => !cachedIds.has(`strava_${id}`));

    const totalStreams = allActivityIds.length;
    const alreadyFetched = allActivityIds.length - uncachedIds.length;

    // Update total count in migration progress
    await db.doc(`users/${uid}`).set(
      {
        migration: {
          progress: {
            phase: "streams",
            totalStreams,
            fetchedStreams: alreadyFetched,
            updatedAt: Date.now(),
          },
        },
      },
      { merge: true },
    );

    if (uncachedIds.length === 0) {
      return { fetched: 0, remaining: 0, done: true, rateLimit: { paused: false, retryAfterSeconds: 0 } };
    }

    // Process batch
    const batch = uncachedIds.slice(0, Math.min(batchSize, uncachedIds.length));
    let fetched = 0;
    let failed = 0;
    let lastRateLimit: RateLimitInfo | null = null;

    for (const stravaId of batch) {
      try {
        const result = await fetchAndCacheStreams(stravaId, uid, nickname, accessToken, includeSegments, includePhotos);
        lastRateLimit = parseRateLimitHeaders(result.resp);

        if (result.resp.ok) {
          fetched++;
        } else {
          failed++;
          console.error(`[batchStreams] Failed activity ${stravaId}: ${result.resp.status}`);
        }

        // Check rate limit after each activity
        const rateLimitCheck = checkRateLimit(lastRateLimit);
        if (rateLimitCheck.paused) {
          console.log(`[batchStreams] Rate limit reached after ${fetched} activities: 15min=${lastRateLimit.usage15min}/${lastRateLimit.limit15min} daily=${lastRateLimit.usageDaily}/${lastRateLimit.limitDaily}`);

          // Update progress before pausing
          await db.doc(`users/${uid}`).set(
            {
              migration: {
                progress: {
                  fetchedStreams: alreadyFetched + fetched,
                  failedStreams: admin.firestore.FieldValue.increment(failed),
                  updatedAt: Date.now(),
                },
              },
            },
            { merge: true },
          );

          const remaining = uncachedIds.length - fetched - failed;
          return {
            fetched,
            failed,
            remaining,
            done: false,
            rateLimit: { paused: true, retryAfterSeconds: rateLimitCheck.retryAfterSeconds },
          };
        }
      } catch (e) {
        failed++;
        console.error(`[batchStreams] Error fetching activity ${stravaId}:`, e);
      }
    }

    // Update progress
    await db.doc(`users/${uid}`).set(
      {
        migration: {
          progress: {
            fetchedStreams: alreadyFetched + fetched,
            failedStreams: admin.firestore.FieldValue.increment(failed),
            updatedAt: Date.now(),
          },
        },
      },
      { merge: true },
    );

    const remaining = uncachedIds.length - fetched - failed;
    console.log(`[batchStreams] uid=${uid} fetched=${fetched} failed=${failed} remaining=${remaining}`);

    return {
      fetched,
      failed,
      remaining,
      done: remaining <= 0,
      rateLimit: lastRateLimit
        ? { paused: false, retryAfterSeconds: 0, usage15min: lastRateLimit.usage15min, limit15min: lastRateLimit.limit15min }
        : { paused: false, retryAfterSeconds: 0 },
    };
  },
);

export const stravaMigrationStart = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

  const uid = request.auth.uid;
  const { scope } = request.data as {
    scope: { period: string; includePhotos: boolean; includeSegments: boolean };
  };

  if (!scope?.period) throw new HttpsError("invalid-argument", "scope is required");

  await db.doc(`users/${uid}`).set(
    {
      migration: {
        status: "RUNNING",
        scope,
        progress: {
          totalActivities: 0,
          importedActivities: 0,
          skippedActivities: 0,
          currentPage: 0,
          totalPages: 0,
          phase: "activities",
          totalStreams: 0,
          fetchedStreams: 0,
          failedStreams: 0,
          startedAt: Date.now(),
          updatedAt: Date.now(),
        },
        report: null,
      },
    },
    { merge: true },
  );

  console.log(`[migration] Started for uid=${uid} scope=${JSON.stringify(scope)}`);
  return { success: true };
});

export const stravaMigrationComplete = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

  const uid = request.auth.uid;

  // Query all activities for this user from Strava
  const activitiesSnap = await db
    .collection("activities")
    .where("userId", "==", uid)
    .where("source", "==", "strava")
    .get();

  let totalDistance = 0;
  let totalTime = 0;
  let totalElevation = 0;
  let totalCalories = 0;
  let totalPhotos = 0;
  let totalSegmentEfforts = 0;
  let earliestActivity = Infinity;
  let latestActivity = 0;
  const routeCounts: Record<string, { distance: number; count: number }> = {};

  for (const doc of activitiesSnap.docs) {
    const data = doc.data();
    totalDistance += data.summary?.distance ?? 0;
    totalTime += data.summary?.ridingTimeMillis ?? 0;
    totalElevation += data.summary?.elevationGain ?? 0;
    totalCalories += data.summary?.calories ?? 0;
    totalPhotos += data.photoCount ?? 0;
    totalSegmentEfforts += data.segmentEffortCount ?? 0;

    const startTime = data.startTime ?? data.createdAt ?? 0;
    if (startTime < earliestActivity) earliestActivity = startTime;
    if (startTime > latestActivity) latestActivity = startTime;

    const name = (data.description ?? "").trim();
    if (name) {
      if (!routeCounts[name]) routeCounts[name] = { distance: data.summary?.distance ?? 0, count: 0 };
      routeCounts[name].count++;
    }
  }

  // Count streams (GPS data fetched)
  const streamsSnap = await db
    .collection("activity_streams")
    .where("userId", "==", uid)
    .select()
    .get();
  const totalStreams = streamsSnap.size;

  const topRoutes = Object.entries(routeCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 3)
    .map(([name, { distance, count }]) => ({ name, distance, count }));

  const report = {
    totalActivities: activitiesSnap.size,
    totalDistance,
    totalTime,
    totalElevation,
    totalCalories,
    totalPhotos,
    totalSegmentEfforts,
    totalStreams,
    earliestActivity: earliestActivity === Infinity ? 0 : earliestActivity,
    latestActivity,
    topRoutes,
  };

  await db.doc(`users/${uid}`).set(
    {
      migration: {
        status: "DONE",
        report,
        progress: { updatedAt: Date.now() },
      },
    },
    { merge: true },
  );

  console.log(`[migration] Completed for uid=${uid}: ${report.totalActivities} activities, ${Math.round(report.totalDistance / 1000)}km`);
  return report;
});

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

export const stravaDeleteUserData = onCall(
  { timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

    const uid = request.auth.uid;
    const { streamsOnly = false } = (request.data ?? {}) as { streamsOnly?: boolean };
    let deletedActivities = 0;
    let deletedStreams = 0;

    // Delete activities (batch of 500) — skip if streamsOnly
    if (!streamsOnly) {
      const activitiesSnap = await db
        .collection("activities")
        .where("userId", "==", uid)
        .where("source", "==", "strava")
        .select()
        .get();

      const activityDocs = activitiesSnap.docs;
      for (let i = 0; i < activityDocs.length; i += 500) {
        const batch = db.batch();
        const chunk = activityDocs.slice(i, i + 500);
        for (const doc of chunk) {
          batch.delete(doc.ref);
        }
        await batch.commit();
        deletedActivities += chunk.length;
      }
    }

    // Delete activity_streams
    const streamsSnap = await db
      .collection("activity_streams")
      .where("userId", "==", uid)
      .select()
      .get();

    const streamDocs = streamsSnap.docs;
    for (let i = 0; i < streamDocs.length; i += 500) {
      const batch = db.batch();
      const chunk = streamDocs.slice(i, i + 500);
      for (const doc of chunk) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      deletedStreams += chunk.length;
    }

    // Reset migration state
    if (!streamsOnly) {
      await db.doc(`users/${uid}`).set(
        { migration: admin.firestore.FieldValue.delete() },
        { merge: true },
      );
    }

    console.log(`[deleteUserData] uid=${uid} streamsOnly=${streamsOnly} activities=${deletedActivities} streams=${deletedStreams}`);
    return { deletedActivities, deletedStreams };
  },
);

// ── Strava Webhook ──────────────────────────────────────────────────

const WEBHOOK_VERIFY_TOKEN = "orider-strava-webhook-2026";
const CYCLING_TYPES = ["Ride", "VirtualRide", "EBikeRide", "Handcycle", "Velomobile"];

export const stravaWebhook = onRequest(
  { secrets: [STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET] },
  async (req, res) => {
    // GET: Strava subscription validation
    if (req.method === "GET") {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
        console.log("[webhook] Subscription validated");
        res.json({ "hub.challenge": challenge });
      } else {
        res.status(403).send("Forbidden");
      }
      return;
    }

    // POST: Strava event
    if (req.method === "POST") {
      const event = req.body as {
        object_type: string;
        object_id: number;
        aspect_type: string;
        owner_id: number;
        subscription_id: number;
        event_time: number;
      };

      console.log(`[webhook] ${event.aspect_type} ${event.object_type} ${event.object_id} owner=${event.owner_id}`);

      // Only process activity events
      if (event.object_type !== "activity") {
        res.status(200).send("OK");
        return;
      }

      // Find user by stravaAthleteId
      const usersSnap = await db
        .collection("users")
        .where("stravaAthleteId", "==", event.owner_id)
        .limit(1)
        .get();

      if (usersSnap.empty) {
        console.log(`[webhook] No user found for athlete ${event.owner_id}`);
        res.status(200).send("OK");
        return;
      }

      const userDoc = usersSnap.docs[0];
      const uid = userDoc.id;
      const userData = userDoc.data();
      const docId = `strava_${event.object_id}`;

      // Handle delete
      if (event.aspect_type === "delete") {
        await db.doc(`activities/${docId}`).delete();
        await db.doc(`activity_streams/${docId}`).delete();
        console.log(`[webhook] Deleted activity ${docId}`);
        res.status(200).send("OK");
        return;
      }

      // Handle create/update: fetch activity from Strava
      let accessToken: string;
      try {
        accessToken = await getValidAccessToken(uid);
      } catch (err) {
        console.error(`[webhook] Token error for ${uid}:`, err);
        res.status(200).send("OK");
        return;
      }

      const resp = await fetch(
        `https://www.strava.com/api/v3/activities/${event.object_id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!resp.ok) {
        console.error(`[webhook] Strava API error: ${resp.status}`);
        res.status(200).send("OK");
        return;
      }

      const sa: StravaActivity = await resp.json();

      // Only process cycling activities
      if (!CYCLING_TYPES.includes(sa.type)) {
        console.log(`[webhook] Skipping non-cycling type: ${sa.type}`);
        res.status(200).send("OK");
        return;
      }

      const nickname = userData.nickname ?? "Rider";
      const defaultVisibility = userData.defaultVisibility ?? "everyone";
      const activityData = convertStravaActivity(sa, uid, nickname);
      activityData.visibility = defaultVisibility;
      activityData.profileImage = userData.photoURL ?? null;

      await db.doc(`activities/${docId}`).set(activityData);
      console.log(`[webhook] ${event.aspect_type} activity ${docId} for user ${uid} (${sa.name})`);

      res.status(200).send("OK");
      return;
    }

    res.status(405).send("Method not allowed");
  },
);
