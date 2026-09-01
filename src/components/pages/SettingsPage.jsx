import { useState } from "react";
import { useAuth, isAnyEditor } from "../../AuthContext.jsx";

export default function SettingsPage({ config, T, darkMode, setDarkMode, oledModeEnabled, setOledModeEnabled, currentUser, updateUser, logout, onOpenAdmin, onOpenTimer, ls, lsSet, requestFCMToken }) {
  const { isAdmin } = useAuth();
  const canOpenAdminPanel = isAnyEditor(currentUser?.role);
  const [editNickname, setEditNickname] = useState(currentUser?.nickname || currentUser?.username || "");
  const [editGrade, setEditGrade] = useState(currentUser?.grade || config.grades?.[0] || "");
  const [editBranch, setEditBranch] = useState(currentUser?.branch || config.branches?.[0] || "");
  const [saved, setSaved] = useState(false);

  const inp = { background: T.inputBg, border: `1.5px solid ${T.cardBorder}`, borderRadius: "12px", padding: "12px 14px", fontSize: "14px", color: T.text, width: "100%", outline: "none", fontFamily: "'Cairo',sans-serif", direction: "rtl", boxSizing: "border-box" };

  const handleSave = async () => {
    await updateUser({ nickname: editNickname.trim() || currentUser?.username || "", grade: editGrade, branch: editBranch });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!currentUser) {
    return <div style={{ padding: "20px", color: T.text, textAlign: "center" }}>جارٍ تسجيل الخروج...</div>;
  }

  const [notifStatus, setNotifStatus] = useState(Notification.permission || "default");

  const requestNotifications = async () => {
    console.info("Requesting notification permission from settings UI");
    try {
      const perm = await Notification.requestPermission();
      setNotifStatus(perm);

      if (perm === "granted") {
        console.info("Notification permission granted; starting FCM token sync");
        const token = await requestFCMToken();
        console.info("FCM token registration result:", token ? "success" : "no token");

        if (token) {
          new Notification("سواعد الخير ✅", { body: "تم تفعيل الإشعارات بنجاح!" });
        } else {
          console.warn("FCM token registration returned null. Check SW registration, VAPID key and Firestore rules.");
        }
      } else {
        console.warn("Notification permission denied by browser user:", perm);
      }
    } catch (err) {
      console.error("Notification toggle failed:", err);
      setNotifStatus(Notification.permission || "default");
    }
  };

  // ─── تذكير المذاكرة المجدول (تاريخ + وقت بالدقيقة) ───
  const [reminders, setReminders] = useState(() => ls("sawaed_study_reminders", []));
  const [reminderTime, setReminderTime] = useState("");
  const [reminderLabel, setReminderLabel] = useState("");

  const addReminder = () => {
    if (!reminderTime) return;
    const newList = [...reminders, { id: Date.now(), time: reminderTime, label: reminderLabel.trim(), fired: false }];
    setReminders(newList);
    lsSet("sawaed_study_reminders", newList);
    setReminderTime(""); setReminderLabel("");
  };

  const deleteReminder = (id) => {
    const newList = reminders.filter(r => r.id !== id);
    setReminders(newList);
    lsSet("sawaed_study_reminders", newList);
  };

  // ─── العبارات التحفيزية بفاصل زمني ───
  const [quoteInterval, setQuoteInterval] = useState(() => ls("sawaed_quote_interval_min", 0));
  const setQuoteIntervalAndSave = (mins) => {
    setQuoteInterval(mins);
    lsSet("sawaed_quote_interval_min", mins);
    if (mins > 0) { lsSet("sawaed_quote_last_sent", Date.now()); } // تبدأ العد من الآن
  };

  return (
    <div style={{ padding: "20px 16px", fontFamily: "'Cairo',sans-serif", direction: "rtl" }}>
      <h2 style={{ color: T.text, fontSize: "20px", fontWeight: "800", margin: "0 0 20px" }}>⚙️ الإعدادات</h2>
      {canOpenAdminPanel && (
        <button onClick={() => onOpenAdmin && onOpenAdmin()} style={{ width: "100%", background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "15px", fontWeight: "700", cursor: "pointer", marginBottom: "18px", fontFamily: "'Cairo',sans-serif" }}>
          🛡️ لوحة الإدارة
        </button>
      )}

      {/* تايمر دراسة */}
      <button onClick={() => onOpenTimer && onOpenTimer()} style={{ width: "100%", background: `linear-gradient(135deg,${T.accent}22,${T.accent2}22)`, border: `1.5px solid ${T.accent}55`, borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", marginBottom: "14px", fontFamily: "'Cairo',sans-serif", textAlign: "right" }}>
        <span style={{ fontSize: "28px" }}>⏱️</span>
        <div>
          <p style={{ margin: 0, fontWeight: "700", color: T.text, fontSize: "15px" }}>تايمر الدراسة</p>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.subtext }}>بومودورو، 45 دق، أو مخصص</p>
        </div>
      </button>

      {/* الإشعارات */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "16px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontWeight: "700", color: T.text, fontSize: "14px" }}>🔔 الإشعارات</p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: notifStatus === "granted" ? "#238636" : T.subtext }}>
              {notifStatus === "granted" ? "✅ مفعّلة" : notifStatus === "denied" ? "❌ محظورة من الإعدادات" : "غير مفعّلة"}
            </p>
          </div>
          {notifStatus !== "granted" && notifStatus !== "denied" && (
            <button onClick={requestNotifications} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
              تفعيل
            </button>
          )}
        </div>
      </div>

      {/* تذكير المذاكرة المجدول */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "20px", padding: "18px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
        <h3 style={{ color: T.text, margin: "0 0 14px", fontSize: "15px" }}>⏰ تذكير مذاكرة مجدول</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input value={reminderLabel} onChange={e => setReminderLabel(e.target.value)} placeholder="عنوان التذكير (اختياري)" style={inp} />
          <input type="datetime-local" value={reminderTime} onChange={e => setReminderTime(e.target.value)} style={{ ...inp, direction: "ltr", textAlign: "right" }} />
          <button onClick={addReminder} disabled={!reminderTime} style={{ background: reminderTime ? `linear-gradient(135deg,${T.accent},${T.accent2})` : "#ccc", color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontSize: "14px", fontWeight: "700", cursor: reminderTime ? "pointer" : "not-allowed", fontFamily: "'Cairo',sans-serif" }}>
            ➕ جدولة التذكير
          </button>
          {reminders.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
              {reminders.map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "10px", background: T.sectionBg, borderRadius: "10px", padding: "8px 12px" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "13px", color: T.text, fontWeight: "700" }}>{r.label || "تذكير مذاكرة"}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: T.subtext }}>{new Date(r.time).toLocaleString("ar")} {r.fired ? "· ✅ تم التنبيه" : ""}</p>
                  </div>
                  <button onClick={() => deleteReminder(r.id)} style={{ background: "#e5533322", border: "1px solid #e55", color: "#e55", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px" }}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* العبارات التحفيزية بفاصل زمني */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "20px", padding: "18px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
        <h3 style={{ color: T.text, margin: "0 0 14px", fontSize: "15px" }}>🔔 إشعارات تحفيز</h3>
        <p style={{ color: T.subtext, fontSize: "12px", margin: "0 0 10px" }}>حدد متى تريد أن نرسل لك الإشعار — ستصلك العبارات بالترتيب: الأولى، ثم الثانية في الفاصل التالي، وهكذا.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {[
            { label: "إيقاف", value: 0 },
            { label: "كل 30 دقيقة", value: 30 },
            { label: "كل ساعة", value: 60 },
            { label: "كل ساعتين", value: 120 },
            { label: "كل 4 ساعات", value: 240 },
          ].map(opt => (
            <button key={opt.value} onClick={() => setQuoteIntervalAndSave(opt.value)} style={{ background: quoteInterval === opt.value ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.inputBg, color: quoteInterval === opt.value ? "#fff" : T.text, border: `1.5px solid ${quoteInterval === opt.value ? T.accent : T.cardBorder}`, borderRadius: "12px", padding: "8px 14px", fontSize: "13px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {currentUser.email && (
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "16px", padding: "14px 16px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: T.subtext }}>📧 {currentUser.email}</p>
        </div>
      )}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "20px", padding: "18px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
        <h3 style={{ color: T.text, margin: "0 0 14px", fontSize: "15px" }}>✏️ تعديل البيانات</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <label style={{ fontSize: "12px", color: T.subtext, marginBottom: "4px", display: "block" }}>اسم المستخدم (ثابت)</label>
            <input value={currentUser.username || ""} disabled style={{ ...inp, opacity: 0.6, cursor: "not-allowed" }} />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: T.subtext, marginBottom: "4px", display: "block" }}>اللقب</label>
            <input value={editNickname} onChange={e => setEditNickname(e.target.value)} placeholder="لقبك (يظهر في الموقع)" style={inp} />
          </div>
          <select value={editGrade} onChange={e => setEditGrade(e.target.value)} style={inp}>
            {config.grades?.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={editBranch} onChange={e => setEditBranch(e.target.value)} style={inp}>
            {config.branches?.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <button onClick={handleSave} style={{ background: `linear-gradient(135deg,${T.accent},${T.accent2})`, color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
            {saved ? "✅ تم الحفظ!" : "حفظ التغييرات"}
          </button>
        </div>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "20px", padding: "18px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
        <h3 style={{ color: T.text, margin: "0 0 14px", fontSize: "15px" }}>🎨 المظهر</h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: T.text, fontSize: "14px" }}>{darkMode ? "☀️ الوضع النهاري" : "🌙 الوضع الليلي"}</span>
          <button onClick={() => setDarkMode(!darkMode)} style={{ background: darkMode ? T.accent : "#ddd", border: "none", borderRadius: "20px", width: "50px", height: "26px", cursor: "pointer", position: "relative" }}>
            <div style={{ position: "absolute", top: "3px", left: darkMode ? "26px" : "3px", width: "20px", height: "20px", background: "#fff", borderRadius: "50%", transition: "left 0.3s" }} />
          </button>
        </div>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "20px", padding: "18px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
        <h3 style={{ color: T.text, margin: "0 0 8px", fontSize: "15px" }}>🔋 إعدادات المظهر والبطارية</h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px" }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, color: T.text, fontSize: "14px", fontWeight: "700" }}>وضع توفير الطاقة (OLED Black)</p>
            <p style={{ margin: "4px 0 0", color: T.subtext, fontSize: "12px", lineHeight: 1.6 }}>يحول الخلفية إلى أسود حقيقي (#000000) لتوفير أقصى قدر من طاقة البطارية</p>
          </div>
          <button type="button" role="switch" aria-checked={oledModeEnabled} aria-label="وضع توفير الطاقة OLED" onClick={() => setOledModeEnabled(!oledModeEnabled)} style={{ background: oledModeEnabled ? T.accent : "#777", border: "none", borderRadius: "20px", width: "50px", height: "26px", cursor: "pointer", position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: "3px", left: oledModeEnabled ? "26px" : "3px", width: "20px", height: "20px", background: "#fff", borderRadius: "50%", transition: "left 0.3s" }} />
          </button>
        </div>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: "20px", padding: "18px", backdropFilter: "blur(12px)", marginBottom: "14px" }}>
        <h3 style={{ color: T.text, margin: "0 0 12px", fontSize: "15px" }}>📞 التواصل والاستفسارات</h3>
        {config.contactLinks?.map((c, i) => (
          <a key={i} href={c.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "10px", background: T.sectionBg, borderRadius: "12px", padding: "12px", textDecoration: "none", marginBottom: "8px" }}>
            <span style={{ fontSize: "22px" }}>{c.icon}</span>
            <span style={{ color: T.text, fontSize: "14px" }}>{c.label}</span>
          </a>
        ))}
      </div>
      <button onClick={logout} style={{ width: "100%", background: "transparent", border: `1.5px solid ${T.danger}`, borderRadius: "14px", padding: "14px", fontSize: "15px", fontWeight: "700", color: T.danger, cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
        🚪 تسجيل الخروج
      </button>
    </div>
  );
}
