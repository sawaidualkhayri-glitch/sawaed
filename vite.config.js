import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline', // إدراج كود التشغيل تلقائياً لحل مشكلة التجميع
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,pdf}'], 
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, 
        navigateFallbackDenylist: [/^\/pdf\.worker\.min\.js$/],
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
