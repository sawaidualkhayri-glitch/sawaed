/* ==========================================================================
   START SECTION: Application Entry Point & React Root Initialization
   ========================================================================== */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './AuthContext.jsx'

  /* --- START SUBSECTION: React DOM Tree Initialization --- */
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      {/* --- START AUTH CONTEXT PROVIDER --- */}
      <AuthProvider>
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
