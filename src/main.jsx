/* ==========================================================================
   START SECTION: Application Entry Point & React Root Initialization
   ========================================================================== */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './AuthContext.jsx'
import OfflineSyncBanner from './components/common/OfflineSyncBanner.jsx'

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    return Promise.all(registrations.map((reg) => reg.unregister()));
  }).catch(() => {});
}

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      if (navigator.onLine) {
        registration.update().catch(() => {});
      }

      window.addEventListener('online', () => {
        registration.update().catch(() => {});
      });

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    } catch (error) {
      console.error('[SW] Registration failed:', error);
    }
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

  /* --- START SUBSECTION: React DOM Tree Initialization --- */
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      {/* --- START AUTH CONTEXT PROVIDER --- */}
      <AuthProvider>
        <OfflineSyncBanner />
        {/* --- START MAIN APPLICATION COMPONENT --- */}
        <App />
        {/* --- END MAIN APPLICATION COMPONENT --- */}
      </AuthProvider>
      {/* --- END AUTH CONTEXT PROVIDER --- */}
    </StrictMode>,
  )
  /* --- END SUBSECTION: React DOM Tree Initialization --- */

/* ==========================================================================
   END SECTION: Application Entry Point & React Root Initialization
   ========================================================================== */
