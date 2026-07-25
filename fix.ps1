$file = "c:\Users\Abood\Desktop\Programing\sawaed\src\App.jsx"
$content = Get-Content $file -Raw

# Replace SubjectPage maxWidth APP_MAX_WIDTH with width 100%
$content = $content -replace '(\s+)<div style=\{\{ minHeight: "100vh", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T\.bg, fontFamily: "''Cairo'',sans-serif", direction: "rtl", padding: "0 12px 30px", boxSizing: "border-box" \}\}>', '$1<div style={{ width: "100%", minHeight: "100vh", background: T.bg, fontFamily: "''Cairo'',sans-serif", direction: "rtl", paddingBottom: "30px", boxSizing: "border-box" }}>'

$content | Set-Content $file
Write-Host "Fixed!"
