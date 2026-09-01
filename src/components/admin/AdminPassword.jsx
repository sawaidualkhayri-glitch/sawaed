import { useState } from "react";
import AdminSection from "./AdminSection.jsx";
import { getDocument, setDocument, deleteDocument } from "../../firestoreService";

export default function AdminPassword({ config, saveConfig, T, onBack, role }) {
  const OWNER_EMAIL = "sawaidualkhayri@gmail.com";
  const [step, setStep] = useState(1);
  const [sending, setSending] = useState(false);

  if (role !== "super_admin") {
    return (
      <div className="app-shell" style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
        <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={onBack} style={{ background: "transparent", border: "none", color: T.accent, fontSize: "15px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع</button>
          <h2 style={{ margin: 0, color: T.accent, fontSize: "18px", fontWeight: "800" }}>🔐 تغيير كلمة السر</h2>
        </div>
        <div style={{ padding: "20px", color: T.text }}>لا توجد صلاحية لإجراء هذه العملية لهذا الحساب.</div>
      </div>
    );
  }
  const [code, setCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "12px 14px", fontSize: "14px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box" };

  const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

  const sendCode = async () => {
    setSending(true);
    setErr("");
    const generatedCode = generateCode();
    setCode(generatedCode);
    const expiresAt = Date.now() + 10 * 60 * 1000;
    await setDocument("admin_codes", "reset", { code: generatedCode, expiresAt });
    window.location.href = `mailto:${OWNER_EMAIL}?subject=كود تغيير كلمة السر - سواعد الخير&body=كود التحقق الخاص بك: ${generatedCode}%0A%0Aصالح لمدة 10 دقائق فقط.`;
    setSending(false);
    setStep(2);
    setMsg(`تم إرسال الكود إلى ${OWNER_EMAIL}`);
  };

  const verifyCode = async () => {
    setErr("");
    const stored = await getDocument("admin_codes", "reset");
    if (!stored) { setErr("انتهت صلاحية الكود، اطلب كوداً جديداً"); return; }
    if (Date.now() > stored.expiresAt) { setErr("انتهت صلاحية الكود (10 دقائق)"); return; }
    if (inputCode.trim() !== stored.code) { setErr("الكود غلط!"); return; }
    setStep(3);
  };

  const changePassword = async () => {
    setErr("");
    if (newPass.length < 4) { setErr("كلمة السر أقل من 4 أحرف"); return; }
    if (newPass !== confirmPass) { setErr("كلمتا السر غير متطابقتين"); return; }
    await saveConfig({ ...config });
    await deleteDocument("admin_codes", "reset");
    setStep(4);
  };

  return (
    <AdminSection title="تغيير كلمة السر" icon="🔐" T={T} onBack={onBack} onSave={() => {}}>
      <div style={{ background: T.sectionBg, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "16px", marginBottom: "16px" }}>
        <p style={{ color: T.subtext, fontSize: "13px", margin: 0 }}>🔒 لتغيير كلمة السر، سيتم إرسال كود تحقق إلى الإيميل الرسمي فقط:</p>
        <p style={{ color: T.accent, fontSize: "14px", fontWeight: "700", margin: "6px 0 0" }}>{OWNER_EMAIL}</p>
      </div>
      {step === 1 && (
        <div>
          <p style={{ color: T.text, fontSize: "14px", margin: "0 0 14px" }}>اضغط لإرسال كود التحقق إلى إيميلك:</p>
          <button onClick={sendCode} disabled={sending} style={{ width: "100%", background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "15px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
            {sending ? "⏳ جاري الإرسال..." : "📧 إرسال كود التحقق"}
          </button>
        </div>
      )}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {msg && <p style={{ color: "#238636", fontSize: "13px", margin: 0 }}>✅ {msg}</p>}
          <p style={{ color: T.text, fontSize: "14px", margin: 0 }}>أدخل الكود المرسل للإيميل:</p>
          <input value={inputCode} onChange={e => { setInputCode(e.target.value); setErr(""); }} placeholder="الكود المكون من 6 أرقام" style={inp} type="number" />
          {err && <p style={{ color: "#e55", fontSize: "13px", margin: 0 }}>{err}</p>}
          <button onClick={verifyCode} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>تحقق من الكود ✓</button>
          <button onClick={() => { setStep(1); setErr(""); setMsg(""); }} style={{ background: "transparent", border: "none", color: T.subtext, cursor: "pointer", fontSize: "13px", fontFamily: "'Cairo',sans-serif" }}>← إرسال كود جديد</button>
        </div>
      )}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <p style={{ color: "#238636", fontSize: "13px", margin: 0 }}>✅ تم التحقق! أدخل كلمة السر الجديدة:</p>
          <input value={newPass} onChange={e => { setNewPass(e.target.value); setErr(""); }} placeholder="كلمة السر الجديدة" type="password" style={inp} />
          <input value={confirmPass} onChange={e => { setConfirmPass(e.target.value); setErr(""); }} placeholder="تأكيد كلمة السر" type="password" style={inp} />
          {err && <p style={{ color: "#e55", fontSize: "13px", margin: 0 }}>{err}</p>}
          <button onClick={changePassword} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>💾 حفظ كلمة السر الجديدة</button>
        </div>
      )}
      {step === 4 && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎉</div>
          <p style={{ color: "#238636", fontWeight: "700", fontSize: "16px" }}>تم تغيير كلمة السر بنجاح!</p>
          <button onClick={onBack} style={{ marginTop: "14px", background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "12px", padding: "12px 24px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← رجوع للإدارة</button>
        </div>
      )}
    </AdminSection>
  );
}
