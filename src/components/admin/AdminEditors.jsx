import { useState, useEffect } from "react";
import { doc, setDoc, deleteDoc, onSnapshot, collection, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, signOut } from "firebase/auth";
import { db, auth } from "../../firebase";
import { useAuth } from "../../AuthContext";
import AdminSection from "./AdminSection.jsx";
import { normalizeUserRole, normalizeUsername, getEditorProvisioningAuth } from "../../constants";

export default function AdminEditors({ config, saveConfig, T, onBack, role }) {
  const [editors, setEditors] = useState([]);
  const [loadingEditors, setLoadingEditors] = useState(true);
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "editor_malazem", permissions: [] });
  const [err, setErr] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [flashSaved, setFlashSaved] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernamesLoaded, setUsernamesLoaded] = useState(false);
  const { currentUser: localCurrentUser, authLoading: localAuthLoading } = useAuth();
  const isAdminSession = ["super_admin", "admin"].includes(role);

  useEffect(() => {
    if (typeof localAuthLoading !== "undefined" && localAuthLoading) return;
    if (!localCurrentUser?.uid) {
      if (!localAuthLoading) {
        console.warn("Auth resolved but no currentUser.uid — editors fetch skipped");
      }
      return;
    }
    if (!["super_admin","admin"].includes(role)) return;

    const editorRoles = ["super_admin", "admin", "editor_full", "editor_malazem", "editor_taasees", "editor_news"];
    let usernamesData = [];
    let usernamesUnsubscribe = null;
    let hasUpdatedEditors = false;

    const mergeEditorResults = () => {
      const map = new Map();

      usernamesData.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const roleValue = (data.role || "user").toString().trim().toLowerCase();
        if (!editorRoles.includes(normalizeUserRole(roleValue)) && !editorRoles.includes(roleValue)) return;

        const key = data.uid || docSnap.id;
        const entry = {
          id: docSnap.id,
          uid: data.uid || key,
          username: data.username || docSnap.id,
          email: data.email || "",
          password: data.password || "",
          role: data.role || "user",
          permissions: Array.isArray(data.permissions) ? data.permissions : [],
          fullName: data.fullName || data.displayName || data.username || docSnap.id,
          displayName: data.displayName || data.fullName || data.username || docSnap.id,
        };
        map.set(key, entry);
      });

      const merged = Array.from(map.values());
      setEditors(merged);
      setFetchError("");
      if (usernamesLoaded) {
        setLoadingEditors(false);
      }
      hasUpdatedEditors = true;
    };

    const trySyncUserDoc = () => {
      void (async () => {
        try {
          await setDoc(doc(db, "users", localCurrentUser.uid), {
            uid: localCurrentUser.uid,
            email: localCurrentUser.email || "",
            displayName: localCurrentUser.displayName || localCurrentUser.username || "",
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (syncErr) {
          console.warn("Non-blocking super_admin user sync failed", syncErr?.code, syncErr?.message, syncErr);
        }
      })();
    };

    console.log("Fetching editors — auth.uid:", auth?.currentUser?.uid, "activeRole:", role, "currentUser.uid:", localCurrentUser?.uid);
    trySyncUserDoc();

    usernamesUnsubscribe = onSnapshot(collection(db, "usernames"), (snapshot) => {
      usernamesData = snapshot.docs;
      setUsernamesLoaded(true);
      setFetchError("");
      mergeEditorResults();
      setLoadingEditors(false);
    }, (snapshotError) => {
      console.error("Failed to load usernames from Firestore", snapshotError?.code, snapshotError?.message, snapshotError);
      setFetchError("تعذر تحميل قائمة المحررين من Firestore.");
      setLoadingEditors(false);
    });

    return () => {
      if (usernamesUnsubscribe) usernamesUnsubscribe();
    };
  }, [role, localAuthLoading, localCurrentUser]);

  if (role !== "super_admin") {
    return (
      <div className="app-shell" style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
        <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={onBack} style={{ background: "transparent", border: "none", color: T.accent, fontSize: "15px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع</button>
          <h2 style={{ margin: 0, color: T.accent, fontSize: "18px", fontWeight: "800" }}>🛡️ إدارة المحررين</h2>
        </div>
        <div style={{ padding: "20px", color: T.text }}>لا توجد صلاحية لإدارة المحررين لهذا الحساب.</div>
      </div>
    );
  }

  const ROLES = [
    { value: "super_admin", label: "مدير عام (كل الصلاحيات + إدارة المحررين)" },
    { value: "editor_full", label: "محرر عام (كل أقسام المحتوى)" },
    { value: "editor_malazem", label: "محرر سواعد الخير ملازم" },
    { value: "editor_news", label: "محرر سواعد الخير تنسيق" },
    { value: "editor_tasiss", label: "محرر سواعد الخير تأسيس" },
  ];

  const normalizeEditorRoleValue = (roleValue) => {
    const normalized = (roleValue || "").toString().trim().toLowerCase();
    if (!normalized) return "editor_malazem";
    if (normalized === "super_admin" || normalized === "admin") return "super_admin";
    if (normalized === "editor_full" || normalized === "all") return "editor_full";
    if (normalized === "editor_malazem" || normalized === "editor_materials" || normalized === "editor_study" || normalized === "notes") return "editor_malazem";
    if (normalized === "editor_news" || normalized === "content") return "editor_news";
    if (normalized === "editor_taasees" || normalized === "editor_tasiss" || normalized === "foundation") return "editor_taasees";
    return normalized;
  };

  const getRoleDescription = (role) => {
    const normalized = (role || "").toString().trim().toLowerCase();
    switch (normalized) {
      case "super_admin":
        return "مدير عام (إدارة المحررين + التحكم الكامل بالمنصة)";
      case "editor_full":
        return "محرر عام (إضافة وتعديل لكافة الأقسام بدون إدارة المحررين)";
      case "editor_taasees":
      case "editor_tasiss":
        return "محرر قسم التأسيس فقط";
      case "editor_malazem":
        return "محرر قسم الملازم فقط";
      case "editor_news":
        return "محرر سواعد الخير تنسيق";
      default:
        return "مستخدم / لا توجد صلاحيات تحرير";
    }
  };

  const PERMISSION_OPTIONS = [
    { id: "splash", label: "شاشة البداية" },
    { id: "grades", label: "الصفوف والفروع" },
    { id: "subjects", label: "المواد الدراسية" },
    { id: "sections", label: "أقسام المادة" },
    { id: "folders", label: "إدارة المجلدات (الملازم والملفات)" },
    { id: "lessons", label: "الدروس والإنجاز" },
    { id: "quotes", label: "العبارات التحفيزية" },
    { id: "foundation", label: "محتوى التأسيس" },
    { id: "news", label: "الأخبار" },
    { id: "announcements", label: "إشعارات وإعلانات فورية" },
    { id: "nav", label: "الصفحات والتنقل" },
    { id: "contact", label: "روابط التواصل" },
    { id: "password", label: "تغيير كلمة السر" },
  ];

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "12px 14px", fontSize: "14px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box" };

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const isValidEmail = (email) => EMAIL_REGEX.test((email || "").trim().toLowerCase());
  const getSafeEmail = (username, email = "") => {
    const trimmedEmail = (email || "").trim().toLowerCase();
    if (trimmedEmail && isValidEmail(trimmedEmail)) return trimmedEmail;
    const safeUsername = (username || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "_").toLowerCase().slice(0, 40) || "user";
    return `${safeUsername}@sawaed.local`;
  };

  const togglePermission = (list, id) => list.includes(id) ? list.filter(p => p !== id) : [...list, id];

  const roleLabel = (e) => {
    const normalizedRole = normalizeUserRole(e.role);
    if (normalizedRole === "custom") {
      const names = (e.permissions || []).map(p => PERMISSION_OPTIONS.find(o => o.id === p)?.label || p);
      return names.length ? `مخصّصة: ${names.join("، ")}` : "مخصّصة (بدون صلاحيات محددة)";
    }
    return ROLES.find(r => r.value === normalizedRole || (r.value === "editor_tasiss" && normalizedRole === "editor_taasees"))?.label || e.role;
  };

  const persistEditorToFirebase = async ({ username, email, role, uid, permissions = [], password = "" }) => {
    if (!isAdminSession) {
      throw new Error("غير مسموح: يجب أن يكون المستخدم مشرفًا عامًا لإنشاء أو تعديل محرر.");
    }

    const trimmedUsername = (username || "").trim();
    const persistedRole = (role || "").toString().trim();
    const safeEmail = getSafeEmail(trimmedUsername, email);

    try {
      await setDoc(doc(db, "users", uid), {
        uid,
        username: trimmedUsername,
        email: safeEmail,
        password: password,
        role: persistedRole,
        fullName: trimmedUsername,
        displayName: trimmedUsername,
        permissions: Array.isArray(permissions) ? permissions : [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (writeUsersError) {
      console.error("Failed to write user profile", writeUsersError);
      if (writeUsersError?.code === "permission-denied") {
        throw new Error("لا توجد صلاحية لحفظ المستخدم في مجموعة users.");
      }
      throw new Error("تعذر حفظ بيانات المستخدم في مجموعة users.");
    }

    try {
      await setDoc(doc(db, "usernames", trimmedUsername.toLowerCase()), { uid, username: trimmedUsername, email: safeEmail, role: persistedRole, password: password }, { merge: true });
    } catch (writeUsernamesError) {
      console.error("Failed to write username lookup", writeUsernamesError);
      if (writeUsernamesError?.code === "permission-denied") {
        throw new Error("لا توجد صلاحية لحفظ اسم المستخدم في مجموعة usernames.");
      }
      throw new Error("تعذر حفظ بيانات البحث عن اسم المستخدم في مجموعة usernames.");
    }

    return safeEmail;
  };

  const addEditor = async () => {
    if (!isAdminSession) {
      setErr("غير مسموح: يجب أن يكون المستخدم مشرفًا عامًا لإنشاء محرر.");
      return;
    }

    const uname = form.username.trim();
    const password = form.password.trim();
    if (!uname || !password) { setErr("أدخل الاسم وكلمة السر"); return; }
    if (password.length < 6) { setErr("كلمة السر يجب أن تكون 6 خانات على الأقل"); return; }
    const selectedRole = normalizeEditorRoleValue(form.role);
    if (!selectedRole) { setErr("اختر الدور"); return; }
    if (editors.some(e => normalizeUsername(e.username) === normalizeUsername(uname))) { setErr("الاسم موجود مسبقاً"); return; }

    setIsSubmitting(true);
    setErr("");
    const secondaryAuth = getEditorProvisioningAuth();
    const safeEmail = getSafeEmail(uname, form.email);

    try {
      let uid;
      try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, safeEmail, password);
        uid = userCredential.user?.uid;
      } catch (error) {
        if (error?.code === "auth/email-already-in-use") {
          const existingCredential = await signInWithEmailAndPassword(secondaryAuth, safeEmail, password);
          await updatePassword(existingCredential.user, password);
          uid = existingCredential.user?.uid;
        } else {
          throw error;
        }
      }

      if (!uid) throw new Error("تعذر إنشاء حساب Firebase Auth للمحرر.");
      await persistEditorToFirebase({ username: uname, email: safeEmail, role: selectedRole, uid, permissions: [], password });
      setForm({ username: "", email: "", password: "", role: "editor_malazem", permissions: [] });
      setErr("");
      setFlashSaved(true);
      window.setTimeout(() => setFlashSaved(false), 2000);
    } catch (error) {
      console.error("Failed to create editor account", error);
      setErr(error?.message || "تعذر إنشاء حساب المحرر.");
    } finally {
      setIsSubmitting(false);
      try { await signOut(secondaryAuth); } catch (cleanupError) { console.warn("Failed to clear secondary auth session", cleanupError); }
    }
  };

  const removeEditor = async (idx) => {
    if (!window.confirm("حذف هذا المحرر؟")) return;
    if (!isAdminSession) {
      setErr("غير مسموح: يجب أن يكون المستخدم مشرفًا عامًا لحذف محرر.");
      return;
    }
    const editor = editors[idx];
    if (!editor?.uid) return;

    try {
      await deleteDoc(doc(db, "users", editor.uid));
      await deleteDoc(doc(db, "usernames", normalizeUsername(editor.username).toLowerCase()));
      const updatedEditors = editors.filter((_, i) => i !== idx);
      setEditors(updatedEditors);
      if (editIdx === idx) { setEditIdx(null); setEditForm(null); }
      setErr("");
    } catch (error) {
      console.error("Failed to delete editor", error);
      if (error?.code === "permission-denied") {
        setErr("لا توجد صلاحية لحذف المحرر.");
      } else {
        setErr(error?.message || "تعذر حذف المحرر.");
      }
    }
  };

  const startEdit = (i) => {
    setEditIdx(i);
    setEditForm({ ...editors[i], permissions: editors[i].permissions || [] });
    setErr("");
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!isAdminSession) {
      setErr("غير مسموح: يجب أن يكون المستخدم مشرفًا عامًا لتعديل محرر.");
      return;
    }
    const uname = editForm.username.trim();
    const password = (editForm.password || "").trim();
    if (!uname) { setErr("أدخل اسم المستخدم"); return; }
    if (password && password.length < 6) { setErr("كلمة السر يجب أن تكون 6 خانات على الأقل"); return; }
    const selectedRole = normalizeEditorRoleValue(editForm.role);
    if (!selectedRole) { setErr("اختر الدور"); return; }
    if (editors.some((e, i) => i !== editIdx && normalizeUsername(e.username) === normalizeUsername(uname))) { setErr("الاسم موجود مسبقاً لمحرر آخر"); return; }

    setIsSubmitting(true);
    setErr("");
    const previousEditor = editors[editIdx];
    const uid = previousEditor.uid;
    const safeEmail = getSafeEmail(uname, editForm.email);
    const updatedEditor = { ...previousEditor, username: uname, email: safeEmail, role: selectedRole, permissions: [] };

    try {
      if (!uid) throw new Error("تعذر تحديد معرف المستخدم للمحرر.");
      await persistEditorToFirebase({ username: uname, email: safeEmail, role: selectedRole, uid, permissions: [], password: (editForm.password || "") });

      const previousUsernameKey = normalizeUsername(previousEditor.username).toLowerCase();
      const nextUsernameKey = normalizeUsername(uname).toLowerCase();
      if (previousUsernameKey && previousUsernameKey !== nextUsernameKey) {
        try {
          await deleteDoc(doc(db, "usernames", previousUsernameKey));
        } catch (deleteOldNameError) {
          console.warn("Failed to delete old username lookup", deleteOldNameError);
        }
      }

      const updatedEditors = [...editors];
      updatedEditors[editIdx] = updatedEditor;
      setEditors(updatedEditors);
      setEditIdx(null);
      setEditForm(null);
      setErr("");
      setFlashSaved(true);
      window.setTimeout(() => setFlashSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save editor", error);
      setErr(error?.message || "تعذر حفظ بيانات المحرر.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-shell" style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: T.accent, fontSize: "15px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع</button>
        <h2 style={{ margin: 0, color: T.accent, fontSize: "18px", fontWeight: "800" }}>🛡️ إدارة المحررين</h2>
      </div>
      <div style={{ padding: "16px" }}>
        {loadingEditors ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0", color: T.text }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: `3px solid ${T.cardBorder}`, borderTopColor: T.accent, animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : editors.length === 0 ? (
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "14px", padding: "20px", textAlign: "center", color: T.subtext }}>
            لا توجد محررين مسجلين حالياً.
          </div>
        ) : (
          <>
            {fetchError ? (
              <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "14px", padding: "16px", color: T.danger, marginBottom: "12px", wordBreak: "break-word" }}>
                {fetchError}
              </div>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {editors.map((e, i) => (
              <div key={e.id || i} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "14px", padding: "12px 14px" }}>
                {editIdx === i ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <input value={editForm.username} onChange={ev => setEditForm(f => ({ ...f, username: ev.target.value }))} placeholder="اسم المستخدم" style={inp} />
                    <input value={editForm.email || ""} onChange={ev => setEditForm(f => ({ ...f, email: ev.target.value }))} placeholder="البريد الإلكتروني (اختياري)" style={inp} />
                    <input value={editForm.password} onChange={ev => setEditForm(f => ({ ...f, password: ev.target.value }))} placeholder="كلمة السر" style={inp} />
                    <select value={editForm.role} onChange={ev => setEditForm(f => ({ ...f, role: ev.target.value }))} style={inp}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    {editForm.role === "custom" && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", background: T.sectionBg, borderRadius: "10px", padding: "10px" }}>
                        {PERMISSION_OPTIONS.map(opt => (
                          <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: T.text, background: editForm.permissions.includes(opt.id) ? `${T.accent}22` : "transparent", border: `1px solid ${editForm.permissions.includes(opt.id) ? T.accent : T.cardBorder}`, borderRadius: "8px", padding: "5px 8px", cursor: "pointer" }}>
                            <input type="checkbox" checked={editForm.permissions.includes(opt.id)} onChange={() => setEditForm(f => ({ ...f, permissions: togglePermission(f.permissions, opt.id) }))} style={{ accentColor: T.accent }} />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    )}
                    {err && <p style={{ color: T.danger, fontSize: "12px", margin: 0 }}>{err}</p>}
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={(event) => saveEdit(event)} disabled={isSubmitting} style={{ flex: 1, background: isSubmitting ? "#6b7280" : `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "10px", cursor: isSubmitting ? "not-allowed" : "pointer", fontWeight: "700", fontFamily: "'Cairo',sans-serif" }}>{isSubmitting ? "⏳ جاري الحفظ..." : "✅ حفظ"}</button>
                      <button onClick={() => { setEditIdx(null); setEditForm(null); setErr(""); }} style={{ flex: 1, background: "transparent", border: `1px solid ${T.cardBorder}`, color: T.subtext, borderRadius: "10px", padding: "10px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>إلغاء</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-start" }}>
                    <div style={{ flex: "1 1 220px", minWidth: "180px", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                      <p style={{ margin: 0, fontWeight: "700", color: T.text, fontSize: "14px" }}>{e.username}</p>
                                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.subtext, wordBreak: "break-word", overflowWrap: "anywhere" }}>{getRoleDescription(e.role)} · البريد: {e.email || "—"} · كلمة السر: {e.password || "—"}</p>
                    </div>
                    <button onClick={() => startEdit(i)} style={{ flex: "1 1 120px", minWidth: "120px", background: `${T.accent}22`, border: "none", borderRadius: "8px", padding: "8px 10px", cursor: "pointer", fontSize: "14px" }}>✏️ تعديل</button>
                    <button onClick={() => removeEditor(i)} style={{ flex: "1 1 120px", minWidth: "120px", background: "#e5533318", color: "#e55333", border: "1px solid #e5533340", borderRadius: "8px", padding: "8px 10px", cursor: "pointer", fontSize: "14px", fontFamily: "'Cairo',sans-serif" }}>🗑️ حذف</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
        )}
        <h3 style={{ color: T.text, margin: "16px 0 10px", fontSize: "15px" }}>➕ إضافة محرر جديد</h3>
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <input value={form.username} onChange={e => { setForm(f => ({ ...f, username: e.target.value })); setErr(""); }} placeholder="اسم المستخدم للمحرر" style={inp} />
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="البريد الإلكتروني (اختياري)" style={inp} />
          <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="كلمة السر" style={inp} />
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inp}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {form.role === "custom" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", background: T.sectionBg, borderRadius: "10px", padding: "10px" }}>
              {PERMISSION_OPTIONS.map(opt => (
                <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: T.text, background: form.permissions.includes(opt.id) ? `${T.accent}22` : "transparent", border: `1px solid ${form.permissions.includes(opt.id) ? T.accent : T.cardBorder}`, borderRadius: "8px", padding: "5px 8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.permissions.includes(opt.id)} onChange={() => setForm(f => ({ ...f, permissions: togglePermission(f.permissions, opt.id) }))} style={{ accentColor: T.accent }} />
                  {opt.label}
                </label>
              ))}
            </div>
          )}
          {err && <p style={{ color: T.danger, fontSize: "12px", margin: 0 }}>{err}</p>}
          <button onClick={addEditor} disabled={isSubmitting} style={{ background: isSubmitting ? "#6b7280" : `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontSize: "14px", fontWeight: "700", cursor: isSubmitting ? "not-allowed" : "pointer", fontFamily: "'Cairo',sans-serif" }}>
            {isSubmitting ? "⏳ جاري الحفظ..." : flashSaved ? "✅ تم الحفظ!" : "إضافة محرر"}
          </button>
        </div>
      </div>
    </div>
  );
}
