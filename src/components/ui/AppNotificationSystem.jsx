import NotificationPromptModal from "./NotificationPromptModal.jsx";
import NotificationToast from "./NotificationToast.jsx";
import AppUpdateBanner from "./AppUpdateBanner.jsx";

export default function AppNotificationSystem({ showNotificationPrompt, dismissNotificationPrompt, requestNotifications, notificationToast, setNotificationToast, showUpdateBanner, handleAppUpdate, T }) {
  return (
    <>
      <NotificationPromptModal open={showNotificationPrompt} onDismiss={dismissNotificationPrompt} onEnable={requestNotifications} T={T} />
      <NotificationToast toast={notificationToast} onClose={() => setNotificationToast?.(null)} />
      <AppUpdateBanner visible={showUpdateBanner} onUpdate={handleAppUpdate} />
    </>
  );
}
