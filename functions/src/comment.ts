import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * 댓글 생성 시: commentCount 증가 + 알림 발송
 */
export const onCommentCreate = onDocumentCreated(
  "comments/{activityId}/{commentId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const { activityId } = event.params;
    const comment = snapshot.data();

    // commentCount 증가
    const activityRef = db.collection("activities").doc(activityId);
    await activityRef.update({
      commentCount: admin.firestore.FieldValue.increment(1),
    });

    // 활동 소유자에게 알림
    const activitySnap = await activityRef.get();
    if (!activitySnap.exists) return;

    const activity = activitySnap.data()!;
    if (activity.userId === comment.userId) return; // 자기 활동에 댓글은 알림 X

    await db
      .collection("notifications")
      .doc(activity.userId)
      .collection("items")
      .add({
        type: "comment",
        fromUserId: comment.userId,
        fromNickname: comment.nickname || "",
        fromProfileImage: comment.profileImage || null,
        activityId,
        segmentId: null,
        message: `${comment.nickname}님이 댓글을 남겼습니다: "${truncate(comment.text, 50)}"`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  }
);

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}
