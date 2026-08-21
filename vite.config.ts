import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Content-Security-Policy injectée UNIQUEMENT au build de prod (via <meta>), pour
// durcir l'app sans casser le HMR du serveur de dev. Politique : tout en 'self',
// seul l'API GitHub est autorisée en connexion sortante ; 'unsafe-inline' limité aux
// styles (attributs style de React/recharts) — jamais pour les scripts.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.github.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

const cspPlugin: Plugin = {
  name: 'cap80-csp-meta',
  apply: 'build',
  transformIndexHtml() {
    return [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend',
      },
    ]
  },
}

// GitHub Pages sert le dépôt public Cap80-app sous /Cap80-app/ (§2.1). Sans ce base
// path, le SW, le manifest et les assets sont demandés à la racine → 404 et PWA non
// installable.
const BASE = '/Cap80-app/'

// §7.8 : afficher version + hash du commit déployé dans les réglages.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const commitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
})()

// https://vite.dev/config/
export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  build: {
    rollupOptions: {
      output: {
        // Isole les grosses dépendances dans leurs propres chunks (cache + parse).
        manualChunks: {
          recharts: ['recharts'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  plugins: [
    react(),
    cspPlugin,
    VitePWA({
      // §10 : on propose « nouvelle version, recharger » plutôt qu'un reload forcé.
      registerType: 'prompt',
      // Icônes et fichiers statiques à précacher en plus du bundle.
      includeAssets: [
        'favicon-48.png',
        'logo-cap80.png',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-192.png',
        'icon-maskable-512.png',
      ],
      manifest: {
        name: 'Cap80 — programme de perte de poids',
        short_name: 'Cap80',
        description:
          'Suivi hors-ligne du poids, des mensurations, des séances, des repas et du programme.',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#059669',
        background_color: '#fafaf9',
        // §2.1 : scope et start_url doivent pointer sous le base path.
        scope: BASE,
        start_url: BASE,
        // §10 : sinon Chrome propose une app du Play Store au lieu de la PWA.
        prefer_related_applications: false,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // §7.9 / §10 : raccourci pour noter une envie en un tap depuis l'icône (appui long).
        shortcuts: [
          {
            name: 'Noter une envie',
            short_name: 'Envie',
            url: `${BASE}#/envie`,
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        // §2.1 : fallback de navigation vers l'index sous le base path.
        navigateFallback: `${BASE}index.html`,
        // Précache le shell applicatif + les catalogues JSON embarqués.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webmanifest}'],
        runtimeCaching: [
          {
            // §10 : ne JAMAIS mettre en cache l'API GitHub (données + sha).
            urlPattern: /^https:\/\/api\.github\.com\/.*/i,
            handler: 'NetworkOnly',
            method: 'GET',
          },
        ],
        // Nettoie les anciens précaches à chaque activation.
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Le SW n'est pas activé en dev par défaut ; on le teste sur le build (preview).
        enabled: false,
      },
    }),
  ],
})
