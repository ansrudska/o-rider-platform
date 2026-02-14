import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getDatabase, type Database } from "firebase/database";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";

let app: FirebaseApp;
let _auth: Auth;
let _firestore: Firestore;
let _database: Database | null = null;
let _storage: FirebaseStorage;
let _functions: Functions;

/** main.tsx에서 렌더링 전 호출. /__/firebase/init.json에서 config를 런타임 로드. */
export async function initFirebase() {
  const resp = await fetch("/__/firebase/init.json");
  const config = await resp.json();
  app = initializeApp(config);
  _auth = getAuth(app);
  _firestore = getFirestore(app);
  if (config.databaseURL) {
    _database = getDatabase(app);
  }
  _storage = getStorage(app);
  _functions = getFunctions(app);
}

export { _auth as auth, _firestore as firestore, _database as database, _storage as storage, _functions as functions };
export const googleProvider = new GoogleAuthProvider();


