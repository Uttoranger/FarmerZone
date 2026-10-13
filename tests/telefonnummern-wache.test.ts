/**
 * Telefonnummern-Wache (TESTING_GUIDELINES §2, Dirigenten-Vorschlag Lauf 12; gebaut in Nr. 85).
 *
 * Ursache: Das Repository ist öffentlich, und Beispielnummern standen mit echtem Teilnehmerteil
 * in Tests, Kommentaren und DEVELOPMENT.md („+43 660 1234567“) — jede davon kann jemandem gehören.
 * Regel (CLAUDE.md §2, TESTING_GUIDELINES §5): Eine Nummer mit österreichischer oder deutscher
 * Vorwahl hat einen Teilnehmerteil aus Nullen („+43 660 000 0000“); verschiedene Nummern
 * unterscheiden sich in der Vorwahl (660, 664, 676 …), nie in den Ziffern dahinter.
 *
 * Beweist (Dateiarbeit, kein Netz): Keine Datei unter src/, tests/, docs/ und DEVELOPMENT.md
 * enthält eine solche Nummer mit Ziffern 1–9 im Teilnehmerteil — außer den Ausnahmen mit Grund.
 * Jede Ausnahme deckt einen Fund; eine veraltete fällt auf. Gegenprobe: eine eingeschmuggelte
 * Nummer schlägt an, genullte und Nicht-Nummern (Datum, Kennung, Betrag) nicht.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const WURZEL = process.cwd()
const ORTE = ['src', 'tests', 'docs', 'DEVELOPMENT.md']
const TEXTDATEI = /\.(ts|tsx|mjs|cjs|js|json|md|html|css|sql|txt|ya?ml)$/

/**
 * Ein Kandidat beginnt mit einem Ländercode (+43, 0043, +49, 0049, auch „+43 (0) 660 …“) oder mit
 * der Wahl-Null samt Vorwahl („0660“, „(0664)“, „06212“, „01“), nach der Vorwahl höchstens ein Trenner
 * wie „ / “, danach der Teilnehmerteil: Ziffern mit je einem Leerzeichen, Strich oder Punkt dazwischen.
 * Nie mitten in einem Wort oder einer Zahl — auch nicht hinter einem Dezimalpunkt (oklch-Werte) oder
 * „#“ (Farbwert), in einer Kennung („cabo0000…“, „token-0123456789abcdef“), einem Hex-Hash oder
 * hinter einer Uhrzeit mit „+“.
 */
const KANDIDAT = new RegExp(
  [
    String.raw`(?<![\p{L}\p{N}.,_#])(?:\+|00)[ ]?(?:43|49)(?:[ ]?\(0\))?[ \-\/]{0,3}\d{1,5}\)?[ \-\/]{0,3}\d(?:[ \-.]?\d)*(?![\p{L}\p{N}])`,
    String.raw`(?<![\p{L}\p{N}.,_#])\(?0[1-9]\d{0,3}\)?[ \-\/]{0,3}\d(?:[ \-.]?\d)*(?![\p{L}\p{N}])`,
  ].join('|'),
  'gu'
)

/** Österreichische Festnetz-Vorwahlen mit drei Stellen (wie src/lib/telefon-anzeige.ts); Wien hat eine, sonst vier. */
const DREISTELLIGE_ORTE = new Set(['316', '463', '512', '662', '732'])

/** Mehr Ziffern hat keine Nummer ohne Ländercode (E.164: höchstens 15 samt Ländercode). */
const MAX_NATIONAL = 13

/**
 * Der Teilnehmerteil eines Kandidaten — oder null, wenn er keine Nummer ist (zu kurz, nur eine Vorwahl).
 * Österreich: Vorwahl nach denselben Regeln wie die Anzeige; Deutschland: Mobil 15x–17x dreistellig,
 * sonst die erste Gruppe, wie sie geschrieben steht.
 */
function teilnehmerteil(kandidat: string): string | null {
  const ziffern = kandidat.replace(/\D/g, '')
  const gruppen = kandidat.split(/\D+/).filter(Boolean)
  let land: string
  let national: string
  let ersteGruppe: string | undefined
  if (kandidat.startsWith('+') || ziffern.startsWith('00')) {
    const ohneNullen = kandidat.startsWith('+') ? ziffern : ziffern.slice(2)
    land = ohneNullen.slice(0, 2)
    // „+43 (0) 660 …“: Die Wahl-Null gehört nicht zur Nummer.
    national = ohneNullen.slice(2).replace(/^0/, '')
    const nachLand = gruppen.slice(1).filter((g) => g !== '0')
    ersteGruppe = (gruppen[0]?.length ?? 0) > 4 ? undefined : nachLand[0]?.replace(/^0/, '')
  } else {
    land = '43'
    national = ziffern.slice(1)
    ersteGruppe = gruppen[0]?.replace(/^0/, '')
  }
  let vorwahl: number
  if (land === '43') {
    vorwahl = national.startsWith('1') ? 1 : /^6[5-9]/.test(national) || DREISTELLIGE_ORTE.has(national.slice(0, 3)) ? 3 : 4
  } else {
    vorwahl = /^1[5-7]/.test(national) ? 3 : Math.min(ersteGruppe?.length ?? 3, 5)
  }
  // Österreichische Nummern haben 7 bis 13 Ziffern (wie die Anzeige), deutsche mindestens 6 — kürzer ist ein Code, keine Nummer.
  if (land === '43' ? national.length < 7 || national.length > MAX_NATIONAL : national.length < 6) return null
  const teil = national.slice(vorwahl)
  return teil.length >= 3 ? teil : null
}

/**
 * Mehrere Nummern hintereinander („0660 0000000 0660 0000000“, Prüfstoff für ein Feld mit zwei
 * Nummern) sind ein Kandidat mit zu vielen Ziffern: Er wird an jeder Gruppe getrennt, die mit der
 * Wahl-Null neu beginnt, und jede Nummer zählt für sich.
 */
function nummernIn(kandidat: string): string[] {
  const ziffern = kandidat.replace(/\D/g, '')
  if (ziffern.length - 1 <= MAX_NATIONAL || kandidat.startsWith('+')) return [kandidat]
  return kandidat.split(/\s+(?=\(?0[1-9])/)
}

type Fund = { datei: string; zeile: number; nummer: string }

/** Alle Nummern eines Texts, deren Teilnehmerteil nicht nur aus Nullen besteht. */
function findeNummern(text: string, datei = 'schnipsel.md'): Fund[] {
  const funde: Fund[] = []
  text.split('\n').forEach((zeile, i) => {
    for (const treffer of zeile.matchAll(KANDIDAT)) {
      for (const nummer of nummernIn(treffer[0].trim())) {
        const teil = teilnehmerteil(nummer)
        if (teil !== null && !/^0+$/.test(teil)) funde.push({ datei, zeile: i + 1, nummer })
      }
    }
  })
  return funde
}

/**
 * Ausnahmen — je mit Grund. Mit `nummer` gilt sie nur für diese Ziffernfolge (ohne Trenner), ohne
 * für die ganze Datei: nur für Prüfstoff, der Nummern absichtlich in vielen Schreibweisen trägt,
 * und für Dateien, die niemand mehr ändert (Historie, Mockups).
 */
type Ausnahme = { datei: string; nummer?: string; grund: string }
const AUSNAHMEN: Ausnahme[] = [
  // Die Nummer einer Behörde, keine Person
  { datei: 'src/lib/futter-registrierung.ts', nummer: '435055533216', grund: 'Die öffentliche Nummer des BAES, so wie die Behörde sie schreibt (Kontakt für die Futter-Registrierung)' },
  { datei: 'docs/nachtlauf/freigabe.md', nummer: '435055533216', grund: 'Die öffentliche Nummer des BAES in der Freigabe, Kontakt für die Futter-Registrierung' },
  // Prüfstoff des Sentry-Filters: Die Telefon-Regel wird an Ziffernfolgen in vielen Schreibweisen geprüft
  { datei: 'src/lib/sentry-hygiene.ts', grund: 'Beispiele in den Kommentaren der Telefon-Regel des Sentry-Filters, erfundene Folgen wie 1234567 und 9876543' },
  { datei: 'tests/sentry-hygiene-felder.test.ts', grund: 'Prüfstoff der Telefon-Regel: Escapes, Trenner und Kennungen in vielen Schreibweisen; genullte Folgen träfen andere Regeln (Hex-Kennung mit 0 und acht Ziffern)' },
  { datei: 'tests/sentry-hygiene-vergleich.test.ts', grund: 'Eingefrorene Muster des Vergleichs „neu fängt mindestens, was main fängt“ — sie dürfen sich nicht ändern' },
  { datei: 'tests/sentry-hygiene-wachstum.test.ts', grund: 'Prüfstoff des Wachstumstests der Telefon-Regel, Nummern an vielen Stellen hintereinander' },
  { datei: 'tests/beobachtbarkeit.test.ts', grund: 'Prüfstoff des Sentry-Filters: Rückrufnummern in Nachrichten, Anfragen und Getter-Fehlern müssen fallen' },
  { datei: 'docs/nachtlauf/berichte/56.md', grund: 'Bericht eines früheren Laufs (Historie): beschreibt Prüfstoff der Telefon-Regel des Sentry-Filters' },
  { datei: 'docs/nachtlauf/berichte/64.md', grund: 'Bericht eines früheren Laufs (Historie): beschreibt Prüfstoff der Telefon-Regel des Sentry-Filters' },
  // Historie und Mockups: werden nicht mehr geändert
  { datei: 'docs/nachtlauf/freigabe.md', nummer: '062121234', grund: 'Freigabe des Menschen (Historie): Beispiel einer Festnetznummer zur Gruppierung, wird nicht geändert' },
  { datei: 'docs/nachtlauf/morgenbericht-2026-10-13-lauf12.md', nummer: '436600000103', grund: 'Morgenbericht eines früheren Laufs (Historie): eine Testnummer bis auf drei Ziffern genullt' },
  { datei: 'docs/mockups/web-k3-kasse-glatt.html', nummer: '436600000001', grund: 'Mockup, wird nur gelesen, nie geändert: Nummer bis auf die letzte Ziffer genullt' },
  { datei: 'docs/mockups/mobil-k3-kasse-glatt.html', nummer: '436600000001', grund: 'Mockup, wird nur gelesen, nie geändert: Nummer bis auf die letzte Ziffer genullt' },
  // Seed: Der Wert steht in der Datenbank jeder Entwicklungsumgebung
  { datei: 'tests/seed-idempotenz.test.ts', nummer: '436641234567', grund: 'Prüft den Wert, den der Seed (prisma/, außerhalb der Wache) seit dem ersten Lauf schreibt; ändert sich nur mit dem Seed' },
]

const deckt = (a: Ausnahme, f: Fund): boolean => a.datei === f.datei && (a.nummer === undefined || a.nummer === f.nummer.replace(/\D/g, '').replace(/^00/, ''))

function* dateien(pfad: string): Generator<string> {
  if (statSync(pfad).isDirectory()) {
    for (const name of readdirSync(pfad)) if (name !== 'node_modules') yield* dateien(join(pfad, name))
  } else if (TEXTDATEI.test(pfad)) yield pfad
}

const funde: Fund[] = []

beforeAll(() => {
  for (const ort of ORTE) {
    for (const pfad of dateien(join(WURZEL, ort))) {
      const datei = relative(WURZEL, pfad).split(sep).join('/')
      // Diese Datei trägt die Gegenproben selbst.
      if (datei === 'tests/telefonnummern-wache.test.ts') continue
      funde.push(...findeNummern(readFileSync(pfad, 'utf8'), datei))
    }
  }
}, 30_000)

describe('Telefonnummern-Wache — nur genullte Teilnehmerteile', () => {
  it('keine Nummer mit Ziffern 1–9 im Teilnehmerteil, außer den Ausnahmen mit Grund', () => {
    const verstoesse = funde.filter((f) => !AUSNAHMEN.some((a) => deckt(a, f)))
    expect(verstoesse.map((f) => `${f.datei}:${f.zeile} ${f.nummer}`)).toEqual([])
  })

  it('hat keine veraltete Ausnahme: Jede deckt mindestens einen Fund', () => {
    const ungenutzt = AUSNAHMEN.filter((a) => !funde.some((f) => deckt(a, f)))
    expect(ungenutzt.map((a) => `${a.datei} ${a.nummer ?? '(ganze Datei)'}`)).toEqual([])
  })

  it('nennt zu jeder Ausnahme einen Grund in ganzen Worten', () => {
    for (const a of AUSNAHMEN) expect(a.grund.split(' ').length, a.datei).toBeGreaterThanOrEqual(5)
  })
})

describe('Telefonnummern-Wache — Gegenprobe: die Suche schlägt an', () => {
  const nummern = (text: string): string[] => findeNummern(text).map((f) => f.nummer)

  it('findet eine eingeschmuggelte Nummer in jeder üblichen Schreibweise', () => {
    for (const text of [
      'Ruf an: +43 664 1234567',
      "phone: '0660 1234567'",
      'Tel. (0664) 123 45 67',
      '0043 676 9876543',
      '+43 (0) 699 1112223',
      'mobil 06641234567',
      'Büro 0732 123456',
      'Wien 01 234 5678',
      'Bayern +49 8571 123456',
      'mobil +49 151 23456789',
      '+43 660 0000001',
    ]) {
      expect(nummern(text), text).toHaveLength(1)
    }
  })

  it('lässt genullte Nummern, bloße Vorwahlen und Nicht-Nummern stehen', () => {
    for (const text of [
      '+43 660 000 0000',
      "phone: '0660 0000000'",
      '+43 (0) 664 0000000',
      '06212 0000',
      '+49 151 0000 0000',
      '+49 8571 0000xx',
      'Vorwahlen 664, 676 und 699',
      'am 01.09.2026 um 08:00',
      'Stand 2026-10-05 (Nr. 07)',
      'Nr. 07 (246071b)',
      'cabo00000000000000000002',
      'page-f0123456789abcde.js',
      "'mail-token-0123456789abcdef'",
      "hexAbstand('#000000', '#010203')",
      'oklch(0.9577 0.0136 93.0)',
      '€ 0,50 und 0.012345678',
      '10:30+43',
      'otp: 012012+43 664 …',
    ]) {
      expect(nummern(text), text).toEqual([])
    }
  })

  it('liest die Vorwahl wie die Anzeige: Wien eine Stelle, Graz drei, sonst vier', () => {
    expect(teilnehmerteil('+43 1 000 0000')).toBe('0000000')
    expect(teilnehmerteil('0316 000000')).toBe('000000')
    expect(teilnehmerteil('06212 0000')).toBe('0000')
    expect(teilnehmerteil('+43 660')).toBeNull()
    expect(teilnehmerteil('012012')).toBeNull()
  })
})
