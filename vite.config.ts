/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Veil — share the document, not your identity',
        short_name: 'Veil',
        description: 'On-device redaction for Indian IDs, purpose-stamped copies and a reversible privacy shield for AI prompts.',
        theme_color: '#16140f',
        background_color: '#f3f0e8',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        share_target: undefined,
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
        globIgnores: ['**/samples/**', '**/og.png', '**/tesseract/**', '**/ner.worker*.js', '**/ort*.wasm'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // OCR engine + language data, samples and the lazily loaded AI worker
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/(tesseract|samples)\/|ner\.worker|\.wasm$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'veil-engines', expiration: { maxEntries: 40 } },
          },
          {
            // onnxruntime + model weights, fetched only if on-device AI is switched on
            urlPattern: ({ url }) => /huggingface\.co|hf\.co|cdn\.jsdelivr\.net/.test(url.hostname),
            handler: 'CacheFirst',
            options: { cacheName: 'veil-ai', expiration: { maxEntries: 60 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
