# Fix layout issues in App.jsx
$file = "c:\Users\Abood\Desktop\Programing\sawaed\src\App.jsx"
$content = Get-Content $file -Raw

# Fix SubjectPage container - Add width 100%
$content = $content -replace 'minHeight: "100vh", maxWidth: APP_MAX_WIDTH, margin: "0 auto", background: T\.bg, fontFamily: "\'Cairo\',sans-serif", direction: "rtl", padding: "0 12px 30px"', 'width: "100%", minHeight: "100vh", background: T.bg, fontFamily: "'"'"'Cairo'"'"',sans-serif", direction: "rtl", paddingBottom: "30px"'

# Save the file
$content | Set-Content $file

Write-Host "Layout fixes applied!"
