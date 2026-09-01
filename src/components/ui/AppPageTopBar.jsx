import React from "react";
import QuoteBanner from "./QuoteBanner.jsx";

export default function AppPageTopBar({ TimerMiniWidget, showTimerModal, setShowTimerModal, StudyTimer, T, quote, darkMode }) {
  return (
    <>
      <TimerMiniWidget T={T} onOpen={() => setShowTimerModal(true)} />
      {showTimerModal && <StudyTimer T={T} onClose={() => setShowTimerModal(false)} />}
      <QuoteBanner quote={quote} T={T} darkMode={darkMode} />
    </>
  );
}
