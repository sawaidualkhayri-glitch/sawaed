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
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

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

  const pseudoEmail = getInternalEmailForUsername(trimmedIdentifier, "");
  const usernameDocRef = doc(db, "usernames", trimmedIdentifier.toLowerCase());
  try {
    const usernameDoc = await getDoc(usernameDocRef);
    if (!usernameDoc.exists()) {
      return null;
    }
    const resolvedEmail = (usernameDoc.data()?.email || "").trim();
    return resolvedEmail ? resolvedEmail.toLowerCase() : pseudoEmail;
  } catch (error) {
    if (error?.code === "permission-denied" || error?.message?.includes("permission")) {
      return pseudoEmail;
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
    const err = new Error("Username not found");
    err.code = "auth/username-not-found";
    throw err;
  }

  const signedInUser = await loginWithEmail(resolvedEmail, password);
  const profile = await ensureUserProfile(signedInUser, trimmedIdentifier, "user", { email: resolvedEmail, username: trimmedIdentifier });

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

  const trimmedUsername = username.trim();
  const safeEmail = (email || "").trim() || `user_${encodeURIComponent(trimmedUsername).replace(/%/g, "").toLowerCase()}@sawaed.local`;
  const secondaryAuth = getEditorProvisioningAuth();

  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, safeEmail, password);
    const uid = userCredential.user.uid;
    const profile = {
      uid,
      username: trimmedUsername,
      email: safeEmail,
      role,
      fullName: trimmedUsername,
      displayName: trimmedUsername,
      createdAt: serverTimestamp(),
      isCustomAccount: true,
    };
    await setDoc(doc(db, "users", uid), profile, { merge: true });
    await setDoc(doc(db, "usernames", trimmedUsername.toLowerCase()), { uid, email: safeEmail, role, username: trimmedUsername }, { merge: true });
    return { uid, profile };
  } catch (error) {
    if (error?.code === "auth/email-already-in-use") {
      const existingDoc = await getDoc(doc(db, "usernames", trimmedUsername.toLowerCase())).catch(() => null);
      const existingUid = existingDoc?.exists() ? existingDoc.data()?.uid : null;
      if (existingUid) {
        await setDoc(doc(db, "users", existingUid), {
          uid: existingUid,
          username: trimmedUsername,
          email: safeEmail,
          role,
          fullName: trimmedUsername,
          displayName: trimmedUsername,
          createdAt: serverTimestamp(),
          isCustomAccount: true,
        }, { merge: true });
        await setDoc(doc(db, "usernames", trimmedUsername.toLowerCase()), { uid: existingUid, email: safeEmail, role, username: trimmedUsername }, { merge: true });
        return { uid: existingUid };
      }
      throw error;
    }
    throw error;
  } finally {
    try {
      await signOut(secondaryAuth);
    } catch (cleanupError) {
      console.warn("Failed to clear secondary auth session", cleanupError);
    }
  }
};

export const cleanupLegacyCustomUserDocs = async () => {
  const usersSnapshot = await getDocs(collection(db, "users"));
  const targetDocs = usersSnapshot.docs.filter((docRef) => /^custom_/i.test(docRef.id));
  for (const docRef of targetDocs) {
    try {
      await deleteDoc(docRef.ref);
    } catch (error) {
      console.warn("Failed to delete legacy custom user doc", docRef.id, error);
    }
  }
  return targetDocs.length;
};

export const smartMigrateAndSync = async () => {
  const [usersSnapshot, usernamesSnapshot] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "usernames")),
  ]);

  const results = [];
  for (const userDoc of usersSnapshot.docs) {
    const data = userDoc.data() || {};
    const username = (data.username || "").trim();
    if (username) {
      await setDoc(doc(db, "usernames", username.toLowerCase()), {
        uid: userDoc.id,
        email: data.email || "",
        role: data.role || "user",
        username,
      }, { merge: true });
    }
    results.push({ uid: userDoc.id, username: username || userDoc.id, role: data.role || "user" });
  }

  for (const usernameDoc of usernamesSnapshot.docs) {
    const data = usernameDoc.data() || {};
    if (!data.uid) continue;
    results.push({ uid: data.uid, username: data.username || usernameDoc.id, role: data.role || "user" });
  }

  return { results, cleanedCount: 0, removedEntries: [] };
};

export const updateEditorAccountPassword = async ({ username, email }) => {
  if (!username) throw new Error("Missing username");
  const trimmedUsername = username.trim();
  const normalizedUsername = sanitizeUsername(trimmedUsername);
  const usernameDoc = await getDoc(doc(db, "usernames", trimmedUsername));
  const resolvedUid = usernameDoc.exists() ? (usernameDoc.data()?.uid || `custom_${normalizedUsername}`) : `custom_${normalizedUsername}`;
  const userRef = doc(db, "users", resolvedUid);
  const resolvedEmail = getInternalEmailForUsername(trimmedUsername, email || "");
  await setDoc(userRef, { username: trimmedUsername, email: resolvedEmail, uid: resolvedUid }, { merge: true });
  await setUsernameLookup({ username: trimmedUsername, email: resolvedEmail, uid: resolvedUid });
  return { uid: resolvedUid };
};

export const deleteEditorAccount = async ({ username, uid }) => {
  if (!username) throw new Error("Missing username");
  const trimmedUsername = username.trim();
  const normalizedUsername = sanitizeUsername(trimmedUsername);
  const usernameDoc = await getDoc(doc(db, "usernames", trimmedUsername)).catch(() => null);
  const resolvedUid = uid || (usernameDoc?.exists() ? (usernameDoc.data()?.uid || `custom_${normalizedUsername}`) : `custom_${normalizedUsername}`);
  const userRef = doc(db, "users", resolvedUid);
  const legacyRef = doc(db, "users", `custom_${normalizedUsername}`);
  await deleteDoc(userRef).catch(() => {});
  await deleteDoc(legacyRef).catch(() => {});
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