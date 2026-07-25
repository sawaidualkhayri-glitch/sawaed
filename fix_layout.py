#!/usr/bin/env python3
import re

file_path = r"c:\Users\Abood\Desktop\Programing\sawaed\src\App.jsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix SubjectPage main container - expand to full width
content = content.replace(
    'minHeight: "100vh", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T.bg, fontFamily: "\'Cairo\',sans-serif", direction: "rtl", padding: "0 12px 30px", boxSizing: "border-box" }}>\n      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px", borderRadius: "0 0 20px 20px", boxSizing: "border-box" }}>',
    'width: "100%", minHeight: "100vh", background: T.bg, fontFamily: "\'Cairo\',sans-serif", direction: "rtl", paddingBottom: "30px", boxSizing: "border-box" }}>\n      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, width: "100%", boxSizing: "border-box" }}>\n        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>'
)

# Add closing div after header
content = content.replace(
    '        </div>\n\n      <div style={{ width: "100%", maxWidth: "1000px", margin: "0 auto", padding: "16px 4px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px", boxSizing: "border-box" }}>',
    '        </div>\n      </div>\n\n      <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", boxSizing: "border-box" }}>'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Layout fixes applied successfully!")
