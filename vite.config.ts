import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// SPA fala com a API no mesmo host. Em dev, proxy de /api pro Express.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Sonify',
        short_name: 'Sonify',
        description: 'Minha biblioteca de música e vídeo',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#08080b',
        theme_color: '#08080b',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Mídia e API nunca entram no precache: só o shell do app.
        navigateFallbackDenylist: [/^\/api/, /^\/covers/],
        runtimeCaching: [
          {
            urlPattern: /^\/covers\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sonify-covers',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    watch: { ignored: ['**/data/**', '**/node_modules/**', '**/dist/**'] },
    proxy: {
      '/api': 'http://localhost:3000',
      '/covers': 'http://localhost:3000',
    },
  },
  build: { outDir: 'dist' },
});
