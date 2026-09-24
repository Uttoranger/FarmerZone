import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { INTEGRATIONS_ENV } from './tests/integration/setup/integrations-umgebung'
import { verlangeTestDatenbank } from './tests/integration/setup/sicherheitssperre'

/**
 * Die zweite Testschicht: Server-Handler gegen ein ECHTES Postgres, mit Prüfung
 * des Zustands danach. Die schnelle Suite (`vitest.config.ts`) bleibt, wie sie
 * ist — sie beantwortet Regelfragen in Millisekunden, diese Schicht die Frage,
 * ob die Datenbank wirklich tut, was der Code annimmt.
 *
 * DIE SPERRE LÄUFT HIER, beim Laden der Konfiguration — also bevor Vitest eine
 * Testdatei anfasst und damit bevor src/lib/prisma.ts seine Verbindung baut.
 * Der Client liest `env.DATABASE_URL` genau EINMAL, beim ersten Import
 * (src/lib/prisma.ts): danach ist die Adresse nicht mehr zu ändern.
 */
const datenbankUrl = verlangeTestDatenbank(process.env.TEST_DATABASE_URL)

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.int.test.ts'],
    // Eine Datei zur Zeit. Die Tests prüfen Bestand und Geld an gemeinsamen
    // Zeilen; parallele Dateien würden sich die Aufräumarbeit gegenseitig
    // wegziehen. Nebenläufigkeit wird INNERHALB eines Tests hergestellt
    // (zwei gleichzeitige Aufrufe), nicht zwischen Dateien.
    fileParallelism: false,
    // Migration, Seed und echte Abfragen brauchen mehr als die fünf Sekunden
    // der schnellen Suite.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globalSetup: ['./tests/integration/setup/global-setup.ts'],
    env: {
      ...INTEGRATIONS_ENV,
      // Die geprüfte Adresse wird zur Adresse des Prisma-Clients. Über `env`
      // und nicht über einen Import, damit sie steht, bevor irgendein Modul
      // lädt — derselbe Weg, den die schnelle Suite für BETTER_AUTH_SECRET
      // nimmt.
      DATABASE_URL: datenbankUrl,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
})
