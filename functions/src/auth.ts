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
    createdAt: Date.now(),
  };

  await docRef.set(profile);
  return profile;
});
