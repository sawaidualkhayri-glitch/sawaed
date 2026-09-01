import { useState } from "react";
import { signUpWithEmail, loginWithGoogle, loginWithIdentifier } from "../../firebaseAuth";

function formatAuthError(error) {
  if (!error) return "حدث خطأ غير متوقع. حاول مرة أخرى.";
  const code = error.code || "";
  switch (code) {
    case "auth/invalid-email": return "البريد الإلكتروني غير صالح.";
    case "auth/user-not-found": return "الحساب غير موجود.";
    case "auth/wrong-password":
    case "auth/invalid-credential": return "اسم المستخدم أو كلمة السر غير صحيحة.";
    case "auth/email-not-verified": return "يرجى تأكيد بريدك الإلكتروني. تم إرسال رابط التحقق.";
    case "auth/email-already-in-use": return "هذا البريد الإلكتروني مستخدم بالفعل.";
    case "auth/weak-password": return "كلمة السر ضعيفة. استخدم 6 أحرف على الأقل.";
    case "auth/popup-closed-by-user": return "تم إغلاق نافذة Google قبل اكتمال الدخول.";
    case "auth/username-not-found": return "اسم المستخدم غير موجود.";
    default: return error.message || "حدث خطأ. حاول مرة أخرى.";
  }
}

export default function RegisterPage({ config, T, darkMode, appMaxWidth }) {
  const [mode, setMode] = useState("start");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [grade, setGrade] = useState(config.grades?.[0] || "");
  const [branch, setBranch] = useState(config.branches?.[0] || "");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "14px", padding: "14px 16px", fontSize: "16px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box" };

  const pwRow = (val, setVal, ph, show, setShow) => (
    <div style={{ position: "relative" }}>
      <input value={val} onChange={e => { setVal(e.target.value); setErr(""); }} type={show ? "text" : "password"} placeholder={ph} style={inp} />
      <button onClick={() => setShow(v => !v)} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: T.subtext }}>{show ? "🙈" : "👁️"}</button>
    </div>
  );

  const authWithGoogle = async () => {
    setLoading(true);
    setErr("");
    try {
      await loginWithGoogle();
    } catch (e) {
      setErr(formatAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmailPassword = async () => {
    if (!email.trim()) { setErr("أدخل البريد أو اسم المستخدم."); return; }
    if (!password) { setErr("أدخل كلمة السر."); return; }
    setLoading(true);
    setErr("");
    try {
      await loginWithIdentifier(email.trim(), password);
    } catch (e) {
      console.error("[RegisterPage] login failed", { identifier: email.trim(), code: e?.code, message: e?.message });
      setErr(formatAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async () => {
    if (!email.trim()) { setErr("أدخل البريد الإلكتروني."); return; }
    if (!password || password.length < 6) { setErr("كلمة السر قصيرة (6 أحرف+)"); return; }
    if (password !== confirmPassword) { setErr("كلمتا السر غير متطابقتين."); return; }
    if (!grade || !branch) { setErr("اختر الصف والفرع."); return; }

    setLoading(true);
    setErr("");
    try {
      const display = displayName.trim() || email.split("@")[0];
      await signUpWithEmail(email.trim(), password, display, {
        username: display,
        nickname: display,
        grade,
        branch,
        progress: {},
        savedItems: [],
        pinnedNews: [],
      });
    } catch (e) {
      setErr(formatAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const errBox = err ? <div style={{ background: `${T.danger}15`, border: `1px solid ${T.danger}44`, borderRadius: "10px", padding: "10px 14px", marginBottom: "12px" }}><p style={{ color: T.danger, fontSize: "13px", margin: 0 }}>{err}</p></div> : null;

  return (
    <div style={{ minHeight: "100vh", width: "100%", maxWidth: appMaxWidth, margin: "0 auto", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", direction: "rtl", fontFamily: "'Cairo',sans-serif", boxSizing: "border-box" }}>
      <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: "24px", padding: "32px 24px", width: "100%", maxWidth: "360px", backdropFilter: "blur(16px)" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "48px" }}>🌟</div>
          <h2 style={{ color: T.accent, margin: "8px 0 0", fontSize: "22px", fontWeight: "800" }}>سواعد الخير</h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: T.subtext }}>
            {mode === "start" ? "أهلاً بك!" : mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </p>
        </div>

        {errBox}

        {mode === "start" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button onClick={() => setMode("login")} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "16px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
              🔐 تسجيل الدخول بالبريد
            </button>
            <button onClick={() => setMode("register")} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "16px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
              ✍️ إنشاء حساب جديد
            </button>
            <button onClick={authWithGoogle} disabled={loading} style={{ background: loading ? "#ccc" : `linear-gradient(135deg,#4285F4,#34A853)`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "16px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Cairo',sans-serif", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              {loading ? "⏳ جاري..." : (
                <>
                  تسجيل الدخول بـ Google
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" style={{ verticalAlign: "middle", marginInlineStart: "6px" }}><path d="M500 261.8C500 403.3 403.1 504 260 504 122.8 504 12 393.2 12 256S122.8 8 260 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9c-88.3-85.2-252.5-21.2-252.5 118.2 0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9l-140.8 0 0-85.3 236.1 0c2.3 12.7 3.9 24.9 3.9 41.4z"/></svg>
                </>
              )}
            </button>
          </div>
        )}

        {mode === "login" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} placeholder="البريد الإلكتروني" style={{ ...inp, direction: "ltr", textAlign: "left" }} />
            {pwRow(password, setPassword, "كلمة السر", showPw, setShowPw)}
            <button onClick={loginWithEmailPassword} disabled={loading || !email || !password} style={{ background: loading ? "#ccc" : `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "16px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Cairo',sans-serif" }}>
              {loading ? "⏳ جاري..." : "🚀 تسجيل الدخول"}
            </button>
            <button onClick={() => setMode("start")} style={{ background: "transparent", border: "none", color: T.subtext, fontSize: "13px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
              ← رجوع
            </button>
          </div>
        )}

        {mode === "register" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input value={displayName} onChange={e => { setDisplayName(e.target.value); setErr(""); }} placeholder="اسم العرض" style={inp} />
            <input value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} placeholder="البريد الإلكتروني" style={{ ...inp, direction: "ltr", textAlign: "left" }} />
            {pwRow(password, setPassword, "كلمة السر (6 أحرف+)", showPw, setShowPw)}
            <input value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setErr(""); }} type={showPw ? "text" : "password"} placeholder="تأكيد كلمة السر" style={{ ...inp, borderColor: confirmPassword && confirmPassword !== password ? T.danger : T.cardBorder }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <select value={grade} onChange={e => setGrade(e.target.value)} style={{ ...inp, flex: 1 }}>
                <option value="">اختر صفك</option>
                {config.grades?.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={branch} onChange={e => setBranch(e.target.value)} style={{ ...inp, flex: 1 }}>
                <option value="">اختر فرعك</option>
                {config.branches?.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <button onClick={registerWithEmail} disabled={loading || !email || !password || !confirmPassword || !grade || !branch} style={{ background: loading ? "#ccc" : `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "16px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Cairo',sans-serif" }}>
              {loading ? "⏳ جاري..." : "✅ إنشاء حساب"}
            </button>
            <button onClick={() => setMode("start")} style={{ background: "transparent", border: "none", color: T.subtext, fontSize: "13px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
              ← رجوع
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
