/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { logoutUser } from "./firebaseAuth";
import { cacheJson, clearCachedJson, getCachedJson } from "./offlineHandler";

const AuthContext = createContext(null);

function buildUserProfile(firebaseUser, profile = {}) {
  const uid = firebaseUser.uid;
  const role = profile.role || "user";
  const displayName = profile.displayName || profile.fullName || firebaseUser.displayName || "مستخدم";
  const fullName = profile.fullName || firebaseUser.displayName || "مستخدم";

  return {
    id: uid,
    uid,
    email: firebaseUser.email || profile.email || "",
    displayName,
    fullName,
    username: displayName,
    nickname: profile.nickname || displayName,
    grade: profile.grade || "",
    branch: profile.branch || "",
    stream: profile.stream || profile.branch || "",
    progress: profile.progress || {},
    savedItems: profile.savedItems || [],
    pinnedNews: profile.pinnedNews || [],
    role,
    isAdmin: role === "admin",
    ...profile,
  };
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const restoreCachedSession = async () => {
      try {
        const raw = localStorage.getItem("sawaed_user");
        if (raw) {
          const cached = JSON.parse(raw);
          if (mounted) setCurrentUser(cached);
        } else {
          const cachedFromIdb = await getCachedJson("sawaed_user_profile");
          if (cachedFromIdb && mounted) setCurrentUser(cachedFromIdb);
        }
      } catch (error) {
        console.warn("Failed to restore cached session:", error);
        try {
          const cachedFromIdb = await getCachedJson("sawaed_user_profile");
          if (cachedFromIdb && mounted) setCurrentUser(cachedFromIdb);
        } catch (innerError) {
          console.warn("Failed to read cached profile from IndexedDB:", innerError);
        }
      }
    };

    restoreCachedSession();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        const cached = (() => {
          try {
            const raw = localStorage.getItem("sawaed_user");
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        })();

        if (cached) {
          setCurrentUser(cached);
          setAuthLoading(false);
          return;
        }

        setCurrentUser(null);
        try { localStorage.removeItem("sawaed_user"); } catch (error) { console.warn("Failed to remove cached user:", error); }
        setAuthLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        let profile = snap.exists() ? snap.data() : null;

        if (!profile) {
          profile = {
            uid: user.uid,
            fullName: user.displayName || "مستخدم",
            displayName: user.displayName || "مستخدم",
            username: user.displayName || "مستخدم",
            nickname: user.displayName || "مستخدم",
            email: user.email || "",
            role: "user",
            grade: "",
            branch: "",
            stream: "",
            progress: {},
            savedItems: [],
            pinnedNews: [],
            emailVerified: user.emailVerified,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
          };
          await setDoc(userRef, profile);
        } else {
          const updateData = {};
          if (!profile.role) updateData.role = "user";
          if (!profile.stream && profile.branch) updateData.stream = profile.branch;
          if (Object.keys(updateData).length > 0) {
            await setDoc(userRef, updateData, { merge: true });
            profile = { ...profile, ...updateData };
          }
        }

        const safeUser = buildUserProfile(user, profile);
        setCurrentUser(safeUser);
        try { localStorage.setItem("sawaed_user", JSON.stringify(safeUser)); } catch (error) { console.warn("Failed to cache user locally:", error); }
        try { await cacheJson("sawaed_user_profile", safeUser); } catch (error) { console.warn("Failed to cache user profile in IndexedDB:", error); }
      } catch (error) {
        console.warn("Failed to load Firestore profile:", error);
        const fallback = buildUserProfile(user, {});
        setCurrentUser(fallback);
        try { localStorage.setItem("sawaed_user", JSON.stringify(fallback)); } catch (cacheError) { console.warn("Failed to cache fallback user locally:", cacheError); }
      }

      if (mounted) setAuthLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const role = currentUser?.role || "user";
  const isAdmin = role === "admin";

  const updateUserProfile = useCallback(async (data) => {
    const updated = { ...(currentUser || {}), ...data, updatedAt: new Date().toISOString() };
    setCurrentUser(updated);
    try { localStorage.setItem("sawaed_user", JSON.stringify(updated)); } catch (error) { console.warn("Failed to cache updated user locally:", error); }
    try { await cacheJson("sawaed_user_profile", updated); } catch (error) { console.warn("Failed to cache updated user profile in IndexedDB:", error); }

    if (!firebaseUser) return updated;

    await setDoc(doc(db, "users", firebaseUser.uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    return updated;
  }, [firebaseUser, currentUser]);

  const logout = useCallback(async () => {
    await logoutUser();
    setCurrentUser(null);
    setFirebaseUser(null);
    setAuthLoading(false);

    const localKeys = ["sawaed_user", "sawaed_user_selection", "cached_profile"];
    for (const key of localKeys) {
      try { localStorage.removeItem(key); } catch (error) { console.warn(`Failed to remove local key ${key}:`, error); }
    }

    try { await clearCachedJson("sawaed_user_profile"); } catch (error) { console.warn("Failed to clear cached user profile:", error); }
  }, []);

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      currentUser,
      role,
      isAdmin,
      authLoading,
      updateUserProfile,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
