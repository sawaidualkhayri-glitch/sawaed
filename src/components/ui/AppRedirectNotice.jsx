import React from "react";

export default function AppRedirectNotice({ T }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.text, padding: 24 }}>
      جاري إعادة التوجيه...
    </div>
  );
}
