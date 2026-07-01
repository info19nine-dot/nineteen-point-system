import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'node:fs'

type BuildMode = 'member' | 'staff'

function getBuildMode(): BuildMode {
  return process.env.VITE_APP_MODE === 'staff' ? 'staff' : 'member'
}

function htmlTransformPlugin(mode: BuildMode): Plugin {
  const isStaff = mode === 'staff'
  const iconBase = `/icons/${mode}`
  const themeColor = isStaff ? '#ffffff' : '#000000'
  const title = isStaff ? 'NINE-TEEN Staff' : 'NINE-TEEN'

  return {
    name: 'html-transform',
    transformIndexHtml(html) {
      return html
        .replace(/__APP_TITLE__/g, title)
        .replace(/__THEME_COLOR__/g, themeColor)
        .replace(/__APPLE_ICON__/g, `${iconBase}/apple-touch-icon.png`)
        .replace(/__FAVICON__/g, `${iconBase}/pwa-192x192.png`)
    },
  }
}

export default defineConfig(() => {
  const mode = getBuildMode()
  const isStaff = mode === 'staff'
  const iconBase = `icons/${mode}`
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now()}`

  return {
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
    },
    plugins: [
      react(),
      htmlTransformPlugin(mode),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          `${iconBase}/apple-touch-icon.png`,
          `${iconBase}/pwa-192x192.png`,
          `${iconBase}/pwa-512x512.png`,
        ],
        manifest: {
          id: isStaff ? '/staff-pwa' : '/member-pwa',
          name: isStaff ? 'NINE-TEEN Staff' : 'NINE-TEEN',
          short_name: isStaff ? 'N19 Staff' : 'NINE-TEEN',
          description: isStaff
            ? 'NINE-TEEN スタッフ用アプリ'
            : 'NINE-TEEN ポイントカードアプリ',
          theme_color: isStaff ? '#ffffff' : '#000000',
          background_color: isStaff ? '#ffffff' : '#000000',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: isStaff ? '/portal/staff' : '/login',
          lang: 'ja',
          icons: [
            {
              src: `/${iconBase}/pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `/${iconBase}/pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `/${iconBase}/pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
          navigateFallback: '/index.html',
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages',
                expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 },
              },
            },
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
      {
        name: 'spa-fallback',
        closeBundle() {
          const dist = path.resolve(__dirname, 'dist')
          fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'))
          fs.writeFileSync(
            path.join(dist, 'version.json'),
            JSON.stringify({ buildId }),
          )
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
