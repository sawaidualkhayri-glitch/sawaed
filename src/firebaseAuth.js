import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendEmailVerification,
  updatePassword
} from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { auth, db, getEditorProvisioningAuth } from "./firebase";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};


const BUILTIN_EDITOR_ACCOUNTS = [
  { username: "Nadosh.27", password: "hello its me", role: "super_admin", email: "nadahindi301@gmail.com" },
  { username: "محرر سواعد الخير 1", password: "347780", role: "editor_full", email: "" },
  { username: "محرر عام", password: "123780", role: "editor_full", email: "" },
  { username: "محرر سواعد الخير ملازم 2", password: "732663", role: "editor_malazem", email: "" },
  { username: "محرر سواعد الخير تأسيس 3", password: "844730", role: "editor_taasees", email: "" },
  { username: "محرر سواعد الخير تنسيق 4", password: "368784", role: "editor_news", email: "" },
  { username: "محمد", password: "MSG@MSG", role: "editor_malazem", email: "" },
];

export const ACTIVE_LEGACY_USERS = [
  { username: "محرر سواعد الخير 1", password: "347780", role: "editor_full", displayName: "محرر سواعد الخير 1" },
  { username: "Nadosh.27", email: "nadahindi301@gmail.com", password: "hello its me", role: "super_admin", displayName: "Nadosh.27" },
  { username: "محرر سواعد الخير ملازم 2", password: "732663", role: "editor_malazem", displayName: "محرر سواعد الخير ملازم 2" },
  { username: "محرر سواعد الخير تأسيس 3", password: "844730", role: "editor_taasees", displayName: "محرر سواعد الخير تأسيس 3" },
  { username: "محرر سواعد الخير تنسيق 4", password: "368784", role: "editor_news", displayName: "محرر سواعد الخير تنسيق 4" },
  { username: "محمد", password: "MSG@MSG", role: "editor_malazem", displayName: "محمد" },
  { username: "محرر عام", password: "123780", role: "editor_full", displayName: "محرر عام" },
];

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

async function hashPassword(password) {
  const data = new TextEncoder().encode(password || "");
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureFirebaseAuthAccount({ username, password, email, useSecondaryAuth = false, currentPassword = null }) {
  const resolvedEmail = getInternalEmailForUsername(username, email);
  const passwordValue = password || "";
  if (!resolvedEmail || !passwordValue) return null;

  const authInstance = useSecondaryAuth ? getEditorProvisioningAuth() : auth;

  try {
    const credential = await signInWithEmailAndPassword(authInstance, resolvedEmail, passwordValue);
    return credential.user;
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      try {
        const created = await createUserWithEmailAndPassword(authInstance, resolvedEmail, passwordValue);
        return created.user;
      } catch (createError) {
        if (createError.code === "auth/email-already-in-use") {
          try {
            const existing = await signInWithEmailAndPassword(authInstance, resolvedEmail, passwordValue);
            return existing.user;
          } catch (signInError) {
            if (currentPassword && currentPassword !== passwordValue) {
              try {
                const credential = await signInWithEmailAndPassword(authInstance, resolvedEmail, currentPassword);
                if (credential.user) {
                  await updatePassword(credential.user, passwordValue);
                  return credential.user;
                }
              } catch (passwordUpdateError) {
                if (passwordUpdateError?.code === "auth/wrong-password") {
                  console.error("Seeded account password sync failed", { resolvedEmail, code: passwordUpdateError.code, message: passwordUpdateError.message });
                  return null;
                }
                throw passwordUpdateError;
              }
            }
            console.error("Seeded account already exists but password sync failed", { resolvedEmail, code: signInError.code, message: signInError.message });
            return null;
          }
        }
        throw createError;
      }
    }
    if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      if (currentPassword && currentPassword !== passwordValue) {
        try {
          const credential = await signInWithEmailAndPassword(authInstance, resolvedEmail, currentPassword);
          if (credential.user) {
            await updatePassword(credential.user, passwordValue);
            return credential.user;
          }
        } catch (passwordUpdateError) {
          if (passwordUpdateError?.code === "auth/wrong-password") return null;
          throw passwordUpdateError;
        }
      }
      return null;
    }
    throw error;
  } finally {
    if (useSecondaryAuth) {
      try {
        await signOut(authInstance);
      } catch (signOutError) {
        console.warn("Failed to clear editor provisioning auth session", signOutError);
      }
    }
  }
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

async function ensureCustomProfileRecord({ username, password, role, profileData = {}, email, uid }) {
  const trimmedUsername = (username || "").trim();
  const normalizedUsername = sanitizeUsername(trimmedUsername);
  const resolvedEmail = getInternalEmailForUsername(trimmedUsername, email || profileData.email || "");
  let resolvedUid = uid || `custom_${normalizedUsername}`;

  if (password) {
    const authUser = await ensureFirebaseAuthAccount({ username: trimmedUsername, password, email: resolvedEmail, useSecondaryAuth: true });
    if (authUser?.uid) {
      resolvedUid = authUser.uid;
    }
  }

  const userRef = doc(db, "users", resolvedUid);
  const passwordHash = await hashPassword(password || "");
  const profile = {
    uid: resolvedUid,
    fullName: profileData.fullName || trimmedUsername || "مستخدم",
    displayName: profileData.displayName || trimmedUsername || "مستخدم",
    username: trimmedUsername || normalizedUsername,
    email: resolvedEmail,
    role,
    passwordHash,
    isCustomAccount: true,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    ...profileData,
  };
  await setDoc(userRef, profile, { merge: true });
  await setUsernameLookup({ username: trimmedUsername, email: resolvedEmail, uid: resolvedUid });
  return { uid: resolvedUid, profile };
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

  // حفظ بيانات المستخدم في Firestore
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    fullName: safeFullName,
    displayName: safeFullName,
    username: safeFullName,
    email: email,
    role: "user",
    createdAt: serverTimestamp(),
    emailVerified: false,
    ...normalizedProfile,
  }, { merge: true });

  const usernameValue = (extraProfile.username || safeFullName || "").trim();
  if (usernameValue) {
    await setUsernameLookup({ username: usernameValue, email, uid: user.uid });
  }

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
    return loginWithEmail(trimmedIdentifier.toLowerCase(), password);
  }

  const normalizedUsername = sanitizeUsername(trimmedIdentifier);
  const builtInAccount = BUILTIN_EDITOR_ACCOUNTS.find((account) => sanitizeUsername(account.username) === normalizedUsername);
  const resolvedEmail = await resolveUsernameToEmail(trimmedIdentifier);
  if (!resolvedEmail) {
    const err = new Error("Username not found");
    err.code = "auth/username-not-found";
    throw err;
  }

  console.error("[loginWithIdentifier] attempting auth", { identifier: trimmedIdentifier, resolvedEmail, code: null, message: "starting sign-in" });

  try {
    const signedInUser = await loginWithEmail(resolvedEmail, password);
    if (builtInAccount) {
      await ensureCustomProfileRecord({
        username: trimmedIdentifier,
        password,
        role: builtInAccount.role,
        email: resolvedEmail,
        profileData: { fullName: trimmedIdentifier, displayName: trimmedIdentifier, email: resolvedEmail },
      });
    }

    if (typeof window !== "undefined") {
      const payload = {
        uid: signedInUser?.uid || `custom_${normalizedUsername}`,
        username: trimmedIdentifier,
        role: builtInAccount?.role || "user",
        email: resolvedEmail,
        isCustomAccount: true,
        fullName: trimmedIdentifier,
        displayName: trimmedIdentifier,
      };
      window.dispatchEvent(new CustomEvent("sawaed-auth-profile", { detail: { profile: payload, firebaseUser: { uid: payload.uid, email: payload.email, displayName: payload.displayName || payload.fullName || trimmedIdentifier } } }));
    }

    return signedInUser;
  } catch (error) {
    console.error("[loginWithIdentifier] auth failure", { identifier: trimmedIdentifier, resolvedEmail, code: error?.code, message: error?.message });
    if (error?.code === "auth/user-not-found") {
      try {
        const createdUser = await ensureFirebaseAuthAccount({ username: trimmedIdentifier, password, email: resolvedEmail });
        if (builtInAccount) {
          await ensureCustomProfileRecord({
            username: trimmedIdentifier,
            password,
            role: builtInAccount.role,
            email: resolvedEmail,
            profileData: { fullName: trimmedIdentifier, displayName: trimmedIdentifier, email: resolvedEmail },
          });
        }
        if (typeof window !== "undefined") {
          const payload = {
            uid: createdUser?.uid || `custom_${normalizedUsername}`,
            username: trimmedIdentifier,
            role: builtInAccount?.role || "user",
            email: resolvedEmail,
            isCustomAccount: true,
            fullName: trimmedIdentifier,
            displayName: trimmedIdentifier,
          };
          window.dispatchEvent(new CustomEvent("sawaed-auth-profile", { detail: { profile: payload, firebaseUser: { uid: payload.uid, email: payload.email, displayName: payload.displayName || payload.fullName || trimmedIdentifier } } }));
        }
        return createdUser;
      } catch (createError) {
        throw createError;
      }
    }
    throw error;
  }
};

export const loginWithUsername = async (username, password) => loginWithIdentifier(username, password);

export const ensureEditorAccountsSeeded = async (editors = BUILTIN_EDITOR_ACCOUNTS) => {
  const editorsToSeed = Array.isArray(editors) && editors.length > 0 ? editors : BUILTIN_EDITOR_ACCOUNTS;
  for (const account of editorsToSeed) {
    const username = (account.username || "").trim();
    if (!username) continue;
    await ensureCustomProfileRecord({
      username,
      password: account.password,
      role: account.role,
      email: account.email,
      profileData: { fullName: account.fullName || account.username, displayName: account.displayName || account.username, email: getInternalEmailForUsername(username, account.email) },
    });
  }
};

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

function normalizePassword(password) {
  const value = (password || "").toString();
  return value.length >= 6 ? value : `${value}0`.slice(0, 6);
}

function getActiveUsernameSet() {
  return new Set(ACTIVE_LEGACY_USERS.map((entry) => (entry.username || "").trim().toLowerCase()));
}

export const smartMigrateAndSync = async () => {
  const results = [];
  const errors = [];
  const secondaryAuth = getEditorProvisioningAuth();
  const activeUsernameSet = getActiveUsernameSet();

  for (const candidate of ACTIVE_LEGACY_USERS) {
    const trimmedUsername = (candidate.username || "").trim();
    const resolvedEmail = (candidate.email || "").trim() || toSafeEmail(trimmedUsername);
    const password = normalizePassword(candidate.password);

    if (!trimmedUsername || !password) continue;

    try {
      const credential = await createUserWithEmailAndPassword(secondaryAuth, resolvedEmail, password);
      const uid = credential.user?.uid;
      if (uid) {
        await setDoc(doc(db, "users", uid), {
          uid,
          username: trimmedUsername,
          email: resolvedEmail,
          role: candidate.role,
          displayName: candidate.displayName || trimmedUsername,
          fullName: candidate.displayName || trimmedUsername,
          createdAt: new Date(),
          isCustomAccount: true,
        }, { merge: true });
        await setDoc(doc(db, "usernames", trimmedUsername.toLowerCase()), { uid, email: resolvedEmail, role: candidate.role, username: trimmedUsername }, { merge: true });
        results.push({ username: trimmedUsername, email: resolvedEmail, role: candidate.role, uid });
      }
    } catch (error) {
      if (error?.code === "auth/email-already-in-use") {
        try {
          const signIn = await signInWithEmailAndPassword(secondaryAuth, resolvedEmail, password);
          const uid = signIn.user?.uid;
          if (uid) {
            await setDoc(doc(db, "users", uid), {
              uid,
              username: trimmedUsername,
              email: resolvedEmail,
              role: candidate.role,
              displayName: candidate.displayName || trimmedUsername,
              fullName: candidate.displayName || trimmedUsername,
              createdAt: new Date(),
              isCustomAccount: true,
            }, { merge: true });
            await setDoc(doc(db, "usernames", trimmedUsername.toLowerCase()), { uid, email: resolvedEmail, role: candidate.role, username: trimmedUsername }, { merge: true });
            results.push({ username: trimmedUsername, email: resolvedEmail, role: candidate.role, uid, existed: true });
          }
        } catch (signInError) {
          errors.push({ username: trimmedUsername, message: signInError?.message || signInError?.code || String(signInError) });
        }
      } else {
        errors.push({ username: trimmedUsername, message: error?.message || error?.code || String(error) });
      }
    }
  }

  const [usersSnapshot, usernamesSnapshot] = await Promise.all([getDocs(collection(db, "users")), getDocs(collection(db, "usernames"))]);
  const removedEntries = [];

  for (const userDoc of usersSnapshot.docs) {
    const id = userDoc.id;
    const data = userDoc.data() || {};
    const username = (data.username || "").trim().toLowerCase();
    const isObsolete = /^custom_/i.test(id) || (!username && !activeUsernameSet.has(id.toLowerCase())) || (!activeUsernameSet.has(username) && !activeUsernameSet.has(id.toLowerCase()));
    if (!isObsolete) continue;

    removedEntries.push({ type: "users", id, username });
    try {
      await deleteDoc(userDoc.ref);
    } catch (error) {
      console.warn("Failed deleting obsolete user record", id, error);
    }
  }

  for (const usernameDoc of usernamesSnapshot.docs) {
    const id = usernameDoc.id;
    const data = usernameDoc.data() || {};
    const username = (data.username || id || "").trim().toLowerCase();
    if (activeUsernameSet.has(username)) continue;
    removedEntries.push({ type: "usernames", id, username });
    try {
      await deleteDoc(usernameDoc.ref);
    } catch (error) {
      console.warn("Failed deleting obsolete username lookup", id, error);
    }
  }

  const cleanedCount = await cleanupLegacyCustomUserDocs();
  await signOut(secondaryAuth);

  if (errors.length > 0) {
    throw new Error(`فشل مزامنة ${errors.length} حساب${errors.length > 1 ? "ات" : ""}: ${errors.map((item) => `${item.username}: ${item.message}`).join(" | ")}`);
  }

  return { results, cleanedCount, removedEntries };
};

export const updateEditorAccountPassword = async ({ username, newPassword, email, currentPassword }) => {
  if (!username || !newPassword) throw new Error("Missing username or password");
  const trimmedUsername = username.trim();
  const normalizedUsername = sanitizeUsername(trimmedUsername);
  const usernameDoc = await getDoc(doc(db, "usernames", trimmedUsername));
  const resolvedUid = usernameDoc.exists() ? (usernameDoc.data()?.uid || `custom_${normalizedUsername}`) : `custom_${normalizedUsername}`;
  const userRef = doc(db, "users", resolvedUid);
  const passwordHash = await hashPassword(newPassword);
  const resolvedEmail = getInternalEmailForUsername(trimmedUsername, email || "");
  await setDoc(userRef, { passwordHash, username: trimmedUsername, email: resolvedEmail, uid: resolvedUid }, { merge: true });
  await setUsernameLookup({ username: trimmedUsername, email: resolvedEmail, uid: resolvedUid });
  if (passwordHash) {
    await ensureFirebaseAuthAccount({ username: trimmedUsername, password: newPassword, email: resolvedEmail, useSecondaryAuth: true, currentPassword });
  }
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