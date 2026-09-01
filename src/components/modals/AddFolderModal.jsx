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

export default function AddFolderModal({
  isOpen,
  title,
  onClose,
  value,
  onChange,
  onSubmit,
  submitLabel = "إنشاء",
  isSubmitting = false,
  disableBackdropClose = false,
  footer,
  inputPlaceholder = "اسم المجلد",
  inputStyle = defaultInputStyle,
}) {
  const resolvedFooter = footer ?? (
    <>
      <button onClick={onClose} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>إلغاء</button>
      <button onClick={onSubmit} disabled={isSubmitting || !String(value || "").trim()} style={{ background: "linear-gradient(135deg,#5B52D4,#8B82E8)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", cursor: isSubmitting || !String(value || "").trim() ? "not-allowed" : "pointer", opacity: isSubmitting || !String(value || "").trim() ? 0.6 : 1 }}>
        {isSubmitting ? "جاري الإنشاء..." : submitLabel}
      </button>
    </>
  );

  return (
    <Modal open={isOpen} title={title} onClose={onClose} disableBackdropClose={disableBackdropClose} footer={resolvedFooter}>
      <input
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={inputPlaceholder}
        style={inputStyle}
      />
    </Modal>
  );
}
