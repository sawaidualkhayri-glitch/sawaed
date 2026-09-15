import { useEffect, useRef, useState } from "react";

export default function IconSelect({ value, options = [], onChange, style = {}, disabled = false, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find(option => option.value === value) || options[0];

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%", direction: "rtl" }}>
      <button
        type="button"
        disabled={disabled || options.length === 0}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        style={{ ...style, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", cursor: disabled || options.length === 0 ? "not-allowed" : "pointer", textAlign: "right" }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          {selected?.icon && <span aria-hidden="true" style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0 }}>{selected.icon}</span>}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected?.label || "لا توجد خيارات"}</span>
        </span>
        <span aria-hidden="true" style={{ fontSize: "12px", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && !disabled && options.length > 0 && (
        <div role="listbox" style={{ position: "absolute", zIndex: 30, top: "calc(100% + 4px)", right: 0, left: 0, maxHeight: "260px", overflowY: "auto", background: style.background || "#1f2937", border: style.border || "1px solid rgba(255,255,255,0.2)", borderRadius: style.borderRadius || "10px", boxShadow: "0 12px 30px rgba(0,0,0,0.25)", padding: "4px" }}>
          {options.map(option => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onClick={() => { onChange?.(option.value); setOpen(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", direction: "rtl", background: option.value === value ? "rgba(127,127,127,0.18)" : "transparent", border: "none", borderRadius: "8px", color: style.color || "inherit", padding: "9px 10px", cursor: "pointer", textAlign: "right", fontFamily: style.fontFamily || "inherit", fontSize: style.fontSize || "13px" }}
            >
              {option.icon && <span aria-hidden="true" style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0 }}>{option.icon}</span>}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
