import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev
export default defineConfig({
  server: {
    headers: {
      "Content-Security-Policy": "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.googletagmanager.com https://*.firebaseio.com https://apis.google.com https://*.googleapis.com; script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.googletagmanager.com https://*.firebaseio.com https://apis.google.com https://*.googleapis.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' blob: https://*.workers.dev https://sawaed.hamodemsg.workers.dev https://*.firebaseio.com wss://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://identitytoolkit.googleapis.com https://drive.google.com; frame-src 'self' https://*.firebaseapp.com https://apis.google.com https://*.google.com; img-src 'self' data: blob: https://*.googleusercontent.com https://www.gstatic.com https:; object-src 'none';"
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline', // إدراج كود التشغيل تلقائياً لحل مشكلة التجميع
      includeAssets: ['pdf.worker.min.js', 'icon-192.png', 'icon-512.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,pdf}'], 
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, 
        navigateFallbackDenylist: [/^\/pdf\.worker\.min\.js$/],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'سواعد الخير التعليمية',
        short_name: 'سواعد',
        description: 'منصة سواعد الخير التعليمية للدروس والتأسيس',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'assets/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'assets/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
