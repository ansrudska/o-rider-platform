import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

const BUCKET = "gs://orider-1ce26-backups";
const PROJECT = "orider-1ce26";

/**
 * Firestore 전체 백업 (3시간마다)
 * - GCS 버킷에 타임스탬프 폴더로 export
 * - 버킷 lifecycle 정책으로 3일 후 자동 삭제
 */
export const scheduledFirestoreBackup = onSchedule(
  { schedule: "every 3 hours", timeZone: "Asia/Seoul" },
  async () => {
    const client = new admin.firestore.v1.FirestoreAdminClient();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputUri = `${BUCKET}/firestore/${timestamp}`;

    const [response] = await client.exportDocuments({
      name: `projects/${PROJECT}/databases/(default)`,
      outputUriPrefix: outputUri,
      collectionIds: [], // empty = all collections
    });

    console.log(`Firestore backup started: ${response.name}`);
    console.log(`Output: ${outputUri}`);
  },
);
