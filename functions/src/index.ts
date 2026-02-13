import * as admin from "firebase-admin";

admin.initializeApp();

export { onActivityCreate } from "./activity";
export { onKudosCreate, onKudosDelete } from "./kudos";
export { onCommentCreate } from "./comment";
export { onFollowCreate, onFollowDelete } from "./follow";
export { ensureUserProfile, updateDefaultVisibility } from "./auth";
export {
  stravaExchangeToken,
  stravaGetActivityStreams,
  stravaDisconnect,
  stravaDeleteUserData,
  stravaWebhook,
  stravaQueueEnqueue,
  stravaQueueCancel,
  stravaQueueProcessor,
  stravaMigrationVerify,
  stravaMigrationFix,
} from "./strava";
export { scheduledFirestoreBackup } from "./backup";
export { proxyPhotoDownload } from "./export";
