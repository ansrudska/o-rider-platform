import * as admin from "firebase-admin";

admin.initializeApp();

export { onActivityCreate } from "./activity";
export { onKudosCreate, onKudosDelete } from "./kudos";
export { onCommentCreate } from "./comment";
export { onFollowCreate, onFollowDelete } from "./follow";
export { ensureUserProfile } from "./auth";
export {
  stravaExchangeToken,
  stravaImportActivities,
  stravaGetActivityStreams,
  stravaBatchFetchStreams,
  stravaDisconnect,
  stravaDeleteUserData,
  stravaMigrationStart,
  stravaMigrationComplete,
} from "./strava";
