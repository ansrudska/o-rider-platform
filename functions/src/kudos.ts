import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * Kudos 생성 시: kudosCount 증가 + 알림 발송
 */
export const onKudosCreate = onDocumentCreated(
  "activities/{activityId}/kudos/{userId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const { activityId, userId } = event.params;
    const kudos = snapshot.data();

    // kudosCount 증가
    const activityRef = db.collection("activities").doc(activityId);
    await activityRef.update({
      kudosCount: admin.firestore.FieldValue.increment(1),
    });

    // 활동 소유자에게 알림
    const activitySnap = await activityRef.get();
    if (!activitySnap.exists) return;

    const activity = activitySnap.data()!;
    if (activity.userId === userId) return; // 자기 자신은 알림 X

    await db
      .collection("notifications")
      .doc(activity.userId)
      .collection("items")
      .add({
        type: "kudos",
        fromUserId: userId,
        fromNickname: kudos.nickname || "",
        fromProfileImage: kudos.profileImage || null,
        activityId,
        segmentId: null,
        message: `${kudos.nickname}님이 회원님의 활동에 좋아요를 눌렀습니다.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  }
);

/**
 * Kudos 삭제 시: kudosCount 감소
 */
export const onKudosDelete = onDocumentDeleted(
  "activities/{activityId}/kudos/{userId}",
  async (event) => {
    const { activityId } = event.params;

    await db
      .collection("activities")
      .doc(activityId)
      .update({
        kudosCount: admin.firestore.FieldValue.increment(-1),
      });
  }
);
