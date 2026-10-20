import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // PFLICHT, keine Geschmacksfrage: `tests/**/*.test.ts` passt auch auf
    // `tests/integration/*.int.test.ts`. Ohne diesen Ausschluss zöge `pnpm test`
    // — und damit der Stop-Hook — die Integrationstests mit hinein und
    // scheiterte ohne laufendes Postgres. Der Standard-Ausschluss von Vitest
    // wird von `exclude` ersetzt, nicht ergänzt: node_modules muss mit drin
    // stehen bleiben.
    exclude: ['**/node_modules/**', 'tests/integration/**'],
    // Die Token-Module beziehen BETTER_AUTH_SECRET aus dem env-Modul, das im
    // Test-Modus bewusst nicht validiert. Ohne einen Wert hier hätten sie
    // nichts zum Signieren. Der Wert ist beliebig: die Token-Tests erzeugen
    // und prüfen im selben Lauf, sie hängen an keiner festen Signatur.
    env: { BETTER_AUTH_SECRET: 'vitest-secret-nicht-fuer-produktion' },
    // PFLICHT: tests/sharp-lader-sperre.test.ts sperrt die Lader von libvips für
    // den ganzen Prozess (sharp.block). Worker-Threads teilen sich libvips —
    // dann können parallel laufende sharp-Tests wie tests/marke-bilder.test.ts
    // je nach Zeitablauf scheitern (TESTING_GUIDELINES §4).
    // Jede Testdatei braucht deshalb einen eigenen Prozess (Standard von
    // Vitest 4, hier festgehalten, damit niemand ihn für Tempo umstellt).
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
})
