/* ==========================================================================
   START SECTION: Firebase Configuration
   ========================================================================== */

  /* --- START SUBSECTION: Firebase Credentials from Environment Variables --- */
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "",
  };

  export default firebaseConfig;
  /* --- END SUBSECTION: Firebase Credentials from Environment Variables --- */

/* ==========================================================================
   END SECTION: Firebase Configuration
   ========================================================================== */