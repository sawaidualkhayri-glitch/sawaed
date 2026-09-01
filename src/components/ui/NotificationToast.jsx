export default function NotificationToast({ toast }) {
  if (!toast) return null;

  return (
    <div style={{ position: "fixed", left: "50%", bottom: "92px", transform: "translateX(-50%)", maxWidth: "420px", width: "calc(100% - 24px)", background: "rgba(15, 18, 30, 0.96)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "14px", padding: "12px 14px", boxShadow: "0 18px 32px rgba(0,0,0,0.28)", zIndex: 99998, color: "#fff" }}>
      <div style={{ fontWeight: "800", marginBottom: "4px", fontSize: "13px" }}>{toast.title}</div>
      <div style={{ fontSize: "12px", color: "#dfe3ff", lineHeight: 1.5 }}>{toast.body}</div>
    </div>
  );
}
