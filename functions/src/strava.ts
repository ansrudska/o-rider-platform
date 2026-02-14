import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as zlib from "zlib";
import { randomUUID } from "crypto";

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

function extractSegmentLatlng(
  latlngArr: [number, number][] | undefined,
  startIndex: number,
  endIndex: number,
): [number, number][] | null {
  if (!latlngArr || startIndex >= latlngArr.length) return null;
  const end = Math.min(endIndex + 1, latlngArr.length);
  const slice = latlngArr.slice(startIndex, end);
  if (slice.length <= 2) return slice.length > 0 ? slice : null;
  // Sample to max 200 points
  if (slice.length <= 200) return slice;
  const step = (slice.length - 1) / 199;
  const sampled: [number, number][] = [];
  for (let i = 0; i < 199; i++) {
    sampled.push(slice[Math.round(i * step)]);
  }
  sampled.push(slice[slice.length - 1]);
  return sampled;
}

function gcsDownloadUrl(bucketName: string, gcsPath: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(gcsPath)}?alt=media&token=${token}`;
}

async function downloadPhotoToGCS(
  cdnUrl: string,
  gcsPath: string,
  bucket: ReturnType<typeof admin.storage.prototype.bucket>,
): Promise<string> {
  const resp = await fetch(cdnUrl);
  if (!resp.ok) throw new Error(`Photo fetch failed: ${resp.status}`);

  const buffer = Buffer.from(await resp.arrayBuffer());
  const contentType = resp.headers.get("content-type") ?? "image/jpeg";
  const token = randomUUID();

  await bucket.file(gcsPath).save(buffer, {
    contentType,
    metadata: { firebaseStorageDownloadTokens: token },
  });

  return gcsDownloadUrl(bucket.name, gcsPath, token);
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
    profileImage: null as string | null,
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
      if (cachedData._cacheVersion >= 4) {
        if (cachedData.storage === "gcs" && cachedData.gcsPath) {
          // GCS cache
          try {
            const [content] = await admin.storage().bucket().file(cachedData.gcsPath).download();
            return JSON.parse(zlib.gunzipSync(content).toString());
          } catch (gcsErr) {
            console.warn(`[stravaStreams] GCS file missing for ${stravaActivityId} (${cachedData.gcsPath}), re-fetching from Strava`);
            await cacheRef.delete();
          }
        } else if (typeof cachedData.json === "string") {
          // Legacy Firestore cache
          const parsed = JSON.parse(cachedData.json);
          if (parsed._cacheVersion >= 4) {
            return parsed;
          }
        }
      }
      // Outdated cache — re-fetch
      if (cached.exists) {
        if (typeof cachedData.json === "string") {
          console.log(`[stravaStreams] Cache missing segments for ${stravaActivityId}, re-fetching`);
        } else {
          console.log(`[stravaStreams] Old cache for ${stravaActivityId}, re-fetching`);
        }
        await cacheRef.delete();
      }
    }

    const accessToken = await getValidAccessToken(uid);
    const headers = { Authorization: `Bearer ${accessToken}` };

    // Get user profile for effort records
    const userDoc = await db.doc(`users/${uid}`).get();
    const userDataForEfforts = userDoc.data();
    const nickname = userDataForEfforts?.nickname ?? "Rider";
    const profileImage: string | null = userDataForEfforts?.photoURL ?? null;

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

    // ── Parse API responses (no writes yet) ──

    // Segments
    let segmentWriteBatch: ReturnType<typeof db.batch> | null = null;
    let segLogMsg = "";
    if (detailResp.ok) {
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
      console.log(`[stravaStreams] activity=${stravaActivityId} segments=${efforts.length}`);

      if (efforts.length > 0) {
        const latlngArr = streamData.latlng as [number, number][] | undefined;
        const segRefs = efforts.map((e) => db.doc(`segments/strava_${e.segment.id}`));
        const segDocs = await db.getAll(...segRefs);
        const existingSegs = new Set(segDocs.filter((d) => d.exists).map((d) => d.id));

        segmentWriteBatch = db.batch();
        let segSaved = 0;
        for (const e of efforts) {
          const seg = e.segment;
          const segDocId = `strava_${seg.id}`;

          if (!existingSegs.has(segDocId)) {
            const segmentLatlng = extractSegmentLatlng(latlngArr, e.start_index, e.end_index);
            segmentWriteBatch.set(db.doc(`segments/${segDocId}`), {
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
              ...(segmentLatlng ? { segmentLatlng: JSON.stringify(segmentLatlng) } : {}),
              source: "strava",
              stravaSegmentId: seg.id,
              updatedAt: Date.now(),
            });
            segSaved++;
          }

          const effortDocId = `strava_${e.id}`;
          const startDate = detail.start_date
            ? new Date(detail.start_date as string).getTime()
            : Date.now();
          segmentWriteBatch.set(db.doc(`segment_efforts/${segDocId}/efforts/${effortDocId}`), {
            segmentId: segDocId,
            activityId: `strava_${stravaActivityId}`,
            userId: uid,
            nickname,
            profileImage,
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
        }
        segLogMsg = `${segSaved} new segments, ${efforts.length} efforts (${existingSegs.size} skipped)`;
      }
    }

    // Photos — download to GCS
    const bucket = admin.storage().bucket();
    const photoResults: { id: string; url: string; caption: string | null; location: [number, number] | null }[] = [];
    if (photosResp.ok) {
      const photos = (await photosResp.json()) as StravaPhoto[];
      if (photos.length > 0) {
        const photoPromises = photos.map(async (p, i) => {
          const cdnUrl = p.urls?.["600"] ?? p.urls?.["100"] ?? Object.values(p.urls ?? {})[0] ?? null;
          if (!cdnUrl) return;
          try {
            const ext = cdnUrl.includes(".png") ? "png" : "jpg";
            const photoGcsPath = `photos/${uid}/${stravaActivityId}/${i}.${ext}`;
            const gcsUrl = await downloadPhotoToGCS(cdnUrl, photoGcsPath, bucket);
            photoResults.push({ id: p.unique_id, url: gcsUrl, caption: p.caption ?? null, location: p.location ?? null });
          } catch (e) {
            console.warn(`[stravaStreams] Photo ${i} download failed:`, e);
            photoResults.push({ id: p.unique_id, url: cdnUrl, caption: p.caption ?? null, location: p.location ?? null });
          }
        });
        await Promise.all(photoPromises);
        streamData.photos = photoResults;
        console.log(`[stravaStreams] activity=${stravaActivityId} photos=${photoResults.length} saved to GCS`);
      }
    }

    // Mark cache version
    streamData._cacheVersion = 4;

    // ── Parallel storage: GCS stream + Firestore index + segments ──
    const storagePromises: Promise<unknown>[] = [];

    const jsonStr = JSON.stringify(streamData);
    const compressed = zlib.gzipSync(Buffer.from(jsonStr));
    const gcsPath = `streams/${uid}/${stravaActivityId}.json.gz`;
    storagePromises.push(
      bucket.file(gcsPath).save(compressed, {
        contentType: "application/gzip",
        metadata: { cacheVersion: "4" },
      }),
    );
    storagePromises.push(
      cacheRef.set({ userId: uid, storage: "gcs", gcsPath, _cacheVersion: 4 }),
    );
    if (segmentWriteBatch) {
      storagePromises.push(segmentWriteBatch.commit());
    }

    await Promise.all(storagePromises);
    if (segLogMsg) console.log(`[stravaStreams] ${segLogMsg}`);

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

function calcRateLimitWaitMs(): { wait15min: number; waitDaily: number } {
  const now = Date.now();
  // Strava 15-min windows align to :00/:15/:30/:45 UTC
  const fifteenMin = 15 * 60 * 1000;
  const wait15min = fifteenMin - (now % fifteenMin) + 5_000; // +5s buffer
  // Daily limit resets at midnight UTC
  const nowDate = new Date(now);
  const midnightUtc = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate() + 1);
  const waitDaily = midnightUtc - now + 5_000;
  return { wait15min, waitDaily };
}

function checkRateLimit(info: RateLimitInfo): { paused: boolean; retryAfterSeconds: number } {
  const { wait15min, waitDaily } = calcRateLimitWaitMs();
  if (info.usageDaily >= info.limitDaily - 5) {
    return { paused: true, retryAfterSeconds: Math.ceil(waitDaily / 1000) };
  }
  if (info.usage15min >= info.limit15min - 5) {
    return { paused: true, retryAfterSeconds: Math.ceil(wait15min / 1000) };
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
  profileImage: string | null,
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

  // ── Parse API responses (no writes yet) ──

  // Segments
  let segmentWriteBatch: ReturnType<typeof db.batch> | null = null;
  let segLogMsg = "";
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

    if (efforts.length > 0) {
      const latlngArr = streamData.latlng as [number, number][] | undefined;
      const segRefs = efforts.map((e) => db.doc(`segments/strava_${e.segment.id}`));
      const segDocs = await db.getAll(...segRefs);
      const existingSegs = new Set(segDocs.filter((d) => d.exists).map((d) => d.id));

      segmentWriteBatch = db.batch();
      let newSegs = 0;
      for (const e of efforts) {
        const seg = e.segment;
        const segDocId = `strava_${seg.id}`;

        if (!existingSegs.has(segDocId)) {
          const segmentLatlng = extractSegmentLatlng(latlngArr, e.start_index, e.end_index);
          segmentWriteBatch.set(db.doc(`segments/${segDocId}`), {
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
            ...(segmentLatlng ? { segmentLatlng: JSON.stringify(segmentLatlng) } : {}),
            source: "strava",
            stravaSegmentId: seg.id,
            updatedAt: Date.now(),
          });
          newSegs++;
        }

        const effortDocId = `strava_${e.id}`;
        const startDate = detail.start_date
          ? new Date(detail.start_date as string).getTime()
          : Date.now();
        segmentWriteBatch.set(db.doc(`segment_efforts/${segDocId}/efforts/${effortDocId}`), {
          segmentId: segDocId,
          activityId: `strava_${stravaActivityId}`,
          userId: uid,
          nickname,
          profileImage,
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
      segLogMsg = `${newSegs} new segments, ${efforts.length} efforts (${existingSegs.size} skipped)`;
    }
  }

  // Photos — parse URLs
  const photoUrls: { id: string; cdnUrl: string; caption: string | null; location: [number, number] | null }[] = [];
  if (photosResp?.ok) {
    const photos = (await photosResp.json()) as StravaPhoto[];
    for (const p of photos) {
      const url = p.urls?.["600"] ?? p.urls?.["100"] ?? Object.values(p.urls ?? {})[0] ?? null;
      if (url) {
        photoUrls.push({ id: p.unique_id, cdnUrl: url, caption: p.caption ?? null, location: p.location ?? null });
      }
    }
  }

  // Set default keys for successful fetches
  if (includeSegments && detailResp?.ok && !("segment_efforts" in streamData)) streamData.segment_efforts = [];
  if (includePhotos && photosResp?.ok && !("photos" in streamData)) streamData.photos = [];

  // Mark cache version
  streamData._cacheVersion = 4;

  // ── Parallel storage: GCS stream + Firestore index + segments + photos ──
  const cacheDocId = `strava_${stravaActivityId}`;
  const bucket = admin.storage().bucket();
  const storagePromises: Promise<unknown>[] = [];

  // 1. Photo downloads → GCS (parallel, no Strava API rate limit)
  const photoResults: { id: string; url: string; caption: string | null; location: [number, number] | null }[] = [];
  if (photoUrls.length > 0) {
    const photoPromises = photoUrls.map(async (p, i) => {
      try {
        const ext = p.cdnUrl.includes(".png") ? "png" : "jpg";
        const photoGcsPath = `photos/${uid}/${stravaActivityId}/${i}.${ext}`;
        const gcsUrl = await downloadPhotoToGCS(p.cdnUrl, photoGcsPath, bucket);
        photoResults.push({ id: p.id, url: gcsUrl, caption: p.caption, location: p.location });
      } catch (e) {
        console.warn(`[fetchStreams] Photo ${i} download failed:`, e);
        // Fallback to CDN URL
        photoResults.push({ id: p.id, url: p.cdnUrl, caption: p.caption, location: p.location });
      }
    });
    await Promise.all(photoPromises);
    streamData.photos = photoResults;
  }

  // 2. GCS stream upload (after photos are resolved so streamData includes GCS URLs)
  const jsonStr = JSON.stringify(streamData);
  const compressed = zlib.gzipSync(Buffer.from(jsonStr));
  const gcsPath = `streams/${uid}/${stravaActivityId}.json.gz`;
  storagePromises.push(
    bucket.file(gcsPath).save(compressed, {
      contentType: "application/gzip",
      metadata: { cacheVersion: "4" },
    }),
  );

  // 3. Firestore index
  storagePromises.push(
    db.doc(`activity_streams/${cacheDocId}`).set({
      userId: uid,
      storage: "gcs",
      gcsPath,
      _cacheVersion: 4,
    }),
  );

  // 4. Segment batch commit
  if (segmentWriteBatch) {
    storagePromises.push(segmentWriteBatch.commit());
  }

  // 5. Activity doc photo/segment counts
  const photoCount = Array.isArray(streamData.photos) ? (streamData.photos as unknown[]).length : 0;
  const segmentCount = Array.isArray(streamData.segment_efforts) ? (streamData.segment_efforts as unknown[]).length : 0;
  if (photoCount > 0 || segmentCount > 0) {
    storagePromises.push(
      db.doc(`activities/${cacheDocId}`).set(
        { photoCount, segmentEffortCount: segmentCount },
        { merge: true },
      ),
    );
  }

  await Promise.all(storagePromises);
  if (segLogMsg) console.log(`[fetchStreams] ${segLogMsg}`);
  if (photoResults.length > 0) console.log(`[fetchStreams] ${photoResults.length} photos saved to GCS`);

  return { resp: streamsResp, apiCalls };
}




// ── Queue System ─────────────────────────────────────────────────────

function periodToAfter(period: string): number | undefined {
  const now = Math.floor(Date.now() / 1000);
  if (period === "recent_90") return now - 90 * 86400;
  if (period === "recent_180") return now - 180 * 86400;
  return undefined; // "all"
}

export const stravaQueueEnqueue = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

  const uid = request.auth.uid;
  const { scope } = request.data as {
    scope: { period: string; includePhotos: boolean; includeSegments: boolean };
  };

  if (!scope?.period) throw new HttpsError("invalid-argument", "scope is required");

  // Check for existing active job
  const existingSnap = await db.collection("strava_queue")
    .where("uid", "==", uid)
    .where("status", "in", ["pending", "processing", "waiting"])
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    throw new HttpsError("already-exists", "Migration already in progress");
  }

  const now = Date.now();

  // Create queue job
  const jobRef = db.collection("strava_queue").doc();
  await jobRef.set({
    uid,
    type: "activities",
    scope,
    nextPage: 1,
    totalImported: 0,
    totalSkipped: 0,
    status: "pending",
    priority: now,
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
    maxRetries: 5,
    lastError: null,
    waitUntil: null,
  });

  // Count pending/processing jobs ahead
  const aheadSnap = await db.collection("strava_queue")
    .where("status", "in", ["pending", "processing"])
    .where("priority", "<", now)
    .get();
  const queuePosition = aheadSnap.size;

  // Update user migration status
  await db.doc(`users/${uid}`).set(
    {
      migration: {
        status: "QUEUED",
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
          startedAt: now,
          updatedAt: now,
          queuePosition,
          waitUntil: null,
        },
        report: null,
      },
    },
    { merge: true },
  );

  console.log(`[queue] Enqueued job ${jobRef.id} for uid=${uid} scope=${JSON.stringify(scope)} position=${queuePosition}`);
  return { jobId: jobRef.id, queuePosition };
});

export const stravaQueueCancel = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

  const uid = request.auth.uid;

  // Find active jobs for this user
  const jobsSnap = await db.collection("strava_queue")
    .where("uid", "==", uid)
    .where("status", "in", ["pending", "processing", "waiting"])
    .get();

  if (jobsSnap.empty) {
    throw new HttpsError("not-found", "No active migration found");
  }

  const batch = db.batch();
  for (const doc of jobsSnap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();

  // Reset migration status
  await db.doc(`users/${uid}`).set(
    {
      migration: {
        status: "NOT_STARTED",
        progress: { updatedAt: Date.now(), queuePosition: null, waitUntil: null },
      },
    },
    { merge: true },
  );

  console.log(`[queue] Cancelled ${jobsSnap.size} job(s) for uid=${uid}`);
  return { cancelled: jobsSnap.size };
});

export const stravaQueueProcessor = onSchedule(
  {
    schedule: "every 1 minutes",
    secrets: [STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET],
    timeoutSeconds: 120,
  },
  async () => {
    const startTime = Date.now();
    const TIMEOUT_BUFFER_MS = 15_000; // Stop 15s before timeout

    // ── Step 0: Reset stale jobs (processing for > 5 minutes) ──
    const staleSnap = await db.collection("strava_queue")
      .where("status", "==", "processing")
      .where("updatedAt", "<", startTime - 5 * 60 * 1000)
      .get();

    for (const doc of staleSnap.docs) {
      await doc.ref.update({ status: "pending", updatedAt: startTime });
      console.log(`[queue] Reset stale job ${doc.id}`);
    }

    // ── Step 0b: Unblock waiting jobs whose waitUntil has passed ──
    const waitingSnap = await db.collection("strava_queue")
      .where("status", "==", "waiting")
      .where("waitUntil", "<=", startTime)
      .get();

    for (const doc of waitingSnap.docs) {
      await doc.ref.update({ status: "pending", waitUntil: null, updatedAt: startTime });
      console.log(`[queue] Unblocked waiting job ${doc.id}`);
    }

    // ── Calculate API budget from rate limit ──
    const rateLimitDoc = await db.doc("strava_rate_limit/current").get();
    let budget: number;

    if (rateLimitDoc.exists) {
      const rl = rateLimitDoc.data()!;
      const remaining15min = (rl.limit15min || 100) - (rl.usage15min || 0);
      const remainingDaily = (rl.limitDaily || 1000) - (rl.usageDaily || 0);
      // If 15-min window has reset since last update, assume full 15-min budget
      if (rl.windowResetAt && rl.windowResetAt <= startTime) {
        budget = Math.min(rl.limit15min || 100, remainingDaily) - 10;
      } else {
        budget = Math.min(remaining15min, remainingDaily) - 10;
      }
    } else {
      budget = 80; // Conservative default
    }

    if (budget <= 0) {
      console.log(`[queue] No API budget remaining`);
      await updateQueuePositions();
      return;
    }

    let totalApiCalls = 0;
    let processedChunks = 0;

    // ── Main processing loop: process jobs until budget exhausted ──
    while (budget > 0 && Date.now() - startTime < 120_000 - TIMEOUT_BUFFER_MS) {
      // Pick next pending job (round-robin via updatedAt ordering)
      const jobSnap = await db.collection("strava_queue")
        .where("status", "in", ["pending"])
        .orderBy("updatedAt", "asc")
        .limit(1)
        .get();

      if (jobSnap.empty) break;

      const jobDoc = jobSnap.docs[0];
      const job = jobDoc.data();
      const jobId = jobDoc.id;
      const uid = job.uid as string;

      // Lock job
      await jobDoc.ref.update({ status: "processing", updatedAt: Date.now() });

      console.log(`[queue] Processing job ${jobId} uid=${uid} type=${job.type} budget=${budget}`);

      try {
        const accessToken = await getValidAccessToken(uid);
        const userDoc = await db.doc(`users/${uid}`).get();
        const userData = userDoc.data();
        const nickname = userData?.nickname ?? "Rider";
        const profileImage: string | null = userData?.photoURL ?? null;
        const defaultVisibility = userData?.defaultVisibility ?? "everyone";

        let result: { apiCalls: number; rateLimited: boolean };

        if (job.type === "activities") {
          result = await processActivitiesJob(jobDoc.ref, job, uid, accessToken, nickname, defaultVisibility);
        } else {
          result = await processStreamsJob(jobDoc.ref, job, uid, accessToken, nickname, profileImage, budget);
        }

        totalApiCalls += result.apiCalls;
        budget -= result.apiCalls;
        processedChunks++;

        if (result.rateLimited) {
          console.log(`[queue] Rate limited after ${totalApiCalls} API calls`);
          break;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[queue] Job ${jobId} error:`, errMsg);

        // Token refresh failures → mark as failed
        if (errMsg.includes("token refresh failed") || errMsg.includes("Strava not connected")) {
          await jobDoc.ref.update({
            status: "failed",
            lastError: errMsg,
            updatedAt: Date.now(),
          });
          await db.doc(`users/${uid}`).set(
            {
              migration: {
                status: "FAILED",
                progress: { updatedAt: Date.now(), queuePosition: null, waitUntil: null },
              },
            },
            { merge: true },
          );
        } else {
          // Retry with backoff
          const retryCount = (job.retryCount || 0) + 1;
          const maxRetries = job.maxRetries || 5;

          if (retryCount >= maxRetries) {
            await jobDoc.ref.update({
              status: "failed",
              retryCount,
              lastError: errMsg,
              updatedAt: Date.now(),
            });
            await db.doc(`users/${uid}`).set(
              {
                migration: {
                  status: "FAILED",
                  progress: { updatedAt: Date.now(), queuePosition: null, waitUntil: null },
                },
              },
              { merge: true },
            );
          } else {
            const backoffMinutes = [1, 2, 5, 10, 30][Math.min(retryCount - 1, 4)];
            const waitUntil = Date.now() + backoffMinutes * 60 * 1000;
            await jobDoc.ref.update({
              status: "waiting",
              retryCount,
              lastError: errMsg,
              waitUntil,
              updatedAt: Date.now(),
            });
            await db.doc(`users/${uid}`).set(
              {
                migration: {
                  status: "WAITING",
                  progress: { updatedAt: Date.now(), waitUntil },
                },
              },
              { merge: true },
            );
          }
        }
        // Continue to next job — don't let one user's error block others
        continue;
      }
    }

    console.log(`[queue] Tick done: ${processedChunks} chunks, ${totalApiCalls} API calls, budget remaining: ${budget}`);

    // ── Update queue positions for all users ──
    await updateQueuePositions();
  },
);

async function processActivitiesJob(
  jobRef: admin.firestore.DocumentReference,
  job: admin.firestore.DocumentData,
  uid: string,
  accessToken: string,
  nickname: string,
  defaultVisibility: string,
): Promise<{ apiCalls: number; rateLimited: boolean }> {
  const page = job.nextPage || 1;
  const scope = job.scope || {};
  const after = periodToAfter(scope.period || "all");
  const perPage = 200;

  let url = `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`;
  if (after) url += `&after=${after}`;

  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  // Update global rate limit from headers
  const rateLimit = parseRateLimitHeaders(resp);
  await updateGlobalRateLimit(rateLimit);

  if (resp.status === 429) {
    const rlCheck = checkRateLimit(rateLimit);
    const waitUntil = Date.now() + (rlCheck.retryAfterSeconds || 900) * 1000;
    await jobRef.update({
      status: "waiting",
      waitUntil,
      updatedAt: Date.now(),
    });
    await db.doc(`users/${uid}`).set(
      { migration: { status: "WAITING", progress: { updatedAt: Date.now(), waitUntil } } },
      { merge: true },
    );
    console.log(`[queue] Rate limited on activities page ${page}, wait ${rlCheck.retryAfterSeconds}s`);
    return { apiCalls: 1, rateLimited: true };
  }

  if (!resp.ok) {
    throw new Error(`Strava API failed: ${resp.status}`);
  }

  const stravaActivities: StravaActivity[] = await resp.json();
  console.log(`[queue] Activities page ${page}: ${stravaActivities.length} returned`);

  if (stravaActivities.length === 0) {
    // Activities phase done
    await finishActivitiesPhase(jobRef, job, uid, scope);
    return { apiCalls: 1, rateLimited: false };
  }

  const CYCLING_TYPES = ["Ride", "VirtualRide", "EBikeRide", "Handcycle", "Velomobile"];
  const rides = stravaActivities.filter((a) => CYCLING_TYPES.includes(a.type));

  // Bulk dedup: fetch all existing strava IDs and orider start times upfront
  const [existingSnap, oriderSnap] = await Promise.all([
    db.collection("activities")
      .where("userId", "==", uid)
      .where("source", "==", "strava")
      .select("stravaActivityId")
      .get(),
    db.collection("activities")
      .where("userId", "==", uid)
      .where("source", "==", "orider")
      .select("startTime")
      .get(),
  ]);
  const existingStravaIds = new Set(existingSnap.docs.map((d) => d.data().stravaActivityId as number));
  const oriderStartTimes = oriderSnap.docs.map((d) => d.data().startTime as number);

  const batch = db.batch();
  let imported = 0;
  let skipped = 0;
  const FIVE_MIN = 5 * 60 * 1000;

  for (const sa of rides) {
    if (existingStravaIds.has(sa.id)) {
      skipped++;
      continue;
    }

    // Dedup check against O-Rider activities in memory
    const startTime = new Date(sa.start_date).getTime();
    const hasDup = oriderStartTimes.some((t) => Math.abs(t - startTime) < FIVE_MIN);
    if (hasDup) {
      skipped++;
      continue;
    }

    const docId = `strava_${sa.id}`;
    const docRef = db.doc(`activities/${docId}`);
    const activityData = convertStravaActivity(sa, uid, nickname);
    activityData.visibility = defaultVisibility;
    batch.set(docRef, activityData);
    imported++;
  }

  // Non-ride skipped
  skipped += stravaActivities.length - rides.length;

  if (imported > 0) await batch.commit();

  const totalImported = (job.totalImported || 0) + imported;
  const totalSkipped = (job.totalSkipped || 0) + skipped;
  const hasMore = stravaActivities.length >= perPage;

  if (!hasMore) {
    // Activities phase done
    await jobRef.update({ totalImported, totalSkipped, updatedAt: Date.now() });
    await finishActivitiesPhase(jobRef, { ...job, totalImported, totalSkipped }, uid, scope);
    return { apiCalls: 1, rateLimited: false };
  }

  // More pages to go - save progress, set back to pending for next tick
  await jobRef.update({
    status: "pending",
    nextPage: page + 1,
    totalImported,
    totalSkipped,
    updatedAt: Date.now(),
  });

  // Update user progress
  await db.doc(`users/${uid}`).set(
    {
      migration: {
        status: "RUNNING",
        progress: {
          importedActivities: totalImported,
          skippedActivities: totalSkipped,
          currentPage: page,
          phase: "activities",
          updatedAt: Date.now(),
          queuePosition: 0,
          waitUntil: null,
        },
      },
    },
    { merge: true },
  );

  console.log(`[queue] Activities page ${page} done: +${imported} imported, +${skipped} skipped, hasMore=true`);
  return { apiCalls: 1, rateLimited: false };
}

async function finishActivitiesPhase(
  jobRef: admin.firestore.DocumentReference,
  job: admin.firestore.DocumentData,
  uid: string,
  scope: { includePhotos?: boolean; includeSegments?: boolean },
) {
  // Always fetch streams (GPS/sensor data is core); photos/segments are optional extras
  {
    // Count uncached streams to determine total
    const activitiesSnap = await db.collection("activities")
      .where("userId", "==", uid)
      .where("source", "==", "strava")
      .get();

    const allActivityIds = activitiesSnap.docs
      .map((doc) => doc.data().stravaActivityId as number)
      .filter(Boolean);

    const cachedSnap = await db.collection("activity_streams")
      .where("userId", "==", uid)
      .select()
      .get();
    const cachedIds = new Set(cachedSnap.docs.map((doc) => doc.id));
    const uncachedIds = allActivityIds.filter((id) => !cachedIds.has(`strava_${id}`));

    // Delete activities job, create streams job
    await jobRef.delete();

    const now = Date.now();
    await db.collection("strava_queue").doc().set({
      uid,
      type: "streams",
      scope,
      streamsRemaining: uncachedIds,
      totalStreams: allActivityIds.length,
      fetchedStreams: allActivityIds.length - uncachedIds.length,
      failedStreams: 0,
      status: "pending",
      priority: job.priority, // Keep original priority
      createdAt: job.createdAt,
      updatedAt: now,
      retryCount: 0,
      maxRetries: 5,
      lastError: null,
      waitUntil: null,
    });

    await db.doc(`users/${uid}`).set(
      {
        migration: {
          status: "RUNNING",
          progress: {
            phase: "streams",
            totalStreams: allActivityIds.length,
            fetchedStreams: allActivityIds.length - uncachedIds.length,
            failedStreams: 0,
            updatedAt: now,
            queuePosition: 0,
            waitUntil: null,
          },
        },
      },
      { merge: true },
    );

    console.log(`[queue] Activities done, created streams job: ${uncachedIds.length} to fetch`);
  }
}

async function processStreamsJob(
  jobRef: admin.firestore.DocumentReference,
  job: admin.firestore.DocumentData,
  uid: string,
  accessToken: string,
  nickname: string,
  profileImage: string | null,
  maxBudget = 15,
): Promise<{ apiCalls: number; rateLimited: boolean }> {
  const remaining: number[] = job.streamsRemaining || [];
  const scope = job.scope || {};
  const includeSegments = scope.includeSegments ?? false;
  const includePhotos = scope.includePhotos ?? false;

  if (remaining.length === 0) {
    await jobRef.delete();
    await completeMigration(uid);
    return { apiCalls: 0, rateLimited: false };
  }

  // Process streams up to budget limit
  const apiCallsPerStream = (includeSegments && includePhotos) ? 3 : (includeSegments || includePhotos) ? 2 : 1;
  const maxStreams = Math.max(1, Math.floor(maxBudget / apiCallsPerStream));
  const batchSize = Math.min(maxStreams, remaining.length);
  const batch = remaining.slice(0, batchSize);
  let fetched = 0;
  let failed = 0;
  let totalApiCalls = 0;
  const retryIds: number[] = [];     // IDs to retry later
  const failedIds: number[] = [];    // IDs that permanently failed
  const retryCountMap: Record<number, number> = job.streamRetryCount || {};

  for (const stravaId of batch) {
    try {
      const result = await fetchAndCacheStreams(stravaId, uid, nickname, profileImage, accessToken, includeSegments, includePhotos);
      totalApiCalls += result.apiCalls;

      // Update global rate limit
      const rl = parseRateLimitHeaders(result.resp);
      await updateGlobalRateLimit(rl);

      if (result.resp.status === 429) {
        // Rate limited — put everything back and wait
        retryIds.push(stravaId);
        const unprocessed = remaining.slice(batch.indexOf(stravaId) + 1);
        const allRemaining = [...retryIds, ...unprocessed];
        const rl429 = checkRateLimit(rl);
        const waitUntil = Date.now() + (rl429.retryAfterSeconds || 900) * 1000;
        await jobRef.update({
          status: "waiting",
          streamsRemaining: allRemaining,
          streamRetryCount: retryCountMap,
          fetchedStreams: (job.fetchedStreams || 0) + fetched,
          failedStreams: (job.failedStreams || 0) + failedIds.length,
          waitUntil,
          updatedAt: Date.now(),
        });
        await db.doc(`users/${uid}`).set(
          {
            migration: {
              status: "WAITING",
              progress: {
                fetchedStreams: (job.fetchedStreams || 0) + fetched,
                failedStreams: (job.failedStreams || 0) + failedIds.length,
                updatedAt: Date.now(),
                waitUntil,
              },
            },
          },
          { merge: true },
        );
        console.log(`[queue] Streams rate limited after ${fetched} fetches`);
        return { apiCalls: totalApiCalls, rateLimited: true };
      }

      if (result.resp.ok) {
        fetched++;
        delete retryCountMap[stravaId];
      } else {
        // Non-429 error — retry up to 3 times, then give up
        const count = (retryCountMap[stravaId] || 0) + 1;
        retryCountMap[stravaId] = count;
        if (count < 3) {
          retryIds.push(stravaId);
          console.warn(`[queue] Stream ${stravaId} failed (${result.resp.status}), retry ${count}/3`);
        } else {
          failedIds.push(stravaId);
          delete retryCountMap[stravaId];
          console.error(`[queue] Stream ${stravaId} permanently failed after 3 attempts`);
        }
      }

      // Check approaching rate limit
      const rlCheck = checkRateLimit(rl);
      if (rlCheck.paused) {
        const unprocessed = remaining.slice(batch.indexOf(stravaId) + 1);
        const allRemaining = [...retryIds, ...unprocessed];
        const waitUntil = Date.now() + (rlCheck.retryAfterSeconds || 60) * 1000;
        await jobRef.update({
          status: "waiting",
          streamsRemaining: allRemaining,
          streamRetryCount: retryCountMap,
          fetchedStreams: (job.fetchedStreams || 0) + fetched,
          failedStreams: (job.failedStreams || 0) + failedIds.length,
          waitUntil,
          updatedAt: Date.now(),
        });
        await db.doc(`users/${uid}`).set(
          {
            migration: {
              status: "WAITING",
              progress: {
                fetchedStreams: (job.fetchedStreams || 0) + fetched,
                failedStreams: (job.failedStreams || 0) + failedIds.length,
                updatedAt: Date.now(),
                waitUntil,
              },
            },
          },
          { merge: true },
        );
        console.log(`[queue] Streams approaching rate limit, pausing`);
        return { apiCalls: totalApiCalls, rateLimited: true };
      }
    } catch (e) {
      const count = (retryCountMap[stravaId] || 0) + 1;
      retryCountMap[stravaId] = count;
      if (count < 3) {
        retryIds.push(stravaId);
        console.warn(`[queue] Stream ${stravaId} exception, retry ${count}/3:`, e);
      } else {
        failedIds.push(stravaId);
        delete retryCountMap[stravaId];
        console.error(`[queue] Stream ${stravaId} permanently failed after 3 attempts:`, e);
      }
    }
  }

  // Append retry IDs to the back of remaining for next tick
  const newRemaining = [...remaining.slice(batchSize), ...retryIds];
  const newFetched = (job.fetchedStreams || 0) + fetched;
  const newFailed = (job.failedStreams || 0) + failedIds.length;

  if (newRemaining.length === 0) {
    // Streams phase done
    await jobRef.delete();
    await completeMigration(uid);
  } else {
    // More streams to go
    await jobRef.update({
      status: "pending",
      streamsRemaining: newRemaining,
      streamRetryCount: retryCountMap,
      fetchedStreams: newFetched,
      failedStreams: newFailed,
      updatedAt: Date.now(),
    });
    await db.doc(`users/${uid}`).set(
      {
        migration: {
          status: "RUNNING",
          progress: {
            fetchedStreams: newFetched,
            failedStreams: newFailed,
            updatedAt: Date.now(),
            queuePosition: 0,
            waitUntil: null,
          },
        },
      },
      { merge: true },
    );
  }

  console.log(`[queue] Streams: +${fetched} fetched, +${failed} failed, ${newRemaining.length} remaining`);
  return { apiCalls: totalApiCalls, rateLimited: false };
}

async function completeMigration(uid: string) {
  // Generate report (same as stravaMigrationComplete)
  const activitiesSnap = await db.collection("activities")
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

  const streamsSnap = await db.collection("activity_streams")
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
        progress: { updatedAt: Date.now(), queuePosition: null, waitUntil: null },
      },
    },
    { merge: true },
  );

  console.log(`[queue] Migration completed for uid=${uid}: ${report.totalActivities} activities, ${Math.round(report.totalDistance / 1000)}km`);
}

async function updateGlobalRateLimit(rl: RateLimitInfo) {
  const now = Date.now();
  // Calculate 15-min window reset: next 15-min boundary
  const fifteenMin = 15 * 60 * 1000;
  const windowResetAt = Math.ceil(now / fifteenMin) * fifteenMin;

  await db.doc("strava_rate_limit/current").set({
    usage15min: rl.usage15min,
    limit15min: rl.limit15min,
    usageDaily: rl.usageDaily,
    limitDaily: rl.limitDaily,
    lastUpdated: now,
    windowResetAt,
  });
}

function estimateRemainingApiCalls(job: admin.firestore.DocumentData): number {
  if (job.type === "streams") {
    const remaining = Array.isArray(job.streamsRemaining) ? job.streamsRemaining.length : 0;
    const scope = job.scope || {};
    const callsPerStream = (scope.includeSegments && scope.includePhotos) ? 3 : (scope.includeSegments || scope.includePhotos) ? 2 : 1;
    return remaining * callsPerStream;
  }
  // activities: 1 API call per page
  const page = job.nextPage || 1;
  const period = job.scope?.period || "all";
  const estimatedTotalPages = period === "recent_90" ? 5 : period === "recent_180" ? 10 : 30;
  return Math.max(1, estimatedTotalPages - page + 1);
}

async function updateQueuePositions() {
  const activeSnap = await db.collection("strava_queue")
    .where("status", "in", ["pending", "processing", "waiting"])
    .orderBy("updatedAt", "asc")
    .get();

  if (activeSnap.size === 0) return;

  // Budget per minute: ~90 API calls per 15 min window / 15 = ~6 per minute
  const BUDGET_PER_MINUTE = 6;

  const jobs = activeSnap.docs.map((doc) => ({
    uid: doc.data().uid as string,
    apiCalls: estimateRemainingApiCalls(doc.data()),
    status: doc.data().status as string,
    waitUntil: doc.data().waitUntil as number | null,
  }));

  // Total API calls across all jobs — each user shares the budget
  const totalCalls = jobs.reduce((sum, j) => sum + j.apiCalls, 0);

  const batch = db.batch();

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    // Time = (all remaining API calls / budget per minute) * (my share of total)
    // Simplified: my calls share the budget with everyone else's calls
    let estimatedMinutes = Math.ceil(totalCalls / BUDGET_PER_MINUTE);

    // If waiting for rate limit, use the longer of wait time or estimated time
    if (job.status === "waiting" && job.waitUntil) {
      const waitMinutes = Math.max(0, Math.ceil((job.waitUntil - Date.now()) / 60_000));
      estimatedMinutes = Math.max(estimatedMinutes, waitMinutes);
    }

    batch.set(
      db.doc(`users/${job.uid}`),
      { migration: { progress: { queuePosition: i, estimatedMinutes } } },
      { merge: true },
    );
  }

  await batch.commit();
}

// ── Verify & Fix ─────────────────────────────────────────────────────

export const stravaMigrationVerify = onCall(
  { secrets: [STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET], timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

    const uid = request.auth.uid;
    const accessToken = await getValidAccessToken(uid);

    // Read scope from migration
    const userDoc = await db.doc(`users/${uid}`).get();
    const userData = userDoc.data();
    const scope = userData?.migration?.scope;
    const after = scope?.period ? periodToAfter(scope.period) : undefined;

    // Phase 1: Fetch all cycling activity IDs from Strava
    const CYCLING_TYPES = ["Ride", "VirtualRide", "EBikeRide", "Handcycle", "Velomobile"];
    const stravaActivities: StravaActivity[] = [];
    let page = 1;

    while (true) {
      let url = `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=200`;
      if (after) url += `&after=${after}`;

      const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

      if (resp.status === 429) {
        throw new HttpsError("resource-exhausted", "Strava API rate limit. Please try again later.");
      }
      if (!resp.ok) {
        throw new HttpsError("internal", `Strava API failed: ${resp.status}`);
      }

      const pageData: StravaActivity[] = await resp.json();
      if (pageData.length === 0) break;

      const rides = pageData.filter((a) => CYCLING_TYPES.includes(a.type));
      stravaActivities.push(...rides);

      if (pageData.length < 200) break;
      page++;
    }

    console.log(`[verify] uid=${uid} strava activities: ${stravaActivities.length} (${page} pages)`);

    // Phase 2: Check which are imported
    const importedSnap = await db.collection("activities")
      .where("userId", "==", uid)
      .where("source", "==", "strava")
      .select("stravaActivityId")
      .get();
    const importedIds = new Set(importedSnap.docs.map((d) => d.data().stravaActivityId as number));

    const missingActivities = stravaActivities.filter((a) => !importedIds.has(a.id));

    // Phase 3: Check which imported activities have streams cached
    const allImportedStravaIds = importedSnap.docs
      .map((d) => d.data().stravaActivityId as number)
      .filter(Boolean);

    const cachedSnap = await db.collection("activity_streams")
      .where("userId", "==", uid)
      .select()
      .get();
    const cachedIds = new Set(cachedSnap.docs.map((d) => d.id));
    const missingStreamIds = allImportedStravaIds.filter((id) => !cachedIds.has(`strava_${id}`));

    // Save verification results (including full activity data for missing ones)
    const verification = {
      checkedAt: Date.now(),
      totalStrava: stravaActivities.length,
      totalImported: importedIds.size,
      missingActivityCount: missingActivities.length,
      missingStreamCount: missingStreamIds.length,
      missingActivityIds: missingActivities.map((a) => a.id),
      missingStreamIds,
      // Save full activity data so fix can import without extra API calls
      missingActivitiesData: missingActivities.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        sport_type: a.sport_type,
        distance: a.distance,
        moving_time: a.moving_time,
        elapsed_time: a.elapsed_time,
        total_elevation_gain: a.total_elevation_gain,
        start_date: a.start_date,
        start_date_local: a.start_date_local,
        average_speed: a.average_speed,
        max_speed: a.max_speed,
        average_heartrate: a.average_heartrate ?? null,
        max_heartrate: a.max_heartrate ?? null,
        average_watts: a.average_watts ?? null,
        max_watts: a.max_watts ?? null,
        weighted_average_watts: a.weighted_average_watts ?? null,
        average_cadence: a.average_cadence ?? null,
        kilojoules: a.kilojoules ?? null,
        total_photo_count: a.total_photo_count ?? 0,
        achievement_count: a.achievement_count ?? 0,
        map: a.map ? { summary_polyline: a.map.summary_polyline } : null,
      })),
    };

    await db.doc(`users/${uid}`).set(
      { migration: { verification } },
      { merge: true },
    );

    console.log(`[verify] uid=${uid} missing: ${missingActivities.length} activities, ${missingStreamIds.length} streams`);

    return {
      totalStrava: stravaActivities.length,
      totalImported: importedIds.size,
      missingActivityCount: missingActivities.length,
      missingStreamCount: missingStreamIds.length,
    };
  },
);

export const stravaMigrationFix = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

  const uid = request.auth.uid;

  const userDoc = await db.doc(`users/${uid}`).get();
  const userData = userDoc.data();
  const verification = userData?.migration?.verification;

  if (!verification) {
    throw new HttpsError("failed-precondition", "Run verification first");
  }

  const nickname = userData?.nickname ?? "Rider";
  const defaultVisibility = userData?.defaultVisibility ?? "everyone";
  const originalScope = userData?.migration?.scope;
  const requestScope = (request.data as { scope?: { includePhotos?: boolean; includeSegments?: boolean } } | undefined)?.scope;
  const scope = {
    ...originalScope,
    includePhotos: requestScope?.includePhotos ?? originalScope?.includePhotos ?? false,
    includeSegments: requestScope?.includeSegments ?? originalScope?.includeSegments ?? false,
  };

  let activitiesImported = 0;
  let streamsQueued = 0;

  // Phase 1: Import missing activities from saved data (no API calls)
  const missingData = (verification.missingActivitiesData ?? []) as StravaActivity[];
  if (missingData.length > 0) {
    // Batch write in chunks of 500
    for (let i = 0; i < missingData.length; i += 500) {
      const chunk = missingData.slice(i, i + 500);
      const batch = db.batch();
      for (const sa of chunk) {
        const docId = `strava_${sa.id}`;
        const docRef = db.doc(`activities/${docId}`);
        const activityData = convertStravaActivity(sa, uid, nickname);
        activityData.visibility = defaultVisibility;
        batch.set(docRef, activityData);
        activitiesImported++;
      }
      await batch.commit();
    }
    console.log(`[fix] uid=${uid} imported ${activitiesImported} missing activities`);
  }

  // Phase 2: Queue stream fetches for missing streams
  const missingStreamIds = (verification.missingStreamIds ?? []) as number[];
  // Also include newly imported activities' streams
  const allMissingStreamIds = [
    ...missingStreamIds,
    ...missingData.map((a: StravaActivity) => a.id),
  ];
  // Deduplicate
  const uniqueStreamIds = [...new Set(allMissingStreamIds)];

  if (uniqueStreamIds.length > 0) {
    const now = Date.now();
    await db.collection("strava_queue").doc().set({
      uid,
      type: "streams",
      scope: scope ?? { includePhotos: false, includeSegments: false },
      streamsRemaining: uniqueStreamIds,
      streamRetryCount: {},
      totalStreams: uniqueStreamIds.length,
      fetchedStreams: 0,
      failedStreams: 0,
      status: "pending",
      priority: now,
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      maxRetries: 5,
      lastError: null,
      waitUntil: null,
    });
    streamsQueued = uniqueStreamIds.length;

    await db.doc(`users/${uid}`).set(
      {
        migration: {
          status: "RUNNING",
          progress: {
            phase: "streams",
            totalStreams: uniqueStreamIds.length,
            fetchedStreams: 0,
            failedStreams: 0,
            updatedAt: now,
            queuePosition: 0,
            waitUntil: null,
          },
          verification: admin.firestore.FieldValue.delete(),
        },
      },
      { merge: true },
    );

    console.log(`[fix] uid=${uid} queued ${streamsQueued} streams`);
  } else {
    // No streams to fetch — just clear verification and regenerate report
    await db.doc(`users/${uid}`).set(
      { migration: { verification: admin.firestore.FieldValue.delete() } },
      { merge: true },
    );

    // Regenerate report if activities were imported
    if (activitiesImported > 0) {
      await completeMigration(uid);
    }
  }

  return { activitiesImported, streamsQueued };
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

      // Dedup: skip if same user already has an orider_ activity within ±5 minutes
      if (event.aspect_type === "create") {
        const startTime = new Date(sa.start_date).getTime();
        const FIVE_MIN = 5 * 60 * 1000;
        const dupSnap = await db.collection("activities")
          .where("userId", "==", uid)
          .where("source", "==", "orider")
          .where("startTime", ">=", startTime - FIVE_MIN)
          .where("startTime", "<=", startTime + FIVE_MIN)
          .limit(1)
          .get();
        if (!dupSnap.empty) {
          console.log(`[webhook] Skipping duplicate: orider activity ${dupSnap.docs[0].id} already exists for user ${uid}`);
          res.status(200).send("OK");
          return;
        }
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
