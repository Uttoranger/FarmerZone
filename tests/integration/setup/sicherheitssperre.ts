/**
 * Die Sicherheitssperre der Integrationsschicht.
 *
 * WARUM SIE EXISTIERT: Die Tests in `tests/integration/` legen Daten an, ändern
 * sie und löschen sie wieder. Läuft ein solcher Lauf gegen die falsche
 * Datenbank, sind echte Bestellungen weg. Eine Umgebungsvariable, die man
 * vergisst umzustellen, reicht dafür.
 *
 * DESHALB, in dieser Reihenfolge:
 *  1. `TEST_DATABASE_URL` muss gesetzt sein. Fehlt sie, wird abgebrochen —
 *     NICHT still übersprungen. Eine grüne Suite, die nichts getan hat, ist
 *     schlimmer als eine rote.
 *  2. Zeigt sie auf die Produktions- oder die Dev-Datenbank, wird abgebrochen
 *     und beim Namen genannt, worauf sie zeigte.
 *  3. Sonst muss der Host lokal sein (`istTestDatenbank` in src/lib/umgebung.ts).
 *
 * Reine Funktion mit eigenem Unit-Test (`tests/sicherheitssperre.test.ts`), der
 * in der schnellen Suite mitläuft: Die Sperre selbst braucht keine Datenbank,
 * um beweisbar zu sein.
 *
 * SICHERHEIT: In keiner Meldung steht die Verbindungsadresse — sie enthält das
 * Passwort. Nur der Host, über `datenbankHost`.
 *
 * Relative Importe, kein `@/`-Alias: Diese Datei wird aus
 * `vitest.integration.config.ts` geladen, und beim Laden einer Vite-Konfiguration
 * gilt deren eigener Alias noch nicht.
 */
import { datenbankHost, erkannteFernDatenbank, istTestDatenbank } from '../../../src/lib/umgebung'

const HINWEIS =
  'Lege .env.test an (Vorlage: .env.test.example) und setze TEST_DATABASE_URL auf eine eigene lokale Postgres-Datenbank.'

/** Die Prüfung. `null` heißt in Ordnung, sonst steht hier die Abbruchmeldung. */
export function pruefeTestDatenbank(url: string | undefined): string | null {
  if (!url || !url.trim()) {
    return `TEST_DATABASE_URL ist nicht gesetzt. ${HINWEIS}`
  }

  const fern = erkannteFernDatenbank(url)
  if (fern === 'produktion') {
    return (
      'TEST_DATABASE_URL zeigt auf die PRODUKTIONS-Datenbank. ' +
      'Die Integrationstests legen an, ändern und löschen — das hätte echte Bestellungen getroffen. ' +
      HINWEIS
    )
  }
  if (fern === 'dev') {
    return (
      'TEST_DATABASE_URL zeigt auf die DEV-Datenbank. ' +
      'Auch dort wird gelöscht; die Integrationstests brauchen eine eigene lokale Datenbank. ' +
      HINWEIS
    )
  }

  if (!istTestDatenbank(url)) {
    return (
      `TEST_DATABASE_URL zeigt auf den Host ${datenbankHost(url)}. ` +
      'Erlaubt sind nur localhost, 127.0.0.1 und postgres. ' +
      HINWEIS
    )
  }

  return null
}

/**
 * Wie `pruefeTestDatenbank`, nur dass sie abbricht statt zu berichten.
 * Gibt die geprüfte Adresse zurück, damit der Aufrufer sie weiterverwenden
 * kann, ohne `process.env` ein zweites Mal ungeprüft zu lesen.
 */
export function verlangeTestDatenbank(url: string | undefined): string {
  const fehler = pruefeTestDatenbank(url)
  if (fehler) {
    throw new Error(`Integrationstests abgebrochen — ${fehler}`)
  }
  return url!.trim()
}
