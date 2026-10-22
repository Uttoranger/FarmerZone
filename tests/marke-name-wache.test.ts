/**
 * Name und Domain an je EINER Stelle (Register M1, Nr. 91).
 *
 * Ursache: Der Name der Plattform stand 143-mal als Literal in 88 Dateien unter
 * src/, die Domain fest in fünf Dateien — ein Namenswechsel hieß, jede Stelle
 * einzeln zu finden. Seit M1 steht der Name nur in src/lib/marke.ts (MARKE,
 * MARKE_TEAM) und die Domain nur in src/lib/umgebung.ts (PRODUKTION_HOST).
 *
 * Beweist für src/, tests/ und die Textdateien in public/ — Kommentare
 * eingeschlossen, damit sie bei einem weiteren Wechsel nicht veralten:
 *  - Der alte Name steht nirgends mehr, außer an den Stellen der Ausnahmeliste
 *    (je Datei wörtlich, mit Grund). Eine neue Stelle in einer Ausnahmedatei
 *    schlägt trotzdem an, und eine Ausnahme ohne Treffer auch.
 *  - Der Name steht nur in src/lib/marke.ts; alle anderen importieren MARKE.
 *    Ausnahme wie beim alten Name nur über die Liste (seit Nr. 114: der feste
 *    Cookie-Name der Geräte-Kennung).
 *  - Die Domain steht unter src/ und public/ nur in src/lib/umgebung.ts. Tests
 *    dürfen sie als Beispieladresse nennen: Dort ist sie Prüfwert, und die
 *    Erwartung soll die echte Domain zeigen, nicht die Konstante gegen sich selbst.
 *
 * Gesucht wird ohne Rücksicht auf Groß- und Kleinschreibung. Name und Domain
 * kommen aus den Konstanten — ein Wechsel zieht diese Wache mit. Diese Datei
 * selbst fehlt in der Suche: Ihre Ausnahmeliste nennt den alten Namen wörtlich.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { MARKE } from '@/lib/marke'
import { PRODUKTION_HOST } from '@/lib/umgebung'

const WURZEL = process.cwd()
const DIESE_DATEI = 'tests/marke-name-wache.test.ts'
const ORDNER = ['src', 'tests', 'public'] as const
const TEXTDATEI = /\.(ts|tsx|js|mjs|cjs|json|css|md|txt|svg|html)$/

function alsMuster(wort: string): RegExp {
  return new RegExp(wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
}

/** Der alte Name, aus Teilen gebaut — nur die Ausnahmeliste unten nennt ihn wörtlich. */
const ALTER_NAME = alsMuster(['farmer', 'zone'].join(''))
const NAME = alsMuster(MARKE)
const DOMAIN = alsMuster(PRODUKTION_HOST)

/** Die eine Stelle für den Namen und die eine für die Domain. */
const NAME_QUELLE = 'src/lib/marke.ts'
const DOMAIN_QUELLE = 'src/lib/umgebung.ts'

type Ausnahme = { stellen: readonly string[]; grund: string }

const SPEICHER = 'technischer Schlüssel im Browser-Speicher — umbenannt verlören Kundinnen und Höfe den gespeicherten Stand'
const NACHRICHT = 'technischer Nachrichtentyp zwischen Fenstern — umbenannt verstünden sich alter und neuer Stand im Deploy-Fenster nicht'
const DATENBANK = 'Name der lokalen Test-Datenbank (technisch, wie .env.test und .github/workflows/ci.yml)'
const REPO = 'Name des Repos auf GitHub — bleibt technischer Name (M1)'
const GERAETE_COOKIE_GRUND =
  'Cookie der Geräte-Kennung (E7, Nr. 114) — fester Name, damit ein Markenwechsel nicht jedes Gerät „neu“ macht und jeder Hof eine Mail „Neue Anmeldung“ bekommt'

/** Wo der alte Name (oder ausnahmsweise der Name) bleiben darf: die Stelle wörtlich, je Datei mit Grund. */
const AUSNAHMEN: Record<string, Ausnahme> = {
  'src/lib/geraete.ts': { stellen: ["'agrilo_geraet'"], grund: GERAETE_COOKIE_GRUND },
  'src/lib/kalender.ts': {
    stellen: ['@farmerzone`'],
    grund: 'UID der Kalendereinträge — ein neuer Suffix legte bereits eingetragene Abholungen doppelt an',
  },
  'src/components/shared/rueckweg-merker.tsx': { stellen: ["'farmerzone:hinauf'"], grund: SPEICHER },
  'src/lib/freischalt-moment.ts': { stellen: ['`farmerzone_freigeschaltet_gezeigt:'], grund: SPEICHER },
  'src/lib/verkaufskanal-speicher.ts': { stellen: ["'farmerzone_verkauf_kanal'"], grund: SPEICHER },
  'src/lib/hofname-entwurf.ts': { stellen: ["'farmerzone_hofname_entwurf'"], grund: SPEICHER },
  'src/lib/wieder-da-moment.ts': { stellen: ['`farmerzone_wieder_da_gezeigt:'], grund: SPEICHER },
  'src/lib/foto-weg-speicher.ts': { stellen: ["'farmerzone_foto_weg'"], grund: SPEICHER },
  'src/lib/gespeichert-moment.ts': { stellen: ['`farmerzone_gespeichert_gezeigt:'], grund: SPEICHER },
  'src/lib/warenkorb-speicher.ts': { stellen: ["'farmerzone:warenkorb'"], grund: NACHRICHT },
  'src/schemas/hofseite-vorschau.ts': {
    stellen: ["'farmerzone:markiere-abschnitt'", "'farmerzone:vorschau-bereit'"],
    grund: NACHRICHT,
  },
  'tests/hofseite-vorschau.test.ts': { stellen: ["startsWith('farmerzone:')"], grund: NACHRICHT },
  'src/lib/anmeldecode.ts': {
    stellen: ["'https://farmerzone.invalid'"],
    grund: 'Platzhalter-Herkunft unter .invalid zum Zerlegen relativer Pfade — nie aufgerufen, nie sichtbar',
  },
  'src/lib/meldung.ts': { stellen: ['github.com/Uttoranger/FarmerZone/pull/'], grund: REPO },
  'tests/meldung.test.ts': { stellen: ['github.com/Uttoranger/FarmerZone/pull/'], grund: REPO },
  'tests/bestellverfolgung.test.ts': {
    stellen: ['@farmerzone'],
    grund: 'UID der Kalendereinträge (src/lib/kalender.ts) — bleibt, siehe dort',
  },
  'tests/stop-hook-zaehler.test.ts': {
    stellen: ['farmerzone-stop-hook'],
    grund: 'Dateiname des Zählers aus .claude/hooks/stop-zaehler.mjs (technisch, nicht Teil von M1)',
  },
  'tests/umgebung.test.ts': {
    stellen: ["'https://farmerzone.at'", "'https://www.farmerzone.at'", "'https://www.farmerzone.at/'", 'farmerzone_test', '5432/farmerzone'],
    grund: 'Gegenprobe zum Cutover: Die alte Domain gilt nicht mehr als echte Herkunft — dazu ' + DATENBANK,
  },
  'tests/sicherheitssperre.test.ts': { stellen: ['farmerzone_test'], grund: DATENBANK },
  'tests/testumgebung-anzeige.test.ts': { stellen: ['5432/farmerzone'], grund: DATENBANK },
}

type Fund = { datei: string; zeile: number; regel: 'alter Name' | 'Name' | 'Domain'; text: string }

function zeileVon(text: string, index: number): number {
  return text.slice(0, index).split('\n').length
}

function funde(text: string, muster: RegExp, datei: string, regel: Fund['regel']): Fund[] {
  return [...text.matchAll(muster)].map((m) => ({ datei, zeile: zeileVon(text, m.index), regel, text: m[0] }))
}

/** Ersetzt jede erlaubte Stelle durch gleich viele Leerzeichen — die Zeilennummern bleiben. */
function ohneStellen(text: string, stellen: readonly string[]): string {
  return stellen.reduce((t, stelle) => t.split(stelle).join(' '.repeat(stelle.length)), text)
}

/** Alle Funde einer Datei; `datei` ist der Pfad ab der Wurzel mit „/". */
function pruefeText(text: string, datei: string, ausnahmen: Record<string, Ausnahme> = AUSNAHMEN): Fund[] {
  const ohneAusnahmen = ohneStellen(text, ausnahmen[datei]?.stellen ?? [])
  const alt = funde(ohneAusnahmen, ALTER_NAME, datei, 'alter Name')
  // Die Domain enthält den Namen; ohne sie bleibt nur, was wirklich der Name ist.
  const ohneDomain = ohneAusnahmen.replace(DOMAIN, (d) => ' '.repeat(d.length))
  const name = datei === NAME_QUELLE ? [] : funde(ohneDomain, NAME, datei, 'Name')
  const domain = datei === DOMAIN_QUELLE || datei.startsWith('tests/') ? [] : funde(text, DOMAIN, datei, 'Domain')
  return [...alt, ...name, ...domain]
}

function* textdateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* textdateien(pfad)
    else if (TEXTDATEI.test(name)) yield pfad
  }
}

function alleDateien(): string[] {
  return ORDNER.flatMap((o) => [...textdateien(join(WURZEL, o))]).map((p) => relative(WURZEL, p).split(sep).join('/'))
}

describe('Marke und Domain an je einer Stelle (M1)', () => {
  it('Gegenprobe: ein eingeschmuggelter alter Name schlägt an — auch klein geschrieben und in einer Ausnahmedatei', () => {
    const alt = ['Farmer', 'Zone'].join('')
    expect(pruefeText(`export const TITEL = 'Start — ${alt}'`, 'src/app/seite.tsx')).toHaveLength(1)
    expect(pruefeText(`// Adresse: ${alt.toLowerCase()}.at/hof`, 'tests/x.test.ts')).toHaveLength(1)
    const ausnahmen = { 'src/lib/x.ts': { stellen: [`'${alt.toLowerCase()}_schluessel'`], grund: 'Probe' } }
    expect(pruefeText(`const a = '${alt.toLowerCase()}_schluessel'`, 'src/lib/x.ts', ausnahmen)).toEqual([])
    expect(pruefeText(`const a = '${alt.toLowerCase()}_schluessel'\nconst b = '${alt}'`, 'src/lib/x.ts', ausnahmen)).toEqual([
      { datei: 'src/lib/x.ts', zeile: 2, regel: 'alter Name', text: alt },
    ])
  })

  it('Gegenprobe: der Name als Literal schlägt außerhalb von marke.ts an, die Domain nur unter src/ außerhalb von umgebung.ts', () => {
    expect(pruefeText(`title: 'Start — ${MARKE}'`, 'src/app/seite.tsx').map((f) => f.regel)).toEqual(['Name'])
    expect(pruefeText(`expect(html).toContain('${MARKE}-Team')`, 'tests/x.test.ts').map((f) => f.regel)).toEqual(['Name'])
    expect(pruefeText(`export const MARKE = '${MARKE}'`, NAME_QUELLE)).toEqual([])
    const adresse = `'support@${PRODUKTION_HOST}'`
    expect(pruefeText(adresse, 'src/lib/support.ts').map((f) => f.regel)).toEqual(['Domain'])
    expect(pruefeText(adresse, DOMAIN_QUELLE)).toEqual([])
    // In Tests ist die Domain Prüfwert — und kein Name.
    expect(pruefeText(`'https://${PRODUKTION_HOST.toUpperCase()}/hof'`, 'tests/x.test.ts')).toEqual([])
    // Eine Stelle der Ausnahmeliste gilt auch für den Namen — nur genau sie.
    const ausnahmen = { 'src/lib/x.ts': { stellen: [`'${MARKE.toLowerCase()}_keks'`], grund: 'Probe' } }
    expect(pruefeText(`const k = '${MARKE.toLowerCase()}_keks'`, 'src/lib/x.ts', ausnahmen)).toEqual([])
    expect(pruefeText(`const k = '${MARKE.toLowerCase()}_keks'\nconst t = '${MARKE}'`, 'src/lib/x.ts', ausnahmen).map((f) => f.zeile)).toEqual([2])
  })

  it('jede Ausnahme nennt einen Grund, und jede erlaubte Stelle steht noch in ihrer Datei', () => {
    const dateien = new Set(alleDateien())
    for (const [datei, { stellen, grund }] of Object.entries(AUSNAHMEN)) {
      expect(dateien.has(datei), datei).toBe(true)
      expect(grund.length, datei).toBeGreaterThan(10)
      const text = readFileSync(join(WURZEL, datei), 'utf8')
      for (const stelle of stellen) expect(text.includes(stelle), `${datei}: ${stelle}`).toBe(true)
    }
  }, 30_000)

  it('in src/, tests/ und public/ steht weder der alte Name noch der Name oder die Domain außerhalb ihrer Stelle', () => {
    const gefunden = alleDateien()
      .filter((datei) => datei !== DIESE_DATEI)
      .flatMap((datei) => pruefeText(readFileSync(join(WURZEL, datei), 'utf8'), datei))
      .map((f) => `${f.datei}:${f.zeile} ${f.regel} „${f.text}"`)
    expect(gefunden).toEqual([])
  }, 30_000)
})
