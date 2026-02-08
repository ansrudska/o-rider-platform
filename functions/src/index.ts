import * as admin from "firebase-admin";

admin.initializeApp();

export { onActivityCreate } from "./activity";
export { onKudosCreate, onKudosDelete } from "./kudos";
export { onCommentCreate } from "./comment";
export { onFollowCreate, onFollowDelete } from "./follow";
