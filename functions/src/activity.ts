import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * 활동 생성 시:
 * 1. 팔로워에게 피드 팬아웃
 * 2. 그룹 라이드 자동 매칭 (groupId가 있으면)
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

    // 2. Group ride auto-matching
    if (activity.groupId) {
      await matchGroupRide(activityId, activity);
    }
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

  const followersSnap = await db
    .collection("followers")
    .doc(userId)
    .collection("users")
    .get();

  if (followersSnap.empty) return;

  const batch = db.batch();
  const feedEntry = {
    userId: activity.userId,
    nickname: activity.nickname,
    profileImage: activity.profileImage,
    createdAt: activity.createdAt,
    type: activity.type,
  };

  for (const followerDoc of followersSnap.docs) {
    const followerId = followerDoc.id;

    // friends visibility면 팔로우 관계 확인
    if (activity.visibility === "friends") {
      const isFollowing = await db
        .collection("following")
        .doc(userId)
        .collection(followerId)
        .get();
      if (isFollowing.empty) continue;
    }

    const feedRef = db
      .collection("feed")
      .doc(followerId)
      .collection("activities")
      .doc(activityId);
    batch.set(feedRef, feedEntry);
  }

  await batch.commit();
}

/**
 * 그룹 라이드 자동 매칭
 * 같은 그룹에서 30분 이상 시간이 겹치는 활동을 같은 그룹 라이드로 묶음
 */
async function matchGroupRide(
  activityId: string,
  activity: FirebaseFirestore.DocumentData
): Promise<void> {
  const groupId = activity.groupId;
  const startTime = activity.startTime;
  const endTime = activity.endTime;

  // 같은 그룹의 최근 24시간 활동 조회
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentActivities = await db
    .collection("activities")
    .where("groupId", "==", groupId)
    .where("startTime", ">", oneDayAgo)
    .get();

  let matchedGroupRideId: string | null = null;

  for (const doc of recentActivities.docs) {
    if (doc.id === activityId) continue;

    const other = doc.data();
    // 시간 겹침 계산
    const overlapStart = Math.max(startTime, other.startTime);
    const overlapEnd = Math.min(endTime, other.endTime);
    const overlapMinutes = (overlapEnd - overlapStart) / 60000;

    if (overlapMinutes >= 30) {
      matchedGroupRideId = other.groupRideId || null;
      break;
    }
  }

  // 새 그룹 라이드 생성 또는 기존에 참가
  if (!matchedGroupRideId) {
    matchedGroupRideId = db.collection("group_rides").doc().id;
  }

  const participant = {
    activityId,
    nickname: activity.nickname,
    profileImage: activity.profileImage || null,
    distance: activity.summary?.distance || 0,
    ridingTimeMillis: activity.summary?.ridingTimeMillis || 0,
    averageSpeed: activity.summary?.averageSpeed || 0,
    averageHeartRate: activity.summary?.averageHeartRate || null,
    averagePower: activity.summary?.averagePower || null,
    averageCadence: activity.summary?.averageCadence || null,
  };

  // activity에 groupRideId 저장
  await db
    .collection("activities")
    .doc(activityId)
    .update({ groupRideId: matchedGroupRideId });

  // group_rides 문서 업데이트
  const groupRideRef = db.collection("group_rides").doc(matchedGroupRideId);
  const groupRideSnap = await groupRideRef.get();

  if (groupRideSnap.exists) {
    await groupRideRef.update({
      [`participants.${activity.userId}`]: participant,
      participantCount: admin.firestore.FieldValue.increment(1),
      totalDistance: admin.firestore.FieldValue.increment(
        activity.summary?.distance || 0
      ),
      startTime: Math.min(startTime, groupRideSnap.data()!.startTime),
      endTime: Math.max(endTime, groupRideSnap.data()!.endTime),
    });
  } else {
    await groupRideRef.set({
      groupId,
      startTime,
      endTime,
      participantCount: 1,
      totalDistance: activity.summary?.distance || 0,
      participants: { [activity.userId]: participant },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}
