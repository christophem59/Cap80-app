import { defineConfig } from 'vitest/config'

// Config dédiée aux tests des règles métier (§6) : environnement Node, pas besoin
// du plugin React ni du service worker. Vitest l'utilise en priorité sur vite.config.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
