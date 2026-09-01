import React, { useEffect } from "react";

export default function Modal({ open, isOpen, title, children, footer, onClose, disableBackdropClose = false }) {
  const shouldRender = Boolean(open ?? isOpen);

  useEffect(() => {
    if (!shouldRender) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shouldRender, onClose]);

  if (!shouldRender) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 10, 20, 0.75)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
      onClick={disableBackdropClose ? undefined : onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "rgba(12, 12, 30, 0.96)",
          border: "1px solid rgba(124,115,245,0.32)",
          borderRadius: "24px",
          boxShadow: "0 28px 80px rgba(0,0,0,0.35)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "18px 22px 8px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, color: "#fff", fontSize: "18px", fontWeight: "800" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#ccc", fontSize: "20px", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: "18px 22px 24px" }}>{children}</div>
        {footer ? (
          <div style={{ padding: "0 22px 20px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
