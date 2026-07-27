/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { logoutUser } from "./firebaseAuth";
import { cacheJson, clearCachedJson, getCachedJson } from "./offlineHandler";

const AuthContext = createContext(null);

export function normalizeUserRole(role) {
  const normalized = (role || "").trim();
  switch (normalized) {
    case "super_admin":
    case "admin":
      return "super_admin";
    case "editor_full":
    case "all":
      return "editor_full";
    case "editor_malazem":
    case "editor_materials":
    case "editor_study":
    case "notes":
      return "editor_malazem";
    case "editor_taasees":
    case "editor_tasiss":
    case "foundation":
      return "editor_taasees";
    case "editor_news":
    case "content":
      return "editor_news";
    case "custom":
      return "custom";
    default:
      return normalized || "user";
  }
}

export const ALL_EDITOR_ROLES = ["super_admin", "admin", "editor_full", "editor_malazem", "editor_taasees", "editor_news"];

export const isAnyEditor = (role) => ALL_EDITOR_ROLES.includes(normalizeUserRole(role));
export const canManageEditors = (role) => ["super_admin", "admin"].includes(normalizeUserRole(role));
export const canManageMalazem = (role) => ["super_admin", "admin", "editor_full", "editor_malazem"].includes(normalizeUserRole(role));
export const canManageTaasees = (role) => ["super_admin", "admin", "editor_full", "editor_taasees"].includes(normalizeUserRole(role));
export const canManageNews = (role) => ["super_admin", "admin", "editor_full", "editor_news"].includes(normalizeUserRole(role));

function buildUserProfile(firebaseUser, profile = {}) {
  const uid = firebaseUser.uid;
  const role = normalizeUserRole(profile.role || "user");
  const displayName = profile.displayName || profile.fullName || firebaseUser.displayName || "مستخدم";
  const fullName = profile.fullName || firebaseUser.displayName || "مستخدم";
  const grade = profile.grade || "";
  const branch = profile.branch || profile.stream || "";
  const stream = profile.stream || profile.branch || "";
  const hasProfileData = Boolean((grade || "").trim() && (stream || branch || "").trim());
  const profileCompleted = profile.profileCompleted === true || hasProfileData;

  return {
    id: uid,
    uid,
    email: firebaseUser.email || profile.email || "",
    displayName,
    fullName,
    username: displayName,
    nickname: profile.nickname || displayName,
    ...profile,
    grade,
    branch,
    stream,
    progress: profile.progress || {},
    savedItems: profile.savedItems || [],
    pinnedNews: profile.pinnedNews || [],
    profileCompleted,
    role,
    isAdmin: role === "super_admin",
  };
}

function shouldRequireOnboarding(profile = {}, role = null) {
  const normalizedRole = normalizeUserRole(role || profile?.role || "user");
  if (isAnyEditor(normalizedRole)) return false;
  const grade = (profile?.grade || "").toString().trim();
  const branch = (profile?.branch || profile?.stream || "").toString().trim();
  return !grade || !branch;
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const applyUserProfile = useCallback((profile, incomingFirebaseUser = null) => {
    const safeUser = buildUserProfile(incomingFirebaseUser || { uid: profile?.uid || profile?.id || "", email: profile?.email || "", displayName: profile?.displayName || profile?.fullName || "" }, profile || {});
    setCurrentUser(safeUser);
    setNeedsOnboarding(shouldRequireOnboarding(safeUser, safeUser.role));
    try { localStorage.setItem("sawaed_user", JSON.stringify(safeUser)); } catch (error) { console.warn("Failed to cache user locally:", error); }
    try { cacheJson("sawaed_user_profile", safeUser); } catch (error) { console.warn("Failed to cache user profile in IndexedDB:", error); }
    setAuthLoading(false);
    return safeUser;
  }, []);

  useEffect(() => {
    const handleProfileEvent = (event) => {
      const { profile, firebaseUser: incomingFirebaseUser } = event.detail || {};
      if (!profile) return;
      setFirebaseUser(incomingFirebaseUser || { uid: profile.uid || profile.id || "", email: profile.email || "", displayName: profile.displayName || profile.fullName || "" });
      applyUserProfile(profile, incomingFirebaseUser || { uid: profile.uid || profile.id || "", email: profile.email || "", displayName: profile.displayName || profile.fullName || "" });
    };

    window.addEventListener("sawaed-auth-profile", handleProfileEvent);
    return () => window.removeEventListener("sawaed-auth-profile", handleProfileEvent);
  }, [applyUserProfile]);

  useEffect(() => {
    let mounted = true;

    const restoreCachedSession = async () => {
      try {
        const raw = localStorage.getItem("sawaed_user");
        if (raw) {
          const cached = JSON.parse(raw);
          if (mounted) {
            setCurrentUser(cached);
            setNeedsOnboarding(shouldRequireOnboarding(cached, cached?.role));
          }
        } else {
          const cachedFromIdb = await getCachedJson("sawaed_user_profile");
          if (cachedFromIdb && mounted) {
            setCurrentUser(cachedFromIdb);
            setNeedsOnboarding(shouldRequireOnboarding(cachedFromIdb, cachedFromIdb?.role));
          }
        }
      } catch (error) {
        console.warn("Failed to restore cached session:", error);
        try {
          const cachedFromIdb = await getCachedJson("sawaed_user_profile");
          if (cachedFromIdb && mounted) {
            setCurrentUser(cachedFromIdb);
            setNeedsOnboarding(shouldRequireOnboarding(cachedFromIdb, cachedFromIdb?.role));
          }
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
          setNeedsOnboarding(shouldRequireOnboarding(cached, cached?.role));
          setAuthLoading(false);
          return;
        }

        setCurrentUser(null);
        setNeedsOnboarding(false);
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
          if (!profile.branch && profile.stream) updateData.branch = profile.stream;
          if (Object.keys(updateData).length > 0) {
            await setDoc(userRef, updateData, { merge: true });
            profile = { ...profile, ...updateData };
          }
        }

        const safeUser = buildUserProfile(user, profile);
        setCurrentUser(safeUser);
        setNeedsOnboarding(shouldRequireOnboarding(safeUser, safeUser.role));
        try { localStorage.setItem("sawaed_user", JSON.stringify(safeUser)); } catch (error) { console.warn("Failed to cache user locally:", error); }
        try { await cacheJson("sawaed_user_profile", safeUser); } catch (error) { console.warn("Failed to cache user profile in IndexedDB:", error); }
      } catch (error) {
        console.warn("Failed to load Firestore profile:", error);
        const fallback = buildUserProfile(user, {});
        setCurrentUser(fallback);
        setNeedsOnboarding(shouldRequireOnboarding(fallback, fallback.role));
        try { localStorage.setItem("sawaed_user", JSON.stringify(fallback)); } catch (cacheError) { console.warn("Failed to cache fallback user locally:", cacheError); }
      }

      if (mounted) setAuthLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const role = normalizeUserRole(currentUser?.role || "user");
  const isAdmin = role === "super_admin";

  const updateUserProfile = useCallback(async (data) => {
    const normalizedData = { ...(data || {}) };
    const updated = {
      ...(currentUser || {}),
      ...normalizedData,
      profileCompleted: normalizedData.profileCompleted === true || Boolean((normalizedData.grade ?? (currentUser?.grade || "")).toString().trim() && ((normalizedData.stream ?? normalizedData.branch ?? (currentUser?.stream || currentUser?.branch || "")).toString().trim())),
      grade: normalizedData.grade ?? (currentUser?.grade || ""),
      branch: normalizedData.branch ?? normalizedData.stream ?? (currentUser?.branch || currentUser?.stream || ""),
      stream: normalizedData.stream ?? normalizedData.branch ?? (currentUser?.stream || currentUser?.branch || ""),
      updatedAt: new Date().toISOString(),
    };

    const normalizedRole = normalizeUserRole(normalizedData.role || currentUser?.role || "user");
    const requiresOnboarding = shouldRequireOnboarding(updated, normalizedRole);
    setCurrentUser(updated);
    setNeedsOnboarding(requiresOnboarding);
    try { localStorage.setItem("sawaed_user", JSON.stringify(updated)); } catch (error) { console.warn("Failed to cache updated user locally:", error); }
    try {
      const uid = firebaseUser?.uid || updated?.uid || currentUser?.uid;
      if (uid) {
        localStorage.setItem(`profileCompleted_${uid}`, String(updated.profileCompleted));
      }
    } catch (error) { console.warn("Failed to cache profile completion flag locally:", error); }
    try { await cacheJson("sawaed_user_profile", updated); } catch (error) { console.warn("Failed to cache updated user profile in IndexedDB:", error); }

    if (!firebaseUser) return updated;

    const uid = firebaseUser.uid;
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      ...normalizedData,
      profileCompleted: updated.profileCompleted,
      grade: updated.grade,
      branch: updated.branch,
      stream: updated.stream,
      updatedAt: serverTimestamp(),
    });

    const username = (updated.username || updated.displayName || updated.fullName || currentUser?.username || currentUser?.displayName || "").toString().trim();
    if (username) {
      await setDoc(doc(db, "usernames", username.toLowerCase()), {
        uid,
        grade: updated.grade,
        branch: updated.branch,
        stream: updated.stream,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

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
      needsOnboarding,
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
