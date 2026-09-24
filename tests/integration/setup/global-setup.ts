/**
 * Einmal je Integrationslauf: Schema auf den Stand bringen, dann Grunddaten
 * einspielen.
 *
 * `migrate deploy`, nicht `db push`: Die Integrationstests sollen gegen genau
 * das Schema laufen, das auch deployt wird — inklusive der SQL, die keine
 * Entsprechung in schema.prisma hat (RLS). Ein `db push` würde die Migrationen
 * überspringen und damit die eine Frage nicht beantworten, für die die Schicht
 * gebaut ist: Hält es in der echten Datenbank?
 *
 * Der Seed liefert Grunddaten, die die Tests LESEN. Geschrieben wird
 * ausschließlich auf eigenen Objekten mit `int-`-Präfix (siehe basis.ts).
 */
import { execFileSync } from 'node:child_process'
import { INTEGRATIONS_ENV } from './integrations-umgebung'
import { verlangeTestDatenbank } from './sicherheitssperre'

export default function setup(): void {
  // Zweite Prüfung, obwohl die Konfiguration schon geprüft hat: Dieses Setup
  // startet Kindprozesse, die selbst schreiben. Die Sperre gehört unmittelbar
  // davor, nicht „irgendwo vorher".
  const datenbankUrl = verlangeTestDatenbank(process.env.TEST_DATABASE_URL)

  const umgebung: NodeJS.ProcessEnv = {
    ...process.env,
    ...INTEGRATIONS_ENV,
    DATABASE_URL: datenbankUrl,
    // prisma.config.ts nimmt für Migrationen DIRECT_URL vor DATABASE_URL.
    // Lokal gibt es keinen Pooler — beides ist dieselbe Adresse.
    DIRECT_URL: datenbankUrl,
  }

  const lauf = (args: string[]) =>
    execFileSync('pnpm', args, { cwd: process.cwd(), env: umgebung, stdio: 'inherit' })

  lauf(['exec', 'prisma', 'migrate', 'deploy'])
  lauf(['exec', 'tsx', 'prisma/seed.ts'])
}
