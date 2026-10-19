/**
 * Datums-Regeln in ESLint (CODING_STANDARDS „Tage und Wochen", eslint.config.mjs).
 *
 * Ursache: Der Tag und die Woche eines Hofs sind die Wiener; Vercel rechnet in UTC, ein
 * `setHours(0, 0, 0, 0)` oder `getHours()` auf dem Server stellt den Hof um 0:30 Uhr ins Gestern.
 * Die Verbotsliste stand nur im Text und wurde punktuell geprüft (`tests/heute.test.ts`).
 *
 * Beweist (ESLint-Programmierschnittstelle auf Text-Attrappen, kein Netz): Die Selektoren im
 * `no-restricted-syntax`-Block für `src/**` schlagen an bei `setHours(0 …)`, `getHours()`, `startOfWeek`
 * (Aufruf und Import) und jeder Datumsausgabe ohne `timeZone`: `toLocaleDateString`, `toLocaleTimeString`
 * und `toLocaleString` bei Datumswerten (Empfänger `new Date(…)` oder Optionen mit `day`, `month`, `weekday`,
 * `hour`, `minute` …). Der Wiener Weg, `setHours` mit anderem Wert, `toLocaleDateString` mit `timeZone` und
 * `toLocaleString` für Zahlen schlagen nicht an. Seit Nr. 118 gibt es keinen Bestand mehr
 * (`DATUM_ORT_BESTAND` ist leer), und die Dateien, die davor ausgenommen waren, bleiben ohne Treffer.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'
import { DATUM_ORT_BESTAND } from '../eslint.config.mjs'

const WURZEL = process.cwd()
const PROBE = 'src/lib/datums-probe.ts'
const DATUM = /Wiener/
const DATEIEN_NACH_NR_118 = [
  'src/app/(farmer)/orders/[orderId]/print/page.tsx',
  'src/app/(farmer)/orders/today/print/page.tsx',
  'src/lib/order-groups.ts',
  'src/lib/whatsapp.ts',
  'src/lib/email.ts',
  'src/app/api/test-email/route.ts',
]
// Dateien mit toLocaleString für Zahlen: Die Regel darf sie nicht treffen.
const ZAHLEN_DATEIEN = ['src/schemas/produktfamilie.ts', 'src/schemas/vorrat.ts', 'src/lib/admin-hoefe.ts', 'src/lib/servicegebuehr.ts']
const ORT = /braucht timeZone: 'Europe\/Vienna'/

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

  it('toLocaleTimeString ohne timeZone ist verboten', async () => {
    for (const code of ["export const a = d.toLocaleTimeString('de-AT')", "export const a = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })"]) {
      expect(await meldungen(code), code).toEqual([expect.stringMatching(ORT)])
    }
  }, 30_000)

  it('toLocaleString ist bei Datumswerten ohne timeZone verboten — am Empfänger new Date(…) und an den Optionen', async () => {
    for (const code of [
      "export const a = new Date().toLocaleString('de-AT')",
      "export const a = new Date(x).toLocaleString('de-AT', opts)",
      "export const a = m.createdAt.toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })",
      "export const a = d.toLocaleString('de-AT', { weekday: 'long' })",
      "export const a = d.toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short' })",
    ]) {
      expect(await meldungen(code), code).toEqual([expect.stringMatching(ORT)])
    }
  }, 30_000)

  it('toLocaleString ohne Optionen schlägt auch an, wenn der Name des Empfängers ein Datum sagt (Prüfung Runde 1)', async () => {
    // Ohne Typen sieht die Regel einen Wert vom Typ Date nur am Namen: …At, …Date, …Datum, …Zeit, date, datum, jetzt, heute.
    for (const code of [
      "export const a = m.createdAt.toLocaleString('de-AT')",
      "export const a = m?.updatedAt.toLocaleString('de-AT')",
      "export const a = createdAt.toLocaleString('de-AT')",
      "export const a = hof.startDatum.toLocaleString()",
      "export const a = abholung.ankunftZeit.toLocaleString('de-AT')",
      "export const a = sale.endDate.toLocaleString('de-AT')",
      "export const a = date.toLocaleString('de-AT')",
      "export const a = heute.toLocaleString('de-AT')",
    ]) {
      expect(await meldungen(code), code).toEqual([expect.stringMatching(ORT)])
    }
  }, 30_000)

  it('der Name am Empfänger bleibt folgenlos, wenn timeZone da ist oder der Wert keine Datumsendung trägt', async () => {
    for (const code of [
      "export const a = m.createdAt.toLocaleString('de-AT', { timeZone: 'Europe/Vienna' })",
      "export const a = createdAt.toLocaleString('de-AT', { timeZone: 'Europe/Vienna' })",
      "export const a = hof.menge.toLocaleString('de-AT')",
      "export const a = bestellung.summe.toLocaleString('de-AT')",
      "export const a = datenmenge.toLocaleString('de-AT')",
      "export const a = kosten.atlas.toLocaleString('de-AT')",
    ]) {
      expect(await meldungen(code), code).toEqual([])
    }
  }, 30_000)

  it('toLocaleString für Zahlen bleibt erlaubt (Tausenderpunkt, Prozent, Euro)', async () => {
    // Die Stellen, die es im Bestand gibt: schemas/produktfamilie.ts, schemas/vorrat.ts, admin-hoefe.ts, servicegebuehr.ts.
    for (const code of [
      "export const a = VORRAT_MAX.toLocaleString('de-AT')",
      "export const a = prozent.toLocaleString('de-AT', { maximumFractionDigits: 2 })",
      "export const a = (cents / 100).toLocaleString('de-AT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })",
      "export const a = nummer.toLocaleString('de-AT', { useGrouping: true })",
    ]) {
      expect(await meldungen(code), code).toEqual([])
    }
  }, 30_000)

  it('lässt den Wiener Weg und harmlose Aufrufe stehen', async () => {
    for (const code of [
      'const d = new Date()\nd.setHours(12, 0, 0, 0)',
      "export const a = d.toLocaleDateString('de-AT', { day: '2-digit', timeZone: 'Europe/Vienna' })",
      "export const a = d.toLocaleDateString('de-AT', { timeZone: 'Europe/Vienna', weekday: 'long' })",
      "export const a = new Date().toLocaleString('de-AT', { timeZone: 'Europe/Vienna' })",
      "export const a = d.toLocaleString('de-AT', { day: '2-digit', hour: '2-digit', timeZone: 'Europe/Vienna' })",
      "export const a = d.toLocaleTimeString('de-AT', { hour: '2-digit', timeZone: 'Europe/Vienna' })",
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

describe('Datums-Regeln — kein Bestand mehr (Nr. 118)', () => {
  it('die Liste der Ausnahmen ist leer', () => {
    expect(DATUM_ORT_BESTAND).toEqual([])
  })

  it('die Dateien, die davor ausgenommen oder zuletzt umgestellt wurden, haben keinen Treffer', async () => {
    // Echte Dateien an ihrem Platz: Der Test fällt auf, wenn jemand die Zeitzone wieder herausnimmt.
    for (const datei of DATEIEN_NACH_NR_118) {
      const quelle = readFileSync(join(WURZEL, datei), 'utf8')
      expect((await meldungen(quelle, datei)).filter((m) => ORT.test(m)), datei).toEqual([])
    }
  }, 60_000)

  it('die Zahlen-Formatierungen in den vier echten Dateien bleiben erlaubt (kein Befund der Datumsregel)', async () => {
    // Nicht nachgebaut, sondern die Dateien selbst: produktfamilie/vorrat (VORRAT_MAX), admin-hoefe (Prozent),
    // servicegebuehr (Prozent, Cent). Die Schnipsel oben beweisen die Selektoren, diese Dateien den Bestand.
    for (const datei of ZAHLEN_DATEIEN) {
      const quelle = readFileSync(join(WURZEL, datei), 'utf8')
      expect(quelle, datei).toMatch(/\.toLocaleString\(/)
      expect((await meldungen(quelle, datei)).filter((m) => ORT.test(m)), datei).toEqual([])
    }
  }, 60_000)

  it('Gegenprobe: dieselbe Datei ohne timeZone schlägt an', async () => {
    const quelle = readFileSync(join(WURZEL, 'src/lib/whatsapp.ts'), 'utf8')
    const ohne = quelle.replace("timeZone: 'Europe/Vienna'", "locale: 'de-AT'")
    expect(ohne).not.toEqual(quelle)
    expect((await meldungen(ohne, 'src/lib/whatsapp.ts')).filter((m) => ORT.test(m))).toHaveLength(1)
  }, 30_000)

  it('der Bestand der Farbliterale trägt die Datumsregeln weiter', async () => {
    expect(await meldungen('new Date().getHours()', 'src/lib/meldung.ts')).toEqual([expect.stringMatching(DATUM)])
    expect(await meldungen("export const farbe = '#ffffff'", 'src/lib/meldung.ts')).toEqual([])
  }, 30_000)
})
