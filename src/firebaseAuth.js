import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendEmailVerification
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// 1. تسجيل حساب جديد بالإيميل وباسورد
export const signUpWithEmail = async (email, password, fullName) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const safeFullName = (fullName || "مستخدم").trim() || "مستخدم";

  auth.languageCode = "ar";
  await updateProfile(user, { displayName: safeFullName });
  await sendEmailVerification(user);

  // حفظ بيانات المستخدم في Firestore
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    fullName: safeFullName,
    displayName: safeFullName,
    email: email,
    role: "user",
    createdAt: serverTimestamp(),
    emailVerified: false,
  }, { merge: true });

  return user;
};

// 2. تسجيل الدخول بإيميل وباسورد
export const loginWithEmail = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  if (!user.emailVerified) {
    await sendEmailVerification(user);
    const err = new Error("Email not verified");
    err.code = "auth/email-not-verified";
    throw err;
  }

  return user;
};

// 3. تسجيل الدخول بواسطة Google
export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // حفظ/تحديث بيانات المستخدم في Firestore
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    fullName: user.displayName || "مستخدم",
    displayName: user.displayName || "مستخدم",
    email: user.email,
    photoURL: user.photoURL,
    lastLogin: serverTimestamp(),
    emailVerified: user.emailVerified,
  }, { merge: true });

  return user;
};

// 4. تسجيل الخروج
export const logoutUser = () => signOut(auth);