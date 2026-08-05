import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Die Token-Module beziehen BETTER_AUTH_SECRET aus dem env-Modul, das im
    // Test-Modus bewusst nicht validiert. Ohne einen Wert hier hätten sie
    // nichts zum Signieren. Der Wert ist beliebig: die Token-Tests erzeugen
    // und prüfen im selben Lauf, sie hängen an keiner festen Signatur.
    env: { BETTER_AUTH_SECRET: 'vitest-secret-nicht-fuer-produktion' },
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
})
