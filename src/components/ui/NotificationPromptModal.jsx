import React from "react";

export default function NotificationPromptModal({ open, onDismiss, onEnable, T }) {
  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10, 10, 20, 0.72)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: "20px" }} onClick={() => onDismiss(true)}>
      <div style={{ width: "100%", maxWidth: "420px", background: "rgba(17, 18, 31, 0.96)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "22px", boxShadow: "0 24px 60px rgba(0,0,0,0.4)", padding: "20px 20px 16px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: "42px", marginBottom: "10px" }}>🔔</div>
        <h3 style={{ margin: "0 0 10px", color: "#fff", fontSize: "20px", fontWeight: "800", lineHeight: 1.5 }}>
          فعل الإشعارات لتصلك أخر مستجدات الدراسة
        </h3>
        <p style={{ margin: "0 0 18px", color: "#a9acc7", fontSize: "13px", lineHeight: 1.6 }}>
          يمكنك تفعيل الإشعارات في أي وقت من الإعدادات
        </p>
        <div style={{ marginBottom: "16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px", color: "#dfe3ff", fontSize: "12px", lineHeight: 1.6 }}>
          إذا لم تظهر نافذة التفعيل، يرجى الضغط على أيقونة الجرس 🔔 بجانب رابط الموقع (URL) أعلى الصفحة واختيار Allow.
        </div>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={async () => { await onEnable(); }} style={{ flex: "1 1 150px", background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "#fff", border: "none", borderRadius: "12px", padding: "12px 16px", fontSize: "15px", fontWeight: "700", cursor: "pointer", boxShadow: "0 10px 28px rgba(34,197,94,0.28)" }}>
            تفعيل
          </button>
          <button onClick={() => onDismiss(true)} style={{ flex: "1 1 150px", background: "rgba(255,255,255,0.08)", color: "#dfe3ff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", padding: "12px 16px", fontSize: "15px", fontWeight: "600", cursor: "pointer" }}>
            لا، لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
}
