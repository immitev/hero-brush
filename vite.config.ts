import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Hero Brush',
        short_name: 'Hero Brush',
        description: 'A 3D superhero toothbrushing game for kids. Brush for two minutes, beat the Cavity King!',
        theme_color: '#1b1340',
        background_color: '#1b1340',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // voice/: build-time neural TTS lines + their manifest (scripts/gen-voices.mjs)
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,webmanifest}', 'voice/**/*.{mp3,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
