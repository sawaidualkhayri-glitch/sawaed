import React from "react";
import Modal from "../ui/Modal.jsx";

const defaultInputStyle = {
  background: "rgba(255,255,255,0.08)",
  border: "1.5px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "13px",
  color: "#fff",
  width: "100%",
  outline: "none",
  fontFamily: "'Cairo',sans-serif",
  direction: "rtl",
  boxSizing: "border-box",
  marginBottom: "8px"
};

export default function AddFileModal({
  isOpen,
  title,
  onClose,
  onSubmit,
  onChange,
  form,
  isValid,
  disableBackdropClose = false,
  footer,
  inputStyle = defaultInputStyle,
  submitLabel = "حفظ",
  isSubmitting = false,
}) {
  const resolvedFooter = footer ?? (
    <>
      <button onClick={onClose} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>إلغاء</button>
      <button onClick={onSubmit} disabled={isSubmitting || !isValid} style={{ background: "linear-gradient(135deg,#5B52D4,#8B82E8)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", cursor: isSubmitting || !isValid ? "not-allowed" : "pointer", opacity: isSubmitting || !isValid ? 0.6 : 1 }}>
        {isSubmitting ? "جاري الحفظ..." : submitLabel}
      </button>
    </>
  );

  return (
    <Modal open={isOpen} title={title} onClose={onClose} disableBackdropClose={disableBackdropClose} footer={resolvedFooter}>
      <input value={form.teacher || ""} onChange={(e) => onChange?.("teacher", e.target.value)} placeholder="اسم المدرس (اختياري)" style={inputStyle} />
      <input value={form.title || ""} onChange={(e) => onChange?.("title", e.target.value)} placeholder="العنوان *" style={inputStyle} />
      <input value={form.url || ""} onChange={(e) => onChange?.("url", e.target.value)} placeholder="رابط الملف" style={inputStyle} />
      <input value={form.description || ""} onChange={(e) => onChange?.("description", e.target.value)} placeholder="وصف (اختياري)" style={inputStyle} />
      <select value={form.type || "link"} onChange={(e) => onChange?.("type", e.target.value)} style={inputStyle}>
        <option value="link">رابط</option>
        <option value="pdf">PDF</option>
        <option value="image">صورة</option>
      </select>
    </Modal>
  );
}
