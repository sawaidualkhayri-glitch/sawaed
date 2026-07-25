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
      } catch {
        try {
          const cachedFromIdb = await getCachedJson("sawaed_user_profile");
          if (cachedFromIdb && mounted) setCurrentUser(cachedFromIdb);
        } catch {}
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
        try { localStorage.removeItem("sawaed_user"); } catch {}
        setAuthLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const profile = snap.exists() ? snap.data() : {};
        const safeUser = buildUserProfile(user, profile);
        setCurrentUser(safeUser);
        try { localStorage.setItem("sawaed_user", JSON.stringify(safeUser)); } catch {}
        try { await cacheJson("sawaed_user_profile", safeUser); } catch {}
      } catch {
        const fallback = buildUserProfile(user, {});
        setCurrentUser(fallback);
        try { localStorage.setItem("sawaed_user", JSON.stringify(fallback)); } catch {}
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
    try { localStorage.setItem("sawaed_user", JSON.stringify(updated)); } catch {}
    try { await cacheJson("sawaed_user_profile", updated); } catch {}

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
      try { localStorage.removeItem(key); } catch {}
    }

    try { await clearCachedJson("sawaed_user_profile"); } catch {}
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
