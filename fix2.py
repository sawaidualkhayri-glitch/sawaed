#!/usr/bin/env python3
file_path = r"c:\Users\Abood\Desktop\Programing\sawaed\src\App.jsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix duplicated fontFamily
content = content.replace(
    'width: "100%", minHeight: "100vh", background: T.bg, fontFamily, background: T.bg, fontFamily: "\'Cairo\',sans-serif", direction: "rtl", paddingBottom: "30px"',
    'width: "100%", minHeight: "100vh", background: T.bg, fontFamily: "\'Cairo\',sans-serif", direction: "rtl", paddingBottom: "30px", boxSizing: "border-box"'
)

# Also fix the first occurrence (non-semester version)
content = content.replace(
    'width: "100%", minHeight: "100vh", background: T.bg, fontFamily, background: T.bg, fontFamily: "\'Cairo\',sans-serif", direction: "rtl", padding: "20px"',
    'width: "100%", minHeight: "100vh", background: T.bg, fontFamily: "\'Cairo\',sans-serif", direction: "rtl", padding: "20px", boxSizing: "border-box"'
)

# Fix the header div
content = content.replace(
    'background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px" }}>\n        <button',
    'background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, width: "100%", boxSizing: "border-box" }}>\n        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>\n          <button'
)

# Fix closing - add closing div before sections grid
content = content.replace(
    '        </div>\n\n      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>',
    '        </div>\n      </div>\n\n      <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", boxSizing: "border-box" }}>'
)

# Fix section buttons to be full width
content = content.replace(
    'textAlign: "right" }}>',
    'textAlign: "right", width: "100%" }}>'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed layout issues!")
