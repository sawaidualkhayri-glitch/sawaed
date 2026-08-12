/* ==========================================================================
   START SECTION: Firebase SDK Initialization & Configuration
   ========================================================================== */

// src/firebase.js
  import { initializeApp, getApps, getApp } from "firebase/app";
  import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
  import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
  import { getMessaging, getToken } from "firebase/messaging";
  import { getAnalytics, isSupported } from "firebase/analytics";
  import firebaseConfig from "./firebaseConfig";

  /* --- START SUBSECTION: Firebase Configuration Validation --- */
  const hasFirebaseConfig = Boolean(
    firebaseConfig?.apiKey &&
    firebaseConfig?.authDomain &&
    firebaseConfig?.projectId &&
    firebaseConfig?.appId
  );

  export const isFirebaseConfigured = hasFirebaseConfig;
  /* --- END SUBSECTION: Firebase Configuration Validation --- */

  /* --- START SUBSECTION: Firebase App Initialization --- */
  export const app = hasFirebaseConfig
    ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
    : null;
  /* --- END SUBSECTION: Firebase App Initialization --- */

  /* --- START SUBSECTION: Google Analytics Setup --- */
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
  /* --- END SUBSECTION: Google Analytics Setup --- */

  export { firebaseConfig };

  /* --- START SUBSECTION: Firebase Authentication Module --- */
  export const auth = hasFirebaseConfig ? getAuth(app) : { currentUser: null };
  if (hasFirebaseConfig) {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  }
  /* --- END SUBSECTION: Firebase Authentication Module --- */

  /* --- START SUBSECTION: Firebase Firestore Database Module --- */
  export const db = hasFirebaseConfig ? getFirestore(app) : null;
  /* --- END SUBSECTION: Firebase Firestore Database Module --- */

  /* --- START SUBSECTION: Firebase Cloud Messaging Module --- */
  export const messaging = hasFirebaseConfig ? getMessaging(app) : null;
  /* --- END SUBSECTION: Firebase Cloud Messaging Module --- */

  /* --- START SUBSECTION: FCM Token Registration & Storage --- */
  export async function requestFCMToken() {
    if (!hasFirebaseConfig || !db || !messaging || !("Notification" in window)) return null;

    try {
      console.log("[Step 1] Checking Notification.permission state:", Notification.permission);
      if (Notification.permission !== "granted") {
        console.warn("[Step 1] Notification permission not granted yet; aborting FCM token generation.");
        return null;
      }

      console.log("[Step 2] Calling Notification.requestPermission()...");
      const permission = await Notification.requestPermission();
      console.log("[Step 2] Notification.requestPermission() resolved to:", permission);
      if (permission !== "granted") return null;

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || import.meta.env.EBASE_VAPID_KEY || "";
      if (!vapidKey) {
        console.warn("[Step 2] FCM VAPID key is not configured");
        return null;
      }

      let registration = await navigator.serviceWorker.getRegistration("/");
      if (!registration) {
        console.log("[Step 3] Calling navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })");
        registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
        console.log("[Step 3] Registration result:", registration);
      } else {
        console.log("[Step 3] Reusing existing root service worker registration:", registration);
      }

      const token = await (async () => {
        console.log("[Step 4] Executing getToken(messaging, { vapidKey, serviceWorkerRegistration })");
        try {
          const value = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: registration,
          });
          console.log("[Step 4] getToken returned:", value);
          return value;
        } catch (err) {
          console.error("[Step 4] getToken rejected with full stack:", err?.stack || err);
          throw err;
        }
      })();

      if (!token) {
        console.warn("[Step 4] getToken returned an empty token.");
        return null;
      }

      try {
        console.log("[Step 5] Upserting token into Firestore collection: fcm_tokens");
        await setDoc(doc(db, "fcm_tokens", token), {
          token,
          uid: auth?.currentUser?.uid || null,
          email: auth?.currentUser?.email || null,
          userAgent: navigator.userAgent,
          platform: navigator.platform || "unknown",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        }, { merge: true });
        console.log("[Step 5] Firestore write succeeded for token:", token);
      } catch (firestoreErr) {
        console.error("[Step 5] Firestore write failed. This is likely a Firestore Security Rules issue:", firestoreErr?.stack || firestoreErr);
        throw firestoreErr;
      }

      return token;
    } catch (err) {
      console.error("FCM token registration failed with full stack:", err?.stack || err);
      return null;
    }
  }
  /* --- END SUBSECTION: FCM Token Registration & Storage --- */

  /* --- START SUBSECTION: Editor Provisioning Secondary Auth Instance --- */
  export const getEditorProvisioningAuth = () => {
    if (!hasFirebaseConfig) return auth;
    const existing = getApps().find((candidate) => candidate.name === "editor-provisioning");
    if (existing) return getAuth(existing);
    const editorApp = initializeApp(firebaseConfig, "editor-provisioning");
    return getAuth(editorApp);
  };
  /* --- END SUBSECTION: Editor Provisioning Secondary Auth Instance --- */

  export { analytics };
  export default app;

/* ==========================================================================
   END SECTION: Firebase SDK Initialization & Configuration
   ========================================================================== */