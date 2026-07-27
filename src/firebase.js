// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "./firebaseConfig";

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export { firebaseConfig };
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
export const db = getFirestore(app);

export const getEditorProvisioningAuth = () => {
  const existing = getApps().find((candidate) => candidate.name === "editor-provisioning");
  if (existing) return getAuth(existing);
  const editorApp = initializeApp(firebaseConfig, "editor-provisioning");
  return getAuth(editorApp);
};

export default app;