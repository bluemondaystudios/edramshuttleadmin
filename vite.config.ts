import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'EDRAM Admin',
        short_name: 'EDRAM',
        description: 'Invoices, payments and expenses for EDRAM Shuttle and Tours',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0b0b',
        theme_color: '#0b0b0b',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. Data always comes from Supabase over the network.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Only the Latin font files: the browser fetches other scripts on demand if ever needed.
        globIgnores: [
          '**/montserrat-{cyrillic,cyrillic-ext,vietnamese}-*',
          // jsPDF's optional HTML-rendering helpers: never used by the app
          '**/html2canvas-*',
          '**/purify.es-*',
          '**/index.es-*',
        ],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
