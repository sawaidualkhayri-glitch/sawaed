// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import firebaseConfig from "./firebaseConfig";

const hasFirebaseConfig = Boolean(
  firebaseConfig?.apiKey &&
  firebaseConfig?.authDomain &&
  firebaseConfig?.projectId &&
  firebaseConfig?.appId
);

export const isFirebaseConfigured = hasFirebaseConfig;

export const app = hasFirebaseConfig
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

let analytics = null;
if (hasFirebaseConfig) {
  isSupported()
    .then((supported) => {
      if (supported) {
        try {
          analytics = getAnalytics(app);
        } catch (e) {
          console.warn("Analytics initialization failed", e);
        }
      }
    })
    .catch(() => {});
}

export { firebaseConfig };
export const auth = hasFirebaseConfig ? getAuth(app) : { currentUser: null };
if (hasFirebaseConfig) {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}
export const db = hasFirebaseConfig ? getFirestore(app) : null;

export const getEditorProvisioningAuth = () => {
  if (!hasFirebaseConfig) return auth;
  const existing = getApps().find((candidate) => candidate.name === "editor-provisioning");
  if (existing) return getAuth(existing);
  const editorApp = initializeApp(firebaseConfig, "editor-provisioning");
  return getAuth(editorApp);
};

export { analytics };
export default app;