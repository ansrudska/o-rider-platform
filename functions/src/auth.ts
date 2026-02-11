import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const ensureUserProfile = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

  const uid = request.auth.uid;
  const docRef = db.doc(`users/${uid}`);
  const existing = await docRef.get();

  if (existing.exists) {
    return existing.data();
  }

  const profile = {
    nickname: request.auth.token.name ?? request.auth.token.email?.split("@")[0] ?? "Rider",
    email: request.auth.token.email ?? null,
    photoURL: request.auth.token.picture ?? null,
    stravaConnected: false,
    stravaAthleteId: null,
    stravaNickname: null,
    defaultVisibility: "everyone",
    createdAt: Date.now(),
  };

  await docRef.set(profile);
  return profile;
});

/**
 * 기본 공개 범위 변경 + 기존 활동 일괄 업데이트
 */
export const updateDefaultVisibility = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

  const { visibility } = request.data as { visibility: string };
  const VALID = ["everyone", "friends", "private"];
  if (!VALID.includes(visibility)) {
    throw new HttpsError("invalid-argument", "Invalid visibility value");
  }

  const uid = request.auth.uid;

  // 1. Update user profile
  await db.doc(`users/${uid}`).update({ defaultVisibility: visibility });

  // 2. Batch update all user's activities
  const activitiesSnap = await db
    .collection("activities")
    .where("userId", "==", uid)
    .select()
    .get();

  let updated = 0;
  const docs = activitiesSnap.docs;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + 500);
    for (const d of chunk) {
      batch.update(d.ref, { visibility });
    }
    await batch.commit();
    updated += chunk.length;
  }

  return { updated };
});
