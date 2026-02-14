import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * 활동 생성 시:
 * 1. 팔로워에게 피드 팬아웃
 * 2. 동행 자동 매칭 (시간 겹침 기반, Strava 방식)
 */
export const onActivityCreate = onDocumentCreated(
  "activities/{activityId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const activity = snapshot.data();
    const activityId = event.params.activityId;
    const userId = activity.userId;

    // 1. Feed fan-out to followers
    await fanOutToFollowers(userId, activityId, activity);

    // 2. Auto-match group ride (time overlap based)
    await matchGroupRide(activityId, activity);
  }
);

/**
 * 팔로워 피드에 활동 인덱스 추가
 */
async function fanOutToFollowers(
  userId: string,
  activityId: string,
  activity: FirebaseFirestore.DocumentData
): Promise<void> {
  // visibility가 private이면 팬아웃하지 않음
  if (activity.visibility === "private") return;

  // friends/ 컬렉션은 양방향이므로 상호 확인 불필요
  const friendsSnap = await db
    .collection("friends")
    .doc(userId)
    .collection("users")
    .get();

  if (friendsSnap.empty) return;

  const batch = db.batch();
  const feedEntry = {
    userId: activity.userId,
    nickname: activity.nickname,
    profileImage: activity.profileImage,
    createdAt: activity.createdAt,
    type: activity.type,
  };

  for (const friendDoc of friendsSnap.docs) {
    const friendId = friendDoc.id;

    const feedRef = db
      .collection("feed")
      .doc(friendId)
      .collection("activities")
      .doc(activityId);
    batch.set(feedRef, feedEntry);
  }

  await batch.commit();
}

/**
 * 동행 자동 매칭 (Strava 방식)
 *
 * 조건: 다른 유저의 활동과 시간이 30% 이상 겹치면 동행으로 판단
 * - groupId 불필요 (모든 유저 대상)
 * - 시작 시간 기준 ±2시간 범위에서 검색
 * - 겹침 비율 = 겹침 시간 / 짧은 활동 시간
 */
async function matchGroupRide(
  activityId: string,
  activity: FirebaseFirestore.DocumentData
): Promise<void> {
  const startTime = activity.startTime;
  const endTime = activity.endTime;
  if (!startTime || !endTime) return;

  const duration = endTime - startTime;
  if (duration < 10 * 60 * 1000) return; // 10분 미만 활동 무시

  // ±2시간 범위에서 다른 유저의 활동 검색
  const windowStart = startTime - 2 * 60 * 60 * 1000;
  const windowEnd = startTime + 2 * 60 * 60 * 1000;

  const nearbyActivities = await db
    .collection("activities")
    .where("startTime", ">=", windowStart)
    .where("startTime", "<=", windowEnd)
    .get();

  let matchedGroupRideId: string | null = null;
  const matchedActivityIds: string[] = [];

  for (const doc of nearbyActivities.docs) {
    if (doc.id === activityId) continue;

    const other = doc.data();
    if (other.userId === activity.userId) continue; // 본인 활동 제외

    const otherStart = other.startTime;
    const otherEnd = other.endTime;
    if (!otherStart || !otherEnd) continue;

    // 시간 겹침 계산
    const overlapStart = Math.max(startTime, otherStart);
    const overlapEnd = Math.min(endTime, otherEnd);
    const overlap = Math.max(0, overlapEnd - overlapStart);

    // 짧은 활동 기준 겹침 비율
    const shorterDuration = Math.min(duration, otherEnd - otherStart);
    const overlapRatio = overlap / shorterDuration;

    if (overlapRatio >= 0.3) {
      // 이미 그룹 라이드에 속해있으면 그 ID 사용
      if (other.groupRideId) {
        matchedGroupRideId = other.groupRideId;
      }
      matchedActivityIds.push(doc.id);
    }
  }

  if (matchedActivityIds.length === 0) return;

  // 새 그룹 라이드 ID 생성 또는 기존 ID 재사용
  if (!matchedGroupRideId) {
    matchedGroupRideId = db.collection("activities").doc().id;

    // 매칭된 기존 활동들에도 groupRideId 부여
    const batch = db.batch();
    for (const matchedId of matchedActivityIds) {
      batch.update(db.collection("activities").doc(matchedId), {
        groupRideId: matchedGroupRideId,
      });
    }
    await batch.commit();
  }

  // 현재 activity에 groupRideId 저장
  await db
    .collection("activities")
    .doc(activityId)
    .update({ groupRideId: matchedGroupRideId });

  console.log(
    `[groupRide] Matched activity ${activityId} with ${matchedActivityIds.length} others → ${matchedGroupRideId}`
  );
}
