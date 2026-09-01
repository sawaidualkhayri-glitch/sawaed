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

export default function DriveImportModal({
  isOpen,
  title,
  onClose,
  folderName,
  onFolderNameChange,
  folderUrl,
  onFolderUrlChange,
  onSubmit,
  isSubmitting = false,
  disableBackdropClose = false,
  footer,
  inputStyle = defaultInputStyle,
  valid = false,
  submitLabel = "استيراد وحفظ",
}) {
  const resolvedFooter = footer ?? (
    <>
      <button onClick={onClose} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>إلغاء</button>
      <button onClick={onSubmit} disabled={isSubmitting || !valid} style={{ background: "linear-gradient(135deg,#5B52D4,#8B82E8)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", cursor: isSubmitting || !valid ? "not-allowed" : "pointer", opacity: isSubmitting || !valid ? 0.6 : 1 }}>
        {isSubmitting ? "جاري الاستيراد..." : submitLabel}
      </button>
    </>
  );

  return (
    <Modal open={isOpen} title={title} onClose={onClose} disableBackdropClose={disableBackdropClose} footer={resolvedFooter}>
      <input value={folderName || ""} onChange={(e) => onFolderNameChange?.(e.target.value)} placeholder="اسم المجلد" style={inputStyle} />
      <input value={folderUrl || ""} onChange={(e) => onFolderUrlChange?.(e.target.value)} placeholder="رابط أو ID مجلد Google Drive" style={inputStyle} />
    </Modal>
  );
}
