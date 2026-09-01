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
