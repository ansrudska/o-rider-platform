import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * 친구 관계 생성 시:
 * 1. 역방향 친구 관계 자동 생성 (양방향)
 * 2. 알림 발송
 */
export const onFriendCreate = onDocumentCreated(
  "friends/{userA}/users/{userB}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const { userA, userB } = event.params;
    const data = snapshot.data();

    // 1. 역방향 존재 여부 확인 (무한 루프 방지)
    const reverseRef = db
      .collection("friends")
      .doc(userB)
      .collection("users")
      .doc(userA);
    const reverseSnap = await reverseRef.get();

    if (!reverseSnap.exists) {
      const userAProfile = await db.doc(`users/${userA}`).get();
      const profileData = userAProfile.data();
      await reverseRef.set({
        userId: userA,
        nickname: profileData?.nickname || "",
        profileImage: profileData?.photoURL || null,
        friendCode: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // 2. 상대에게 알림
    await db
      .collection("notifications")
      .doc(userB)
      .collection("items")
      .add({
        type: "friend_accept",
        fromUserId: userA,
        fromNickname: data.nickname || "",
        fromProfileImage: data.profileImage || null,
        activityId: null,
        segmentId: null,
        message: `${data.nickname || "누군가"}님과 친구가 되었습니다.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  }
);

/**
 * 친구 관계 삭제 시: 역방향 삭제
 */
export const onFriendDelete = onDocumentDeleted(
  "friends/{userA}/users/{userB}",
  async (event) => {
    const { userA, userB } = event.params;

    const reverseRef = db
      .collection("friends")
      .doc(userB)
      .collection("users")
      .doc(userA);
    const reverseSnap = await reverseRef.get();
    if (reverseSnap.exists) {
      await reverseRef.delete();
    }
  }
);

/**
 * 친구 요청 생성 시: 알림 발송
 */
export const onFriendRequestCreate = onDocumentCreated(
  "friend_requests/{targetId}/items/{requesterId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const { targetId } = event.params;
    const data = snapshot.data();

    await db
      .collection("notifications")
      .doc(targetId)
      .collection("items")
      .add({
        type: "friend_request",
        fromUserId: data.requesterId,
        fromNickname: data.nickname || "",
        fromProfileImage: data.profileImage || null,
        activityId: null,
        segmentId: null,
        message: `${data.nickname || "누군가"}님이 친구 요청을 보냈습니다.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  }
);

/**
 * 친구 요청 수락 (callable)
 * - friend_requests 삭제
 * - friends/{me}/users/{requester} 생성 → onFriendCreate가 양방향 처리
 */
export const acceptFriendRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

  const { requesterId } = request.data as { requesterId: string };
  if (!requesterId) throw new HttpsError("invalid-argument", "requesterId required");

  const myUid = request.auth.uid;

  // 요청 존재 확인
  const requestRef = db
    .collection("friend_requests")
    .doc(myUid)
    .collection("items")
    .doc(requesterId);
  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) {
    throw new HttpsError("not-found", "Friend request not found");
  }

  // 이미 친구인지 확인
  const existingFriend = await db
    .collection("friends")
    .doc(myUid)
    .collection("users")
    .doc(requesterId)
    .get();
  if (existingFriend.exists) {
    await requestRef.delete();
    return { alreadyFriends: true };
  }

  // 내 프로필 조회
  const myProfile = await db.doc(`users/${myUid}`).get();
  const myData = myProfile.data();

  // 친구 관계 생성 (onFriendCreate가 양방향 처리)
  await db
    .collection("friends")
    .doc(myUid)
    .collection("users")
    .doc(requesterId)
    .set({
      userId: requesterId,
      nickname: requestSnap.data()?.nickname || "",
      profileImage: requestSnap.data()?.profileImage || null,
      friendCode: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // 요청 삭제
  await requestRef.delete();

  // 상대방의 요청도 있으면 삭제 (동시 요청 케이스)
  const reverseRequest = db
    .collection("friend_requests")
    .doc(requesterId)
    .collection("items")
    .doc(myUid);
  const reverseSnap = await reverseRequest.get();
  if (reverseSnap.exists) {
    await reverseRequest.delete();
  }

  return {
    success: true,
    friendId: requesterId,
    myNickname: myData?.nickname || "",
  };
});

/**
 * 친구코드로 친구 추가 (callable)
 * - Firestore users/ 에서 friendCode 조회
 * - friends/{me}/users/{target} 생성 → onFriendCreate가 양방향 처리
 */
export const addFriendByCode = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

  const { friendCode } = request.data as { friendCode: string };
  if (!friendCode) throw new HttpsError("invalid-argument", "friendCode required");

  const myUid = request.auth.uid;

  // Firestore users/에서 friendCode로 검색
  const usersSnap = await db
    .collection("users")
    .where("friendCode", "==", friendCode)
    .limit(1)
    .get();

  if (usersSnap.empty) {
    throw new HttpsError("not-found", "해당 친구코드의 사용자를 찾을 수 없습니다.");
  }

  const targetUid = usersSnap.docs[0].id;

  if (targetUid === myUid) {
    throw new HttpsError("invalid-argument", "자기 자신을 친구로 추가할 수 없습니다.");
  }

  // 이미 친구인지 확인
  const existingFriend = await db
    .collection("friends")
    .doc(myUid)
    .collection("users")
    .doc(targetUid)
    .get();
  if (existingFriend.exists) {
    return { alreadyFriends: true, friendId: targetUid };
  }

  // 상대 프로필 조회
  const targetProfile = await db.doc(`users/${targetUid}`).get();
  const targetData = targetProfile.data();

  // 친구 관계 생성 (onFriendCreate가 양방향 처리)
  await db
    .collection("friends")
    .doc(myUid)
    .collection("users")
    .doc(targetUid)
    .set({
      userId: targetUid,
      nickname: targetData?.nickname || "",
      profileImage: targetData?.photoURL || null,
      friendCode: friendCode,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  return {
    success: true,
    friendId: targetUid,
    friendNickname: targetData?.nickname || "",
  };
});

