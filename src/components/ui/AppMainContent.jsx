import React from "react";
import HomePage from "../pages/HomePage.jsx";
import FoundationSubjectPage from "../pages/FoundationSubjectPage.jsx";
import SavedPage from "../pages/SavedPage.jsx";
import SettingsPage from "../pages/SettingsPage.jsx";
import CustomPage from "../pages/CustomPage.jsx";
import ExtractedFoundationPage from "../pages/FoundationPage.jsx";
import ExtractedNewsPage from "../pages/NewsPage.jsx";
import StorageManagerPage from "../pages/StorageManagerPage.jsx";

export default function AppMainContent({
  activePage,
  config,
  T,
  darkMode,
  currentUser,
  flame,
  openSubject,
  openFound,
  openNews,
  saveConfig,
  updateUser,
  getNews,
  getCanonicalSubjectKey,
  getSubjectsByGradeBranch,
  EMOJI,
  setDarkMode,
  oledModeEnabled,
  setOledModeEnabled,
  logout,
  onOpenAdmin,
  showTimerModal,
  setShowTimerModal,
  setActivePage,
  openAdminPanel,
  idbGetAllFiles,
  idbDeleteFile,
  formatSize,
  requestFCMToken,
  ls,
  lsSet,
}) {
  return (
    <>
      {activePage === "home" && <HomePage config={config} T={T} darkMode={darkMode} currentUser={currentUser} flame={flame} onSubject={openSubject} getCanonicalSubjectKey={getCanonicalSubjectKey} getSubjectsByGradeBranch={getSubjectsByGradeBranch} EMOJI={EMOJI} />}
      {activePage === "foundation" && <ExtractedFoundationPage config={config} T={T} onSubject={openFound} EMOJI={EMOJI} />}
      {activePage === "news" && <ExtractedNewsPage config={config} saveConfig={saveConfig} T={T} currentUser={currentUser} updateUser={updateUser} onDetail={openNews} getNews={getNews} />}
      {activePage === "saved" && <SavedPage config={config} T={T} currentUser={currentUser} updateUser={updateUser} idbGetAllFiles={idbGetAllFiles} idbDeleteFile={idbDeleteFile} formatSize={formatSize} />}
      {activePage === "settings" && <SettingsPage config={config} T={T} darkMode={darkMode} setDarkMode={v => { setDarkMode(v); lsSet("sawaed_dark", v); }} oledModeEnabled={oledModeEnabled} setOledModeEnabled={setOledModeEnabled} currentUser={currentUser} updateUser={updateUser} logout={logout} onOpenAdmin={openAdminPanel} onOpenTimer={() => setShowTimerModal(true)} ls={ls} lsSet={lsSet} requestFCMToken={requestFCMToken || (() => Promise.resolve(null))} />}
      {activePage === "storage" && <StorageManagerPage T={T} />}
      {!['home', 'foundation', 'news', 'saved', 'settings', 'storage'].includes(activePage) && <CustomPage page={config.navPages?.find(p => p.id === activePage)} T={T} />}
    </>
  );
}
