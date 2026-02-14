/**
 * 그룹 시스템 RTDB → Firestore 마이그레이션 스크립트
 *
 * 실행 방법:
 *   cd functions
 *   npx ts-node src/migrate-groups-to-firestore.ts
 *
 * 마이그레이션 대상:
 *   RTDB /groups/           → Firestore groups/{groupId}
 *   RTDB /group_members/    → Firestore groups/{groupId}/members/{userId}
 *   RTDB /user_groups/      → Firestore users/{userId}.currentGroupId
 *   RTDB /group_invitations → Firestore group_invitations/{userId}/items/{groupId}
 *
 * 완료 후 RTDB에서 해당 경로 삭제
 */

import * as admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://orider-1ce26-default-rtdb.asia-southeast1.firebasedatabase.app",
});

const db = admin.database();
const firestore = admin.firestore();

async function migrateGroups(): Promise<number> {
  console.log("\n=== 1. 그룹 메타데이터 마이그레이션 ===");
  const groupsSnap = await db.ref("groups").once("value");
  const groupsData = groupsSnap.val() || {};
  const groupIds = Object.keys(groupsData);
  console.log(`RTDB /groups/ 에 ${groupIds.length}개 그룹 발견`);

  const batch = firestore.batch();
  let count = 0;

  for (const groupId of groupIds) {
    const group = groupsData[groupId];
    const ref = firestore.collection("groups").doc(groupId);
    batch.set(ref, {
      name: group.name || "",
      creatorId: group.creatorId || "",
      createdAt: group.createdAt || 0,
      isActive: group.isActive ?? true,
      inviteCode: group.inviteCode || "",
    });
    count++;
  }

  if (count > 0) {
    await batch.commit();
  }
  console.log(`✅ ${count}개 그룹 → Firestore groups/ 마이그레이션 완료`);
  return count;
}

async function migrateGroupMembers(): Promise<number> {
  console.log("\n=== 2. 그룹 멤버 마이그레이션 ===");
  const membersSnap = await db.ref("group_members").once("value");
  const membersData = membersSnap.val() || {};
  const groupIds = Object.keys(membersData);
  console.log(`RTDB /group_members/ 에 ${groupIds.length}개 그룹의 멤버 데이터 발견`);

  let totalCount = 0;

  // Firestore batch는 최대 500개 operation이므로 그룹별로 나눠서 처리
  for (const groupId of groupIds) {
    const groupMembers = membersData[groupId] || {};
    const memberIds = Object.keys(groupMembers);

    if (memberIds.length === 0) continue;

    const batch = firestore.batch();
    for (const userId of memberIds) {
      const member = groupMembers[userId];
      const ref = firestore
        .collection("groups")
        .doc(groupId)
        .collection("members")
        .doc(userId);

      // status 필드 우선, 없으면 isOnline boolean 폴백
      let status = "offline";
      if (typeof member.status === "string") {
        status = member.status;
      } else if (member.isOnline === true) {
        status = "online";
      }

      batch.set(ref, {
        joinedAt: member.joinedAt || 0,
        status: status,
      });
      totalCount++;
    }
    await batch.commit();
    console.log(`  그룹 ${groupId}: ${memberIds.length}명 마이그레이션`);
  }

  console.log(`✅ 총 ${totalCount}명 멤버 → Firestore groups/*/members/ 마이그레이션 완료`);
  return totalCount;
}

async function migrateUserGroups(): Promise<number> {
  console.log("\n=== 3. 사용자-그룹 매핑 마이그레이션 ===");
  const userGroupsSnap = await db.ref("user_groups").once("value");
  const userGroupsData = userGroupsSnap.val() || {};
  const userIds = Object.keys(userGroupsData);
  console.log(`RTDB /user_groups/ 에 ${userIds.length}명의 사용자-그룹 매핑 발견`);

  let count = 0;

  // 500개씩 나눠서 배치 처리
  for (let i = 0; i < userIds.length; i += 400) {
    const batch = firestore.batch();
    const chunk = userIds.slice(i, i + 400);

    for (const userId of chunk) {
      const userGroup = userGroupsData[userId];
      const currentGroupId = userGroup?.currentGroupId;
      if (!currentGroupId) continue;

      const ref = firestore.collection("users").doc(userId);
      batch.set(ref, { currentGroupId }, { merge: true });
      count++;
    }
    await batch.commit();
  }

  console.log(`✅ ${count}명 → Firestore users/{uid}.currentGroupId 마이그레이션 완료`);
  return count;
}

async function migrateGroupInvitations(): Promise<number> {
  console.log("\n=== 4. 그룹 초대 마이그레이션 ===");
  const invitationsSnap = await db.ref("group_invitations").once("value");
  const invitationsData = invitationsSnap.val() || {};
  const userIds = Object.keys(invitationsData);
  console.log(`RTDB /group_invitations/ 에 ${userIds.length}명의 초대 데이터 발견`);

  let totalCount = 0;

  for (const userId of userIds) {
    const userInvitations = invitationsData[userId] || {};
    const groupIds = Object.keys(userInvitations);

    if (groupIds.length === 0) continue;

    const batch = firestore.batch();
    for (const groupId of groupIds) {
      const invitation = userInvitations[groupId];
      const ref = firestore
        .collection("group_invitations")
        .doc(userId)
        .collection("items")
        .doc(groupId);

      batch.set(ref, {
        groupName: invitation.groupName || "",
        inviterId: invitation.inviterId || "",
        invitedAt: invitation.invitedAt || 0,
      });
      totalCount++;
    }
    await batch.commit();
    console.log(`  사용자 ${userId}: ${groupIds.length}개 초대 마이그레이션`);
  }

  console.log(`✅ 총 ${totalCount}개 초대 → Firestore group_invitations/ 마이그레이션 완료`);
  return totalCount;
}

async function deleteRtdbData(): Promise<void> {
  console.log("\n=== 5. RTDB 그룹 데이터 삭제 ===");

  const paths = ["/groups", "/group_members", "/user_groups", "/group_invitations"];

  for (const path of paths) {
    await db.ref(path).remove();
    console.log(`  🗑️  ${path} 삭제 완료`);
  }

  console.log("✅ RTDB 그룹 관련 데이터 삭제 완료");
}

async function main(): Promise<void> {
  console.log("🚀 그룹 시스템 RTDB → Firestore 마이그레이션 시작\n");

  try {
    const groupCount = await migrateGroups();
    const memberCount = await migrateGroupMembers();
    const userGroupCount = await migrateUserGroups();
    const invitationCount = await migrateGroupInvitations();

    console.log("\n=== 마이그레이션 요약 ===");
    console.log(`  그룹: ${groupCount}개`);
    console.log(`  멤버: ${memberCount}명`);
    console.log(`  사용자-그룹 매핑: ${userGroupCount}개`);
    console.log(`  초대: ${invitationCount}개`);

    // RTDB 데이터 삭제 확인
    const readline = await import("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const answer = await new Promise<string>((resolve) => {
      rl.question("\nRTDB 그룹 데이터를 삭제하시겠습니까? (yes/no): ", resolve);
    });
    rl.close();

    if (answer.toLowerCase() === "yes") {
      await deleteRtdbData();
    } else {
      console.log("RTDB 데이터 삭제를 건너뜁니다. 수동으로 삭제하세요.");
    }

    console.log("\n✅ 마이그레이션 완료!");
  } catch (error) {
    console.error("❌ 마이그레이션 실패:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
