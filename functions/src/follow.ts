import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * 팔로우 생성 시: followers 컬렉션에 역방향 추가 + 알림
 */
export const onFollowCreate = onDocumentCreated(
  "following/{userId}/{targetId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const { userId, targetId } = event.params;
    const followData = snapshot.data();

    // 역방향 followers 추가
    await db
      .collection("followers")
      .doc(targetId)
      .collection("users")
      .doc(userId)
      .set({
        userId,
        nickname: followData.nickname || "",
        profileImage: followData.profileImage || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // 팔로우 대상에게 알림
    await db
      .collection("notifications")
      .doc(targetId)
      .collection("items")
      .add({
        type: "follow",
        fromUserId: userId,
        fromNickname: followData.nickname || "",
        fromProfileImage: followData.profileImage || null,
        activityId: null,
        segmentId: null,
        message: `${followData.nickname}님이 회원님을 팔로우하기 시작했습니다.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  }
);

/**
 * 팔로우 삭제 시: followers 컬렉션에서 역방향 제거
 */
export const onFollowDelete = onDocumentDeleted(
  "following/{userId}/{targetId}",
  async (event) => {
    const { userId, targetId } = event.params;

    await db
      .collection("followers")
      .doc(targetId)
      .collection("users")
      .doc(userId)
      .delete();
  }
);
