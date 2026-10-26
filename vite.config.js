import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // App instalable que abre sin cobertura: guarda la app y los últimos datos consultados
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // se usa public/manifest.json
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // Lecturas de Supabase: se usan las últimas guardadas si no hay red
            urlPattern: ({ url, request }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Datos de idioma para leer facturas (se descargan la primera vez)
            urlPattern: ({ url }) => url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'tessdata.projectnaptha.com',
            handler: 'CacheFirst',
            options: { cacheName: 'ocr', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
        ],
      },
    }),
  ],
  build: {
    // es2020 en lugar de esnext para no romper iPhones con Safari algo antiguo
    target: 'es2020',
    minify: 'esbuild'
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
