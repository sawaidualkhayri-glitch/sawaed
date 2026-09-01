import React from "react";
import NotificationPromptModal from "./NotificationPromptModal.jsx";
import NotificationToast from "./NotificationToast.jsx";
import AppUpdateBanner from "./AppUpdateBanner.jsx";

export default function AppNotificationSystem({ showNotificationPrompt, dismissNotificationPrompt, requestNotifications, notificationToast, showUpdateBanner, handleAppUpdate, T }) {
  return (
    <>
      <NotificationPromptModal open={showNotificationPrompt} onDismiss={dismissNotificationPrompt} onEnable={requestNotifications} T={T} />
      <NotificationToast toast={notificationToast} />
      <AppUpdateBanner visible={showUpdateBanner} onUpdate={handleAppUpdate} />
    </>
  );
}
