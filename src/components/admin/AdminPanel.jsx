import { useState, useEffect } from "react";
import { normalizeUserRole } from "../../AuthContext.jsx";
import AdminNews from "./AdminNews.jsx";
import AdminAnnouncements from "./AdminAnnouncements.jsx";
import AdminQuotes from "./AdminQuotes.jsx";
import AdminContact from "./AdminContact.jsx";
import AdminEditors from "./AdminEditors.jsx";
import AdminSplash from "./AdminSplash.jsx";
import AdminPassword from "./AdminPassword.jsx";
import AdminGrades from "./AdminGrades.jsx";
import AdminSubjects from "./AdminSubjects.jsx";
import AdminNav from "./AdminNav.jsx";
import AdminLessons from "./AdminLessons.jsx";
import AdminFoundation from "./AdminFoundation.jsx";
import AdminSections from "./AdminSections.jsx";
import AdminFolders from "./AdminFolders.jsx";

export default function AdminPanel({ config, saveConfig, T, darkMode, editorRole, editorPermissions, onBack, getSubjectsByGradeBranch, normalizeFoundKey, validateRequiredFields, normalizeDriveFolderInput, extractDriveFolderId, cloudflareWorkerBaseUrl, addFolderToTree, dissolveFolderInTree, getSubjectNames, canonicalizeGrade, canonicalizeBranch, normalizeFolderKey, getFolderKeyCandidates, fbGet, fbSet, fbAdd, fbDelete, getNews, addNewsItem, deleteNewsItem, normalizeNewsItem, formatNewsDate, sendLocalNotification }) {
  const [section, setSection] = useState("main");
  const [activeSubSection, setActiveSubSection] = useState(null);

  const role = normalizeUserRole(editorRole || "user");
  const isMaterialsEditor = role === "editor_malazem";
  const contentOverviewRoles = ["super_admin", "admin", "editor_full", "editor_news"];
  const materialsEditorRoles = ["editor_malazem", "editor_files", "notes"];
  const contentEditorRoles = ["super_admin", "admin", "editor_full", "editor_news"];
  const allAdminSections = [
    { id: "splash", label: "شاشة البداية", icon: "🌟", isAllowed: (currentRole) => ["super_admin", "editor_full"].includes(currentRole) },
    { id: "grades", label: "الصفوف والفروع", icon: "🏫", isAllowed: (currentRole) => currentRole === "super_admin" },
    { id: "subjects", label: "المواد الدراسية", icon: "📚", isAllowed: (currentRole) => ["super_admin", "editor_full", "editor_malazem"].includes(currentRole) },
    { id: "sections", label: "أقسام المادة (الرزم، الكتب...)", icon: "🗃️", isAllowed: (currentRole) => ["super_admin", "editor_full", "editor_malazem"].includes(currentRole) },
    { id: "folders", label: "إدارة المجلدات", icon: "📂", isAllowed: (currentRole) => ["super_admin", "admin", "editor_full", ...materialsEditorRoles].includes(currentRole) },
    { id: "lessons", label: "الدروس والإنجاز", icon: "✅", isAllowed: (currentRole) => contentEditorRoles.includes(currentRole) },
    { id: "quotes", label: "العبارات التحفيزية", icon: "💬", isAllowed: (currentRole) => contentEditorRoles.includes(currentRole) },
    { id: "foundation", label: "قسم التأسيس", icon: "🏗️", isAllowed: (currentRole) => ["super_admin", "admin", "editor_full", "editor_taasees"].includes(currentRole) },
    { id: "news", label: "الأخبار", icon: "📰", isAllowed: (currentRole) => contentEditorRoles.includes(currentRole) },
    { id: "announcements", label: "إشعارات وإعلانات فورية", icon: "📢", isAllowed: (currentRole) => contentEditorRoles.includes(currentRole) },
    { id: "nav", label: "الصفحات والتنقل", icon: "🧭", isAllowed: (currentRole) => ["super_admin", "editor_full"].includes(currentRole) },
    { id: "contact", label: "روابط التواصل", icon: "📞", isAllowed: (currentRole) => ["super_admin", "editor_full", "editor_news"].includes(currentRole) },
    { id: "editors", label: "إدارة المحررين", icon: "🛡️", isAllowed: (currentRole) => ["super_admin", "admin"].includes(currentRole) },
  ];

  const isSectionAllowed = (id) => {
    const sectionDefinition = allAdminSections.find(s => s.id === id);
    if (!sectionDefinition) return false;
    return sectionDefinition.isAllowed(role);
  };
  const adminSections = (allAdminSections || []).filter(s => isSectionAllowed(s.id));
  const mainMenuSections = (adminSections || []).filter((sectionItem) => !!sectionItem);
  const safeMainMenuSections = (mainMenuSections && mainMenuSections.length > 0)
    ? mainMenuSections
    : ((adminSections && adminSections.length > 0) ? [adminSections[0]] : [{ id: "fallback", label: "لا توجد صلاحيات متاحة", icon: "⚠️" }]);

  const handlePanelBack = () => {
    if (activeSubSection) {
      setActiveSubSection(null);
      return;
    }
    if (section !== "main") {
      setActiveSubSection(null);
      setSection("main");
      return;
    }
    onBack?.();
  };

  const handleContentBack = () => handlePanelBack();

  useEffect(() => {
    if (section === "main" && adminSections.length > 0 && !contentOverviewRoles.includes(role) && !isMaterialsEditor) {
      // Allow editor_malazem to remain on the main admin list without auto-navigation
      // setSection(adminSections[0].id);
      return;
    }
    if (section !== "main" && !isSectionAllowed(section)) setSection("main");
  }, [section, role, adminSections.length, contentOverviewRoles, isMaterialsEditor]);

  if (activeSubSection) {
    if (activeSubSection === "lessons") return <AdminLessons config={config} saveConfig={saveConfig} T={T} onBack={handleContentBack} getSubjectsByGradeBranch={getSubjectsByGradeBranch} />;
    if (activeSubSection === "quotes") return <AdminQuotes config={config} saveConfig={saveConfig} T={T} onBack={handleContentBack} />;
    if (activeSubSection === "news") return <AdminNews config={config} saveConfig={saveConfig} T={T} onBack={handleContentBack} getNews={getNews} addNewsItem={addNewsItem} deleteNewsItem={deleteNewsItem} normalizeNewsItem={normalizeNewsItem} formatNewsDate={formatNewsDate} />;
  }

  if (section !== "main" && isSectionAllowed(section)) {
    if (section === "splash") return <AdminSplash config={config} saveConfig={saveConfig} T={T} onBack={() => { setActiveSubSection(null); setSection("main"); }} />;
    if (section === "grades") return <AdminGrades config={config} saveConfig={saveConfig} T={T} onBack={() => { setActiveSubSection(null); setSection("main"); }} />;
    if (section === "subjects") return <AdminSubjects config={config} saveConfig={saveConfig} T={T} onBack={() => { setActiveSubSection(null); setSection("main"); }} />;
    if (section === "sections") return <AdminSections config={config} saveConfig={saveConfig} T={T} onBack={() => { setActiveSubSection(null); setSection("main"); }} getSubjectNames={getSubjectNames} />;
    if (section === "folders") return <AdminFolders config={config} saveConfig={saveConfig} T={T} onBack={() => { setActiveSubSection(null); setSection("main"); }} canonicalizeGrade={canonicalizeGrade} canonicalizeBranch={canonicalizeBranch} normalizeFolderKey={normalizeFolderKey} getFolderKeyCandidates={getFolderKeyCandidates} getSubjectsByGradeBranch={getSubjectsByGradeBranch} fbGet={fbGet} fbSet={fbSet} extractDriveFolderId={extractDriveFolderId} cloudflareWorkerBaseUrl={cloudflareWorkerBaseUrl} dissolveFolderInTree={dissolveFolderInTree} />;
    if (section === "lessons") return <AdminLessons config={config} saveConfig={saveConfig} T={T} onBack={() => { setActiveSubSection(null); setSection("main"); }} getSubjectsByGradeBranch={getSubjectsByGradeBranch} />;
    if (section === "quotes") return <AdminQuotes config={config} saveConfig={saveConfig} T={T} onBack={() => { setActiveSubSection(null); setSection("main"); }} />;
    if (section === "foundation") return <AdminFoundation config={config} saveConfig={saveConfig} T={T} onBack={() => { setActiveSubSection(null); setSection("main"); }} normalizeFoundKey={normalizeFoundKey} validateRequiredFields={validateRequiredFields} normalizeDriveFolderInput={normalizeDriveFolderInput} extractDriveFolderId={extractDriveFolderId} cloudflareWorkerBaseUrl={cloudflareWorkerBaseUrl} addFolderToTree={addFolderToTree} dissolveFolderInTree={dissolveFolderInTree} />;
    if (section === "news") return <AdminNews config={config} saveConfig={saveConfig} T={T} onBack={() => { setActiveSubSection(null); setSection("main"); }} getNews={getNews} addNewsItem={addNewsItem} deleteNewsItem={deleteNewsItem} normalizeNewsItem={normalizeNewsItem} formatNewsDate={formatNewsDate} />;
    if (section === "announcements") return <AdminAnnouncements config={config} saveConfig={saveConfig} T={T} onBack={() => { setActiveSubSection(null); setSection("main"); }} fbGet={fbGet} fbAdd={fbAdd} fbDelete={fbDelete} sendLocalNotification={sendLocalNotification} />;
    if (section === "nav") return <AdminNav config={config} saveConfig={saveConfig} T={T} onBack={() => { setActiveSubSection(null); setSection("main"); }} />;
    if (section === "contact") return <AdminContact config={config} saveConfig={saveConfig} T={T} onBack={() => { setActiveSubSection(null); setSection("main"); }} />;
    if (section === "password") return <AdminPassword config={config} saveConfig={saveConfig} T={T} onBack={() => { setActiveSubSection(null); setSection("main"); }} role={role} />;
    if (section === "editors") return <AdminEditors config={config} saveConfig={saveConfig} T={T} onBack={() => { setActiveSubSection(null); setSection("main"); }} role={role} />;
  }

  return (
    <div className="app-shell" style={{ minHeight: "100vh", fontFamily: "'Cairo',sans-serif", direction: "rtl", paddingBottom: "30px" }}>
      <div style={{ background: T.card, backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.cardBorder}`, padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={handlePanelBack} style={{ background: "transparent", border: "none", color: T.accent, fontSize: "15px", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>← خروج</button>
        <div>
          <h2 style={{ margin: 0, color: T.accent, fontSize: "20px", fontWeight: "800" }}>🛡️ لوحة الإدارة</h2>
          <p style={{ margin: 0, fontSize: "12px", color: T.subtext }}>سواعد الخير</p>
        </div>
      </div>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {safeMainMenuSections.map(s => (
          <button key={s.id} onClick={() => { setActiveSubSection(null); setSection(s.id); }} style={{ background: T.card, border: `1px solid ${s.id === "password" ? T.danger + "44" : T.cardBorder}`, borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", backdropFilter: "blur(10px)", textAlign: "right" }}>
            <span style={{ fontSize: "26px" }}>{s.icon}</span>
            <span style={{ fontSize: "15px", fontWeight: "600", color: s.id === "password" ? T.danger : T.text, flex: 1 }}>{s.label}</span>
            <span style={{ color: T.subtext }}>‹</span>
          </button>
        ))}
      </div>
    </div>
  );
}
