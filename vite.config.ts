import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import wasm from 'vite-plugin-wasm'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function sanctuaryBuildId(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12)
  }
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

const sanctuaryBuild = sanctuaryBuildId()

function sanctuaryVersionPlugin(version: string): Plugin {
  const body = JSON.stringify({ version })
  return {
    name: 'sanctuary-build-version',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/version.json') {
          next()
          return
        }
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(body)
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: body,
      })
    },
  }
}

export default defineConfig({
  server: {
    // Phone / LAN testing via `vite --host` + Cloudflare quick tunnels.
    allowedHosts: ['.trycloudflare.com'],
  },
  plugins: [
    react(),
    wasm(),
    sanctuaryVersionPlugin(sanctuaryBuild),
    VitePWA({
      // Prompt so a long-lived home-screen app can ask to refresh instead of
      // silently keeping the previous cached build, or reloading mid-edit.
      registerType: 'prompt',
      devOptions: {
        // Needed so checklist Web Push can subscribe during `npm run dev`.
        enabled: true,
        // Workbox precache globs are empty in the temp `dev-dist` folder.
        suppressWarnings: true,
      },
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-512x512-maskable.png',
        'og-image.jpg',
        'mohsin-project-logo.svg',
        'sanctuary-logo.svg',
        'sanctuary-logo-light.svg',
        'sanctuary-logo-inverted.svg',
        'sanctuary-logo-with-text.svg',
        'sanctuary-logo-with-text-on-right.svg',
        'robots.txt',
        'sitemap.xml',
        'splashes/*.png',
        'push-sw.js',
      ],
      manifest: {
        id: '/',
        name: 'Sanctuary',
        short_name: 'Sanctuary',
        description:
          'Offline-first shelter management for animal rescues. Track animals, care, photos, and money, even without signal.',
        theme_color: '#2F5D3A',
        background_color: '#2F5D3A',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'en',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Checklist Web Push: push + notificationclick live in public/push-sw.js
        importScripts: ['/push-sw.js'],
        // Keep the installable SW lean; wasm loads on demand via runtime cache.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        globIgnores: ['**/landing/**', '**/splashes/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /\/version\.json$/],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/version\.json$/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\.wasm$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sanctuary-wasm',
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
  define: {
    __SANCTUARY_BUILD__: JSON.stringify(sanctuaryBuild),
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@journeyapps/wa-sqlite', '@powersync/web'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
