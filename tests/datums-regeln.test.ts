/**
 * Datums-Regeln in ESLint (CODING_STANDARDS „Tage und Wochen", eslint.config.mjs).
 *
 * Ursache: Der Tag und die Woche eines Hofs sind die Wiener; Vercel rechnet in UTC, ein
 * `setHours(0, 0, 0, 0)` oder `getHours()` auf dem Server stellt den Hof um 0:30 Uhr ins Gestern.
 * Die Verbotsliste stand nur im Text und wurde punktuell geprüft (`tests/heute.test.ts`).
 *
 * Beweist (ESLint-Programmierschnittstelle auf Text-Attrappen, kein Netz): Die Selektoren im
 * `no-restricted-syntax`-Block für `src/**` schlagen an bei `setHours(0 …)`, `getHours()`, `startOfWeek`
 * (Aufruf und Import) und `toLocaleDateString` ohne `timeZone`; der Wiener Weg, `setHours` mit anderem
 * Wert und `toLocaleDateString` mit `timeZone` nicht. Die Dateien, die `toLocaleDateString` noch ohne
 * `timeZone` schreiben (`DATUM_ORT_BESTAND`), sind davon ausgenommen und tragen alle anderen Regeln; die
 * Liste darf nur schrumpfen — eine Datei ohne Treffer fällt hier als veraltet auf. Keine Datei im
 * Repository wird dafür verändert.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'
import { DATUM_ORT_BESTAND } from '../eslint.config.mjs'

const WURZEL = process.cwd()
const PROBE = 'src/lib/datums-probe.ts'
const DATUM = /Wiener/
const ORT = /toLocaleDateString braucht timeZone/

let eslint: ESLint

/** Die Meldungen der Regel `no-restricted-syntax` für einen Text, als läge er unter `datei`. */
async function meldungen(code: string, datei = PROBE): Promise<string[]> {
  const [ergebnis] = await eslint.lintText(code, { filePath: join(WURZEL, datei) })
  return ergebnis.messages.filter((m) => m.ruleId === 'no-restricted-syntax').map((m) => m.message)
}

// ESLint lädt die Next-Konfiguration und den TypeScript-Parser — unter Last länger als das Standardlimit.
beforeAll(() => {
  eslint = new ESLint({ cwd: WURZEL })
}, 30_000)

describe('Datums-Regeln — Gegenprobe: die Selektoren schlagen an', () => {
  it('setHours(0 …) und getHours() sind verboten', async () => {
    for (const code of ['const d = new Date()\nd.setHours(0, 0, 0, 0)', 'const t = new Date(x)\nt.setHours(0)', 'const h = new Date().getHours()']) {
      expect(await meldungen(code), code).toEqual([expect.stringMatching(DATUM)])
    }
  }, 30_000)

  it('startOfWeek ist verboten — als Aufruf und als Import, aus date-fns oder dem Einzelmodul', async () => {
    for (const code of [
      "import { startOfWeek } from 'date-fns'\nexport const a = 1",
      "import { startOfWeek as montag } from 'date-fns'\nexport const a = 1",
      "import startOfWeek from 'date-fns/startOfWeek'\nexport const a = 1",
      'export const a = startOfWeek(new Date())',
      'export const a = fns.startOfWeek(new Date())',
    ]) {
      expect((await meldungen(code)).length, code).toBeGreaterThanOrEqual(1)
    }
  }, 30_000)

  it('toLocaleDateString ohne timeZone ist verboten', async () => {
    for (const code of [
      "export const a = d.toLocaleDateString('de-AT')",
      "export const a = d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric' })",
      "export const a = new Date(x).toLocaleDateString('de-AT', opts)",
    ]) {
      expect(await meldungen(code), code).toEqual([expect.stringMatching(ORT)])
    }
  }, 30_000)

  it('lässt den Wiener Weg und harmlose Aufrufe stehen', async () => {
    for (const code of [
      'const d = new Date()\nd.setHours(12, 0, 0, 0)',
      "export const a = d.toLocaleDateString('de-AT', { day: '2-digit', timeZone: 'Europe/Vienna' })",
      "export const a = d.toLocaleDateString('de-AT', { timeZone: 'Europe/Vienna', weekday: 'long' })",
      "import { startOfMonth } from 'date-fns'\nexport const a = startOfMonth(new Date())",
      "import { wienWochenMontag } from '@/lib/kalender'\nexport const a = wienWochenMontag(new Date())",
    ]) {
      expect(await meldungen(code), code).toEqual([])
    }
  }, 30_000)

  it('gilt nur unter src/ — in tests/ stehen Attrappen und Beweise', async () => {
    expect(await meldungen("export const a = d.toLocaleDateString('de-AT')\nnew Date().getHours()", 'tests/datums-probe.ts')).toEqual([])
  }, 30_000)
})

describe('Datums-Regeln — der Bestand von toLocaleDateString ohne timeZone', () => {
  it('die Liste ist nicht leer und nennt nur Dateien, die es gibt', () => {
    expect(DATUM_ORT_BESTAND.length).toBeGreaterThan(0)
    for (const datei of DATUM_ORT_BESTAND) expect(() => readFileSync(join(WURZEL, datei.replace(/\\/g, '')), 'utf8'), datei).not.toThrow()
  })

  it('jede Datei der Liste hat noch einen Treffer (sonst raus aus der Liste), ist aber ausgenommen und trägt die übrigen Regeln', async () => {
    for (const roh of DATUM_ORT_BESTAND) {
      const datei = roh.replace(/\\/g, '')
      const quelle = readFileSync(join(WURZEL, datei), 'utf8')
      // Als läge sie an neutraler Stelle: Die Ausnahme greift nicht, der Treffer muss da sein.
      const neutral = `src/lib/datums-probe${datei.endsWith('.tsx') ? '.tsx' : '.ts'}`
      expect((await meldungen(quelle, neutral)).filter((m) => ORT.test(m)).length, `${datei} ist veraltet — aus DATUM_ORT_BESTAND nehmen`).toBeGreaterThan(0)
      // An ihrem Platz: ausgenommen von der timeZone-Regel ...
      expect((await meldungen(quelle, datei)).filter((m) => ORT.test(m)), `${datei} ist nicht ausgenommen`).toEqual([])
      // ... aber nicht von den anderen Datums- und Farbregeln.
      expect(await meldungen('new Date().getHours()', datei), datei).toEqual([expect.stringMatching(DATUM)])
      expect(await meldungen("export const farbe = '#ffffff'", datei), datei).toHaveLength(1)
    }
  }, 60_000)

  it('der Bestand der Farbliterale trägt die Datumsregeln weiter', async () => {
    expect(await meldungen('new Date().getHours()', 'src/lib/meldung.ts')).toEqual([expect.stringMatching(DATUM)])
    expect(await meldungen("export const farbe = '#ffffff'", 'src/lib/meldung.ts')).toEqual([])
  }, 30_000)
})
