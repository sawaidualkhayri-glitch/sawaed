import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendEmailVerification
} from "firebase/auth";
import { auth, db, getEditorProvisioningAuth } from "./firebase";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp, query, where, documentId } from "firebase/firestore";

const ADMIN_UID = "7gW0ECprv2YHPi6sHTQpmVnLbaC3";
const ADMIN_EMAIL = "nadahindi301@gmail.com";

async function isCurrentUserSuperAdmin() {
  if (auth.currentUser?.uid === ADMIN_UID) return true;
  const current = auth.currentUser;
  if (!current) return false;
  const email = (current.email || "").toLowerCase();
  if (current.uid === ADMIN_UID || email === ADMIN_EMAIL) return true;

  try {
    const selfDoc = await getDoc(doc(db, "users", current.uid));
    if (!selfDoc.exists()) return false;
    const role = (selfDoc.data()?.role || "").toString().trim().toLowerCase();
    return role === "super_admin" || role === "admin";
  } catch (error) {
    console.error("Failed to verify current user super-admin status", error);
    return false;
  }
}

export const sanitizeUsername = (value) => {
  const normalized = (value || "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "").slice(0, 60);
  return normalized || "user";
};

export const toSafeEmail = (username) => {
  const rawUsername = (username || "").trim();
  if (!rawUsername) return "user@sawaed.local";
  const cleanSlug = encodeURIComponent(rawUsername).replace(/%/g, "").toLowerCase();
  return `user_${cleanSlug}@sawaed.local`;
};

export const getInternalEmailForUsername = (username, email = "") => {
  const trimmedEmail = (email || "").trim();
  if (trimmedEmail) return trimmedEmail.toLowerCase();
  return toSafeEmail(username);
};

function normalizeRole(role) {
  const value = (role || "").toString().trim();
  return value || "user";
}

async function assertPrimarySuperAdminSession() {
  // Do not pre-emptively throw client-side permission errors.
  // Let Firestore security rules be the ultimate authority.
  return auth.currentUser;
}

async function setUsernameLookup({ username, email, uid }) {
  const trimmedUsername = (username || "").trim();
  if (!trimmedUsername) return;
  const lookupKey = trimmedUsername.toLowerCase();
  const resolvedEmail = (email || "").trim().toLowerCase();
  await setDoc(doc(db, "usernames", lookupKey), { uid, email: resolvedEmail || getInternalEmailForUsername(trimmedUsername, "") }, { merge: true });
}

async function deleteUsernameLookup(username) {
  const trimmedUsername = (username || "").trim();
  if (!trimmedUsername) return;
  await deleteDoc(doc(db, "usernames", trimmedUsername.toLowerCase()));
}

async function ensureUserProfile(firebaseUser, fallbackUsername = "", role = "user", extraProfile = {}) {
  const uid = firebaseUser?.uid || extraProfile?.uid;
  if (!uid) return null;

  const userRef = doc(db, "users", uid);
  const existingSnap = await getDoc(userRef);
  const existingProfile = existingSnap.exists() ? existingSnap.data() : {};

  const fullName = extraProfile.fullName || existingProfile.fullName || firebaseUser?.displayName || fallbackUsername || "مستخدم";
  const displayName = extraProfile.displayName || existingProfile.displayName || fullName;
  const username = extraProfile.username || existingProfile.username || fallbackUsername || displayName;
  const email = (extraProfile.email || existingProfile.email || firebaseUser?.email || "").trim();

  const profile = {
    uid,
    fullName,
    displayName,
    username,
    email,
    role: normalizeRole(extraProfile.role || existingProfile.role || role),
    lastLogin: serverTimestamp(),
    ...existingProfile,
    ...extraProfile,
  };

  await setDoc(userRef, profile, { merge: true });
  await setUsernameLookup({ username, email, uid });
  return profile;
}

// 1. تسجيل حساب جديد بالإيميل وباسورد
export const signUpWithEmail = async (email, password, fullName, extraProfile = {}) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const safeFullName = (fullName || "مستخدم").trim() || "مستخدم";

  auth.languageCode = "ar";
  await updateProfile(user, { displayName: safeFullName });
  await sendEmailVerification(user);

  const normalizedProfile = {
    ...extraProfile,
    branch: extraProfile.branch || extraProfile.stream || "",
    stream: extraProfile.stream || extraProfile.branch || "",
  };

  const usernameValue = (extraProfile.username || safeFullName || "").trim();
  await ensureUserProfile(user, safeFullName, "user", {
    ...normalizedProfile,
    username: usernameValue || safeFullName,
    fullName: safeFullName,
    displayName: safeFullName,
    email,
    role: "user",
    createdAt: serverTimestamp(),
    emailVerified: false,
  });

  return user;
};

// 2. تسجيل الدخول بإيميل وباسورد
export const loginWithEmail = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  return user;
};

async function resolveUsernameToEmail(identifier) {
  const trimmedIdentifier = (identifier || "").trim();
  if (!trimmedIdentifier) return null;

  const usernameDocRef = doc(db, "usernames", trimmedIdentifier.toLowerCase());
  try {
    const usernameDoc = await getDoc(usernameDocRef);
    if (!usernameDoc.exists()) {
      return null;
    }
    const resolvedEmail = (usernameDoc.data()?.email || "").trim();
    return resolvedEmail ? resolvedEmail.toLowerCase() : null;
  } catch (error) {
    if (error?.code === "permission-denied" || error?.message?.includes("permission")) {
      console.error("Username lookup blocked by Firestore permissions", error?.code, error?.message);
    }
    throw error;
  }
}

export const loginWithIdentifier = async (identifier, password) => {
  const trimmedIdentifier = (identifier || "").trim();
  if (!trimmedIdentifier || !password) {
    const err = new Error("Missing username or password");
    err.code = "auth/invalid-credential";
    throw err;
  }

  if (trimmedIdentifier.includes("@")) {
    const signedInUser = await loginWithEmail(trimmedIdentifier.toLowerCase(), password);
    await ensureUserProfile(signedInUser, trimmedIdentifier, "user", { email: signedInUser.email || trimmedIdentifier });
    return signedInUser;
  }

  const resolvedEmail = await resolveUsernameToEmail(trimmedIdentifier);
  if (!resolvedEmail) {
    // try legacy local pattern as fallback
    const fallbackEmail = `${trimmedIdentifier.toLowerCase()}@sawaed.local`;
    try {
      const signedInUserFallback = await loginWithEmail(fallbackEmail, password);
      const profileFallback = await ensureUserProfile(signedInUserFallback, trimmedIdentifier, "user", { email: fallbackEmail, username: trimmedIdentifier });
      if (typeof window !== "undefined") {
        const payload = {
          uid: signedInUserFallback?.uid,
          username: profileFallback?.username || trimmedIdentifier,
          role: profileFallback?.role || "user",
          email: fallbackEmail,
          fullName: profileFallback?.fullName || trimmedIdentifier,
          displayName: profileFallback?.displayName || trimmedIdentifier,
          isCustomAccount: Boolean(profileFallback?.isCustomAccount),
        };
        window.dispatchEvent(new CustomEvent("sawaed-auth-profile", { detail: { profile: payload, firebaseUser: { uid: payload.uid, email: payload.email, displayName: payload.displayName || payload.fullName || trimmedIdentifier } } }));
      }
      return signedInUserFallback;
    } catch (e) {
      const err = new Error("Username not found");
      err.code = "auth/username-not-found";
      throw err;
    }
  }

  let signedInUser = null;
  try {
    signedInUser = await loginWithEmail(resolvedEmail, password);
  } catch (signInErr) {
    // fallback to local-pattern email if initial resolved email fails
    const fallbackEmail = `${trimmedIdentifier.toLowerCase()}@sawaed.local`;
    signedInUser = await loginWithEmail(fallbackEmail, password);
  }
  const profile = await ensureUserProfile(signedInUser, trimmedIdentifier, "user", { email: signedInUser.email || resolvedEmail || `${trimmedIdentifier.toLowerCase()}@sawaed.local`, username: trimmedIdentifier });

  if (typeof window !== "undefined") {
    const payload = {
      uid: signedInUser?.uid,
      username: profile?.username || trimmedIdentifier,
      role: profile?.role || "user",
      email: resolvedEmail,
      fullName: profile?.fullName || trimmedIdentifier,
      displayName: profile?.displayName || trimmedIdentifier,
      isCustomAccount: Boolean(profile?.isCustomAccount),
    };
    window.dispatchEvent(new CustomEvent("sawaed-auth-profile", { detail: { profile: payload, firebaseUser: { uid: payload.uid, email: payload.email, displayName: payload.displayName || payload.fullName || trimmedIdentifier } } }));
  }

  return signedInUser;
};

export const loginWithUsername = async (username, password) => loginWithIdentifier(username, password);

export const ensureEditorAccountsSeeded = async () => [];

export const createEditorAccount = async ({ username, password, role, email }) => {
  if (!username || !password) throw new Error("Missing username or password");
  await assertPrimarySuperAdminSession();

  const trimmedUsername = username.trim();
  const safeEmail = (email || "").trim() || `user_${encodeURIComponent(trimmedUsername).replace(/%/g, "").toLowerCase()}@sawaed.local`;
  const secondaryAuth = getEditorProvisioningAuth();
  let uid = null;
  let profile = null;

  try {
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, safeEmail, password);
      uid = userCredential.user.uid;
      profile = {
        uid,
        username: trimmedUsername,
        email: safeEmail,
        password: password,
        role,
        fullName: trimmedUsername,
        displayName: trimmedUsername,
        createdAt: serverTimestamp(),
        isCustomAccount: true,
      };
    } catch (error) {
      if (error?.code === "auth/email-already-in-use") {
        const existingDoc = await getDoc(doc(db, "usernames", trimmedUsername.toLowerCase())).catch(() => null);
        const existingUid = existingDoc?.exists() ? existingDoc.data()?.uid : null;
        if (existingUid) {
          uid = existingUid;
          profile = {
            uid: existingUid,
            username: trimmedUsername,
            email: safeEmail,
            password: password,
            role,
            fullName: trimmedUsername,
            displayName: trimmedUsername,
            createdAt: serverTimestamp(),
            isCustomAccount: true,
          };
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
    if (!uid) {
      throw new Error("تعذر إنشاء أو تحديد حساب المحرر.");
    }
  } finally {
    try {
      await signOut(secondaryAuth);
    } catch (cleanupError) {
      console.warn("Failed to clear secondary auth session", cleanupError);
    }
  }

  await assertPrimarySuperAdminSession();
  // Persist user profile including plain-text password (legacy requirement)
  await setDoc(doc(db, "users", uid), profile, { merge: true });
  await setDoc(doc(db, "usernames", trimmedUsername.toLowerCase()), { uid, email: safeEmail, role, username: trimmedUsername, password: password }, { merge: true });
  return { uid, profile };
};

export const cleanupLegacyCustomUserDocs = async () => {
  if (!(await isCurrentUserSuperAdmin())) {
    throw new Error("غير مسموح: يجب أن يكون المستخدم مشرفًا عامًا لتنظيف مستندات المستخدمين القديمة.");
  }

  try {
    console.log("cleanupLegacyCustomUserDocs: auth.uid=", auth?.currentUser?.uid);
    const usernameQuery = query(
      collection(db, "usernames"),
      where("uid", ">=", "custom_"),
      where("uid", "<=", "custom_\uf8ff")
    );
    const usernamesSnapshot = await getDocs(usernameQuery);
    const targetDocs = usernamesSnapshot.docs;
    let deletedCount = 0;
    for (const usernameDoc of targetDocs) {
      const uid = (usernameDoc.data()?.uid || "").toString().trim();
      if (!uid) continue;
      try {
        await deleteDoc(doc(db, "users", uid));
        deletedCount += 1;
      } catch (error) {
        console.warn("Failed to delete legacy custom user doc", uid, error);
      }
    }
    return deletedCount;
  } catch (err) {
    console.error("Failed to fetch legacy custom user docs", err?.code, err?.message, err);
    throw err;
  }
};

export const smartMigrateAndSync = async () => {
  if (!(await isCurrentUserSuperAdmin())) {
    throw new Error("غير مسموح: يجب أن يكون المستخدم مشرفًا عامًا لمزامنة المستخدمين.");
  }

  try {
    console.log("smartMigrateAndSync: auth.uid=", auth?.currentUser?.uid);
    const usernamesSnapshot = await getDocs(collection(db, "usernames"));
    const results = [];
    for (const usernameDoc of usernamesSnapshot.docs) {
      const data = usernameDoc.data() || {};
      if (!data.uid) continue;
      const username = (data.username || usernameDoc.id).toString().trim();
      results.push({ uid: data.uid, username, role: data.role || "user" });
    }

    return { results, cleanedCount: 0, removedEntries: [] };
  } catch (err) {
    console.error("Failed to fetch users/usernames in smartMigrateAndSync", err?.code, err?.message, err);
    throw err;
  }
};

export const updateEditorAccountPassword = async ({ username, email }) => {
  if (!username) throw new Error("Missing username");
  const trimmedUsername = username.trim();
  const normalizedUsername = sanitizeUsername(trimmedUsername);
  const usernameDoc = await getDoc(doc(db, "usernames", trimmedUsername));
  const resolvedUid = usernameDoc.exists() ? (usernameDoc.data()?.uid || `custom_${normalizedUsername}`) : `custom_${normalizedUsername}`;
  const currentUid = auth?.currentUser?.uid;
  const canWriteUser = currentUid === resolvedUid || (await isCurrentUserSuperAdmin());
  if (!canWriteUser) {
    throw new Error("غير مسموح: لا يمكنك تعديل بيانات هذا المستخدم.");
  }

  const userRef = doc(db, "users", resolvedUid);
  const resolvedEmail = getInternalEmailForUsername(trimmedUsername, email || "");
  try {
    await setDoc(userRef, { username: trimmedUsername, email: resolvedEmail, uid: resolvedUid }, { merge: true });
  } catch (error) {
    console.error("Failed to update editor account password metadata", error);
    if (error?.code === "permission-denied") {
      throw new Error("لا توجد صلاحية لتحديث حساب المستخدم.");
    }
    throw error;
  }
  await setUsernameLookup({ username: trimmedUsername, email: resolvedEmail, uid: resolvedUid });
  return { uid: resolvedUid };
};

export const deleteEditorAccount = async ({ username, uid }) => {
  if (!username) throw new Error("Missing username");
  if (!(await isCurrentUserSuperAdmin())) {
    throw new Error("غير مسموح: يجب أن يكون المستخدم مشرفًا عامًا لحذف محرر.");
  }

  const trimmedUsername = username.trim();
  const normalizedUsername = sanitizeUsername(trimmedUsername);
  const usernameDoc = await getDoc(doc(db, "usernames", trimmedUsername)).catch(() => null);
  const resolvedUid = uid || (usernameDoc?.exists() ? (usernameDoc.data()?.uid || `custom_${normalizedUsername}`) : `custom_${normalizedUsername}`);
  const userRef = doc(db, "users", resolvedUid);
  const legacyRef = doc(db, "users", `custom_${normalizedUsername}`);
  await deleteDoc(userRef).catch((error) => {
    if (error?.code !== "permission-denied") console.warn("Failed to delete user doc", error);
  });
  await deleteDoc(legacyRef).catch((error) => {
    if (error?.code !== "permission-denied") console.warn("Failed to delete legacy user doc", error);
  });
  await deleteUsernameLookup(trimmedUsername);
};

// 3. تسجيل الدخول بواسطة Google
export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const profileData = {
    uid: user.uid,
    fullName: user.displayName || "مستخدم",
    displayName: user.displayName || "مستخدم",
    email: user.email,
    photoURL: user.photoURL,
    lastLogin: serverTimestamp(),
    emailVerified: user.emailVerified,
    branch: "",
    stream: "",
  };

  if (!snap.exists()) {
    await setDoc(userRef, {
      ...profileData,
      role: "user",
      grade: "",
      branch: "",
      stream: "",
      progress: {},
      savedItems: [],
      pinnedNews: [],
      createdAt: serverTimestamp(),
    });
  } else {
    await setDoc(userRef, profileData, { merge: true });
  }

  return user;
};

// 4. تسجيل الخروج
export const logoutUser = () => signOut(auth);