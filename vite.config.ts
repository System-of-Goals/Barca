import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the site under the repository name.
const base = '/Barca/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered in src/main.tsx
      includeAssets: ['icons/crest.svg'],
      manifest: {
        name: 'ברצלונה',
        short_name: 'ברצלונה',
        description: 'אתר מעריצים אישי ולא רשמי על FC ברצלונה',
        lang: 'he',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0A1128',
        theme_color: '#0A1128',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Switch to a new version as soon as it is published, instead of on the next visit.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Data files change every 15 minutes: always ask the network first.
        runtimeCaching: [
          { urlPattern: /\/data\/.*\.json$/, handler: 'NetworkFirst', options: { cacheName: 'data', networkTimeoutSeconds: 5 } },
        ],
        globIgnores: ['data/**', 'img/**'],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
});
