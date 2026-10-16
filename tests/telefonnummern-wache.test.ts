/**
 * Telefonnummern-Wache (TESTING_GUIDELINES §2, Dirigenten-Vorschlag Lauf 12; gebaut in Nr. 85).
 *
 * Ursache: Das Repository ist öffentlich, und Beispielnummern standen mit echtem Teilnehmerteil
 * in Tests, Kommentaren und DEVELOPMENT.md (Mobilnummern mit beliebigen Ziffern hinter der
 * Vorwahl) — jede davon kann jemandem gehören.
 * Regel (CLAUDE.md §2, TESTING_GUIDELINES §5): Eine Nummer mit österreichischer oder deutscher
 * Vorwahl hat einen Teilnehmerteil aus Nullen („+43 660 000 0000“); verschiedene Nummern
 * unterscheiden sich in der Vorwahl (660, 664, 676 …), nie in den Ziffern dahinter.
 *
 * Beweist (Dateiarbeit, kein Netz): Keine Datei unter src/, tests/, docs/ und DEVELOPMENT.md —
 * auch diese nicht — enthält eine Nummer mit Ziffern 1–9 im Teilnehmerteil, außer den Ausnahmen.
 * Erkannt wird (`KANDIDAT`): Ländercode (+43, 0043, +49, 0049) oder Wahl-Null mit Vorwahl, eine
 * Mobilnummer auch ohne beides; Klammern um Ländercode und Vorwahl; Leerzeichen, Strich und Punkt
 * als Trenner (nach der Vorwahl auch ein Schrägstrich); eine angehängte Zifferngruppe („… 2026“)
 * ändert nichts, es zählt die Nummer davor. Nicht erkannt werden andere Ländercodes, Festnetz ohne
 * 0 und „+“, Nummern mit Buchstaben oder anderen Trennern dazwischen und Ziffernfolgen, die an
 * einem Wort, „#“, „_“ oder weiteren Ziffern kleben (Kennungen, Hashes, Beträge). Eine deutsche
 * Nummer ohne Ländercode („0151 …“) liest die Wache als österreichische und meldet sie auch
 * genullt — deutsche Nummern mit „+49“ schreiben.
 * Pfaddaten von SVG (`d="M…"`) überspringt die Wache grundsätzlich (`ohnePfaddaten`): Koordinaten sind
 * keine Nummern, und eine Ausnahmeliste für Mockups und Symbole liefe jedem Upload hinterher.
 * Ausnahmen gelten je Nummer (ihre Kennung) und Datei, nie für eine ganze Datei, und nennen ihren
 * Grund. Jede Ausnahme deckt einen Fund; eine veraltete fällt auf.
 * Gegenprobe je erkannter Schreibweise: eine eingeschmuggelte Nummer schlägt an, genullte und
 * Nicht-Nummern (Datum, Kennung, Betrag) nicht. Die Gegenproben setzen ihre Ziffer erst zur
 * Laufzeit ein — im Quelltext steht nur die genullte Fassung.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const WURZEL = process.cwd()
const ORTE = ['src', 'tests', 'docs', 'DEVELOPMENT.md']
const TEXTDATEI = /\.(ts|tsx|mjs|cjs|js|json|md|html|css|sql|txt|ya?ml)$/
const DIESE_DATEI = 'tests/telefonnummern-wache.test.ts'

/**
 * Ein Kandidat beginnt mit einem Ländercode (+43, 0043, +49, 0049, auch „(+43)“ und „+43 (0) 660 …“),
 * mit der Wahl-Null samt Vorwahl („0660“, „(0664)“, „06212“, „01“) oder — so liest auch die Anzeige
 * (`MOBIL_OHNE_NULL` in src/lib/telefon-anzeige.ts) — mit einer Mobil-Vorwahl 65x–69x ohne 0, auch mit
 * „43“ davor (E.164 ohne „+“). Die Vorwahl darf in Klammern stehen („+43 (664) …“, „(664) …“). Ländercode,
 * Vorwahl und Teilnehmerteil trennt höchstens ein Trenner wie „ / “ oder ein Punkt („+43.664.…“, „664.…“),
 * den Teilnehmerteil selbst Ziffern mit je einem Leerzeichen, Strich oder Punkt dazwischen.
 * Nie mitten in einem Wort oder einer Zahl — auch nicht hinter einem Dezimalzeichen (oklch-Werte,
 * Beträge), „#“ (Farbwert) oder „_“, in einer Kennung oder einem Hex-Hash mit Buchstaben davor
 * oder danach, und nicht, wo das „+“ an einer Zahl klebt (Uhrzeit).
 */
const KANDIDAT = new RegExp(
  [
    String.raw`(?<![\p{L}\p{N}.,_#])\(?(?:\+|00)[ ]?(?:43|49)\)?(?:[ ]?\(0\))?[ \-.\/]{0,3}\(?\d{1,5}\)?[ \-.\/]{0,3}\d(?:[ \-.]?\d)*(?![\p{L}\p{N}])`,
    String.raw`(?<![\p{L}\p{N}.,_#])\(?0[1-9]\d{0,3}\)?[ \-\/]{0,3}\d(?:[ \-.]?\d)*(?![\p{L}\p{N}])`,
    // Ohne 0 und ohne „+“ nur eine Mobil-Vorwahl: Festnetz ohne 0 würde geraten (wie die Anzeige).
    String.raw`(?<![\p{L}\p{N}.,_#+])\(?(?:43[ ]?)?6[5-9]\d\)?[ \-.\/]{0,3}\d(?:[ \-.]?\d)*(?![\p{L}\p{N}])`,
  ].join('|'),
  'gu'
)

/** Österreichische Festnetz-Vorwahlen mit drei Stellen (wie src/lib/telefon-anzeige.ts); Wien hat eine, sonst vier. */
const DREISTELLIGE_ORTE = new Set(['316', '463', '512', '662', '732'])

/** Mehr Ziffern hat keine Nummer ohne Ländercode (E.164: höchstens 15 samt Ländercode). */
const MAX_NATIONAL = 13

type Gelesen = {
  /** Ländercode und Nummer ohne Wahl-Null (E.164 ohne „+“) — in jeder Schreibweise dieselben Ziffern. */
  ziffern: string
  /** Was nach der Vorwahl kommt. */
  teil: string
}

/**
 * Ein Kandidat als Nummer gelesen — oder null, wenn er keine ist (zu kurz, nur eine Vorwahl, mehr
 * Ziffern als eine Nummer hat). Österreich: Vorwahl nach denselben Regeln wie die Anzeige;
 * Deutschland: Mobil 15x–17x dreistellig, sonst die erste Gruppe, wie sie geschrieben steht.
 */
function lies(kandidat: string): Gelesen | null {
  // Eine Klammer vor dem Ländercode („(+43) 1 000 0000“) gehört nicht zur Nummer.
  const text = kandidat.replace(/^\(/, '')
  const ziffern = text.replace(/\D/g, '')
  const gruppen = text.split(/\D+/).filter(Boolean)
  let land: string
  let national: string
  let ersteGruppe: string | undefined
  if (text.startsWith('+') || ziffern.startsWith('00')) {
    const ohneNullen = text.startsWith('+') ? ziffern : ziffern.slice(2)
    land = ohneNullen.slice(0, 2)
    // „+43 (0) 660 …“: Die Wahl-Null gehört nicht zur Nummer.
    national = ohneNullen.slice(2).replace(/^0/, '')
    const nachLand = gruppen.slice(1).filter((g) => g !== '0')
    ersteGruppe = (gruppen[0]?.length ?? 0) > 4 ? undefined : nachLand[0]?.replace(/^0/, '')
  } else if (ziffern.startsWith('0')) {
    land = '43'
    national = ziffern.slice(1)
    ersteGruppe = gruppen[0]?.replace(/^0/, '')
  } else {
    // Mobil-Vorwahl ohne 0, auch mit „43“ davor — nur so kommt ein Kandidat ohne 0 und „+“ zustande.
    land = '43'
    national = ziffern.replace(/^43/, '')
  }
  let vorwahl: number
  if (land === '43') {
    vorwahl = national.startsWith('1') ? 1 : /^6[5-9]/.test(national) || DREISTELLIGE_ORTE.has(national.slice(0, 3)) ? 3 : 4
  } else {
    vorwahl = /^1[5-7]/.test(national) ? 3 : Math.min(ersteGruppe?.length ?? 3, 5)
  }
  // Österreichische Nummern haben 7 bis 13 Ziffern (wie die Anzeige), deutsche 6 bis 13 — kürzer ist ein Code, länger hängt etwas an.
  if (national.length > MAX_NATIONAL || national.length < (land === '43' ? 7 : 6)) return null
  const teil = national.slice(vorwahl)
  return teil.length >= 3 ? { ziffern: land + national, teil } : null
}

/** Der Teilnehmerteil eines Kandidaten — oder null, wenn er keine Nummer ist. */
const teilnehmerteil = (kandidat: string): string | null => lies(kandidat)?.teil ?? null

/**
 * Die Kennung einer Nummer für die Ausnahmeliste: die ersten zwölf Zeichen von SHA-256 über ihre
 * Ziffern samt Ländercode, Ziffern als Buchstaben g–p. Diese Datei prüft sich selbst — die Liste
 * nennt so keine Nummer, und keine Kennung sieht aus wie eine (so führen Secret-Scanner ihre
 * Ausnahmen: Hash statt Geheimnis). Die Kennung eines neuen Funds steht in der Meldung des ersten Tests.
 */
function kennung(ziffern: string): string {
  return createHash('sha256')
    .update(ziffern)
    .digest('hex')
    .slice(0, 12)
    .replace(/\d/g, (d) => String.fromCharCode(0x67 + Number(d)))
}

/**
 * Hängt hinter einer Nummer noch eine Zifferngruppe („+43 664 000 0000 2026“: Jahr, Hausnummer), hat der
 * Kandidat zu viele Ziffern für `lies`. Es zählt die Nummer davor: Gruppen vom Ende her abschneiden, bis
 * der Rest eine Nummer ist. Ist keine zu lesen, bleibt der Kandidat, wie er ist.
 */
function ohneAnhang(kandidat: string): string {
  let rest = kandidat
  while (!lies(rest)) {
    const kuerzer = rest.replace(/[ \-.\/]+\d+$/, '')
    if (kuerzer === rest) return kandidat
    rest = kuerzer
  }
  return rest
}

/**
 * Mehrere Nummern hintereinander („0660 0000000 0660 0000000“, Prüfstoff für ein Feld mit zwei
 * Nummern) sind ein Kandidat mit zu vielen Ziffern: Er wird an jeder Gruppe getrennt, die mit der
 * Wahl-Null neu beginnt, und jede Nummer zählt für sich. Mit „+“ vorn bleibt er ganz: „+43 0664 …“
 * schreibt die Wahl-Null hinter den Ländercode.
 */
function nummernIn(kandidat: string): string[] {
  const ziffern = kandidat.replace(/\D/g, '')
  const teile = ziffern.length - 1 <= MAX_NATIONAL || /^\(?\+/.test(kandidat) ? [kandidat] : kandidat.split(/\s+(?=\(?0[1-9])/)
  return teile.map(ohneAnhang)
}

type Fund = { datei: string; zeile: number; nummer: string; kennung: string }

/**
 * SVG-Pfaddaten (`d="M…"`, auch mit einfachen Anführungszeichen) als Leerraum, die Zeilen bleiben
 * erhalten. Pfaddaten beginnen immer mit M/m und bestehen nur aus Befehlsbuchstaben, Zahlen und Trennern —
 * Koordinatenfolgen sehen sonst wie eine Handynummer aus (Mockups, Symbole). Eine Nummer
 * außerhalb von `d="…"` bleibt sichtbar.
 */
function ohnePfaddaten(text: string): string {
  return text.replace(/(?<![\p{L}\p{N}_-])d=(["'])\s*[Mm][MmLlHhVvCcSsQqTtAaZz0-9\s,.eE+-]*\1/gu, (treffer) => treffer.replace(/[^\n]/g, ' '))
}

/** Alle Nummern eines Texts, deren Teilnehmerteil nicht nur aus Nullen besteht. */
function findeNummern(text: string, datei = 'schnipsel.md'): Fund[] {
  const funde: Fund[] = []
  ohnePfaddaten(text).split('\n').forEach((zeile, i) => {
    for (const treffer of zeile.matchAll(KANDIDAT)) {
      for (const nummer of nummernIn(treffer[0].trim())) {
        const gelesen = lies(nummer)
        if (gelesen && !/^0+$/.test(gelesen.teil)) funde.push({ datei, zeile: i + 1, nummer, kennung: kennung(gelesen.ziffern) })
      }
    }
  })
  return funde
}

/** Ausnahmen — je Nummer (ihre Kennung) und Datei, je mit Grund. Eine Ausnahme für eine ganze Datei gibt es nicht. */
type Ausnahme = { datei: string; kennungen: string[]; grund: string }

// Nummern, die in mehreren Dateien stehen
const BAES = 'idkkihnkmhmm' // die öffentliche Nummer des BAES
const MOBIL_A = 'gbmgfejcfpof' // erfundene Mobilnummer der Sentry-Hygiene, auch im Seed
const MOBIL_B = 'jjnagakledba' // zweite erfundene Mobilnummer der Sentry-Hygiene

const AUSNAHMEN: Ausnahme[] = [
  // Die Nummer einer Behörde, keine Person
  { datei: 'src/lib/futter-registrierung.ts', kennungen: [BAES], grund: 'Die öffentliche Nummer des BAES, so wie die Behörde sie schreibt (Kontakt für die Futter-Registrierung)' },
  { datei: 'docs/nachtlauf/freigabe.md', kennungen: [BAES], grund: 'Die öffentliche Nummer des BAES in der Freigabe, Kontakt für die Futter-Registrierung' },
  // Prüfstoff der Sentry-Hygiene: Die Telefon-Regel des Filters wird an Nummern in vielen Schreibweisen geprüft
  { datei: 'src/lib/sentry-hygiene.ts', kennungen: [MOBIL_A, MOBIL_B, 'ckomggmnhdpd', 'eempbnjacgce'], grund: 'Prüfstoff der Sentry-Hygiene (Altlast): Beispiele in den Kommentaren der Telefon-Regel des Filters' },
  {
    datei: 'tests/sentry-hygiene-felder.test.ts',
    kennungen: [MOBIL_A, MOBIL_B, 'ckomggmnhdpd', 'eempbnjacgce', 'bmciclalhjfo', 'gadogmbdknkj', 'ghfpfpmdlgep', 'hipcmjkcmhbi'],
    grund: 'Prüfstoff der Sentry-Hygiene (Altlast): Escapes, Trenner und Kennungen in vielen Schreibweisen; genullte Folgen träfen andere Regeln (Hex-Kennung mit 0 und acht Ziffern)',
  },
  { datei: 'tests/sentry-hygiene-vergleich.test.ts', kennungen: [MOBIL_B, 'ahncadihelkk', 'enoeeijaiegg'], grund: 'Prüfstoff der Sentry-Hygiene (Altlast): eingefrorene Muster des Vergleichs „neu fängt mindestens, was main fängt“ — sie dürfen sich nicht ändern' },
  { datei: 'tests/sentry-hygiene-wachstum.test.ts', kennungen: [MOBIL_A, MOBIL_B, 'ceakalodfnpf', 'cefpogmnfemo', 'ghfpfpmdlgep'], grund: 'Prüfstoff der Sentry-Hygiene (Altlast): Wachstumstest der Telefon-Regel, Nummern an vielen Stellen hintereinander' },
  { datei: 'tests/beobachtbarkeit.test.ts', kennungen: [MOBIL_A], grund: 'Prüfstoff der Sentry-Hygiene (Altlast): Rückrufnummern in Nachrichten, Anfragen und Getter-Fehlern müssen fallen' },
  // Historie und Mockups: werden nicht mehr geändert (SVG-Pfaddaten überspringt die Wache selbst)
  { datei: 'docs/nachtlauf/berichte/56.md', kennungen: [MOBIL_A, MOBIL_B], grund: 'Bericht eines früheren Laufs (Historie): beschreibt den Prüfstoff der Sentry-Hygiene' },
  { datei: 'docs/nachtlauf/berichte/64.md', kennungen: [MOBIL_B], grund: 'Bericht eines früheren Laufs (Historie): beschreibt den Prüfstoff der Sentry-Hygiene' },
  { datei: 'docs/nachtlauf/freigabe.md', kennungen: ['abbjofflhged'], grund: 'Freigabe des Menschen (Historie): Beispiel einer Festnetznummer zur Gruppierung, wird nicht geändert' },
  { datei: 'docs/nachtlauf/morgenbericht-2026-10-13-lauf12.md', kennungen: ['foemjlcpdjfh'], grund: 'Morgenbericht eines früheren Laufs (Historie): eine Testnummer bis auf drei Ziffern genullt' },
  { datei: 'docs/mockups/web-k3-kasse-glatt.html', kennungen: ['bhojpaabapgd'], grund: 'Mockup, wird nur gelesen, nie geändert: Nummer bis auf die letzte Ziffer genullt' },
  { datei: 'docs/mockups/mobil-k3-kasse-glatt.html', kennungen: ['bhojpaabapgd'], grund: 'Mockup, wird nur gelesen, nie geändert: Nummer bis auf die letzte Ziffer genullt' },
  // Seed: Der Wert steht in der Datenbank jeder Entwicklungsumgebung
  { datei: 'tests/seed-idempotenz.test.ts', kennungen: [MOBIL_A], grund: 'Prüft den Wert, den der Seed (prisma/, außerhalb der Wache) seit dem ersten Lauf schreibt; ändert sich nur mit dem Seed' },
]

const deckt = (a: Ausnahme, f: Fund): boolean => a.datei === f.datei && a.kennungen.includes(f.kennung)

function* dateien(pfad: string): Generator<string> {
  if (statSync(pfad).isDirectory()) {
    for (const name of readdirSync(pfad)) if (name !== 'node_modules') yield* dateien(join(pfad, name))
  } else if (TEXTDATEI.test(pfad)) yield pfad
}

const gelesen: string[] = []
const funde: Fund[] = []

// Liest jede Textdatei unter src/, tests/ und docs/ (weit über tausend) — unter Last länger als das Standardlimit.
beforeAll(() => {
  for (const ort of ORTE) {
    for (const pfad of dateien(join(WURZEL, ort))) {
      const datei = relative(WURZEL, pfad).split(sep).join('/')
      gelesen.push(datei)
      funde.push(...findeNummern(readFileSync(pfad, 'utf8'), datei))
    }
  }
}, 30_000)

/** Setzt in einer genullten Nummer die letzte 0 auf 1 — erst zur Laufzeit; im Quelltext steht nur die genullte Fassung. */
const eingeschmuggelt = (genullt: string): string => genullt.replace(/0(?=\D*$)/, '1')

describe('Telefonnummern-Wache — nur genullte Teilnehmerteile', () => {
  it('keine Nummer mit Ziffern 1–9 im Teilnehmerteil, außer den Ausnahmen mit Grund', () => {
    const verstoesse = funde.filter((f) => !AUSNAHMEN.some((a) => deckt(a, f)))
    expect(verstoesse.map((f) => `${f.datei}:${f.zeile} ${f.nummer} (Kennung ${f.kennung})`)).toEqual([])
  })

  it('prüft auch sich selbst — die Gegenproben unten stehen nur genullt im Quelltext', () => {
    expect(gelesen).toContain(DIESE_DATEI)
  })

  it('hat keine veraltete Ausnahme: Jede Kennung deckt mindestens einen Fund in ihrer Datei', () => {
    const ungenutzt = AUSNAHMEN.flatMap((a) =>
      a.kennungen.filter((k) => !funde.some((f) => f.datei === a.datei && f.kennung === k)).map((k) => `${a.datei} ${k}`)
    )
    expect(ungenutzt).toEqual([])
  })

  it('nennt zu jeder Ausnahme einen Grund in ganzen Worten', () => {
    for (const a of AUSNAHMEN) expect(a.grund.split(' ').length, a.datei).toBeGreaterThanOrEqual(5)
  })
})

describe('Telefonnummern-Wache — Gegenprobe: die Suche schlägt an', () => {
  const nummern = (text: string): string[] => findeNummern(text).map((f) => f.nummer)

  it('findet eine eingeschmuggelte Nummer in jeder üblichen Schreibweise — genullt bleibt sie stehen', () => {
    for (const genullt of [
      'Ruf an: +43 664 000 0000',
      "phone: '0660 0000000'",
      'Tel. (0664) 000 00 00',
      '0043 676 0000000',
      '+43 (0) 699 0000000',
      '(+43) 664 000 0000',
      'mobil 06640000000',
      'ohne Null: 664 000 0000',
      'wa.me/436640000000',
      'Büro 0732 000000',
      'Wien 01 000 0000',
      'Bayern +49 8571 000000',
      'mobil +49 151 00000000',
    ]) {
      expect(nummern(genullt), genullt).toEqual([])
      const text = eingeschmuggelt(genullt)
      expect(nummern(text), text).toHaveLength(1)
    }
  })

  it('findet sie auch mit Klammern um Ländercode oder Vorwahl und mit Punkten als Trenner', () => {
    for (const genullt of [
      'Tel. +43 (664) 000-0000',
      'Tel. +49 (8571) 000000',
      '(+43) 1 000 0000',
      '(0043) 1 000 0000',
      '(+49) 30 0000000',
      '(+43)664 000 0000',
      '+43.664.0000000',
      '+43 664.000.0000',
      '0664.000.0000',
      '(664) 000 0000',
      '664.000.0000',
    ]) {
      expect(nummern(genullt), genullt).toEqual([])
      const text = eingeschmuggelt(genullt)
      expect(nummern(text), text).toHaveLength(1)
    }
  })

  it('zählt die Nummer vor einer angehängten Zifferngruppe — mit ihr hätte der Kandidat zu viele Ziffern', () => {
    for (const genullt of ['+43 664 000 0000', '(+43) 664 000 0000', '0664 0000000', '+49 8571 000000']) {
      for (const anhang of ['2026', '4711', '1234 5678']) {
        expect(nummern(`${genullt} ${anhang}`), genullt).toEqual([])
        const text = `${eingeschmuggelt(genullt)} ${anhang}`
        expect(nummern(text), text).toHaveLength(1)
      }
    }
  })

  it('dieselbe Ziffernfolge ist keine Nummer, wo Buchstaben, „#“, „_“ oder ein Dezimalzeichen sie umgeben', () => {
    const folge = eingeschmuggelt('06640000000')
    const ohneNull = eingeschmuggelt('6640000000')
    expect(nummern(folge), folge).toHaveLength(1)
    expect(nummern(ohneNull), ohneNull).toHaveLength(1)
    for (const text of [`cabo${folge}`, `page-f${folge}abcde.js`, `token_${folge}`, `fill: '#${folge}'`, `0.${folge}`, `€ 0,${folge}`, `v${ohneNull}`]) {
      expect(nummern(text), text).toEqual([])
    }
  })

  it('überspringt SVG-Pfaddaten grundsätzlich, findet dieselbe Nummer aber außerhalb von d="…"', () => {
    const koordinaten = eingeschmuggelt('664 0000000')
    for (const pfad of [
      `<path d="M12 5 L ${koordinaten} Z"/>`,
      `<path d='m0 0c ${koordinaten} -3 4 5z'/>`,
      `<path\n  d="M0 0\n  L ${koordinaten}\n  Z"/>`,
      `<svg><path fill="none" d="M1.5 2.5 h ${koordinaten} v3"/></svg>`,
    ]) {
      expect(nummern(pfad), pfad).toEqual([])
    }
    // Außerhalb von d="…" bleibt sie sichtbar, auch direkt daneben und in einem anderen Attribut (data-d, id).
    for (const text of [
      `<path d="M0 0 L1 1"/> Ruf an: ${eingeschmuggelt('+43 664 000 0000')}`,
      `<p>${koordinaten}</p><path d="M0 0 Z"/>`,
      `<path data-d="M0 ${koordinaten}"/>`,
      `<a title="d=Tel ${koordinaten}">`,
    ]) {
      expect(nummern(text), text).toHaveLength(1)
    }
    // Die Zeilennummer bleibt auch nach einem mehrzeiligen Pfad richtig.
    const zweizeilig = `<path d="M0 0\n  L1 1"/>\nRuf an ${eingeschmuggelt('+43 664 000 0000')}`
    expect(findeNummern(zweizeilig).map((f) => f.zeile)).toEqual([3])
  })

  it('lässt bloße Vorwahlen und Nicht-Nummern stehen', () => {
    for (const text of [
      '+49 8571 0000xx',
      'Vorwahlen 664, 676 und 699',
      'am 01.09.2026 um 08:00',
      'Stand 2026-10-05 (Nr. 07)',
      'Nr. 07 (246071b)',
      '10:30+43',
      'Vorwahl +43 (664) oder (676)',
      'Version 1.664.000.1234 (Build)',
      'Werte (664, 000, 1234)',
    ]) {
      expect(nummern(text), text).toEqual([])
    }
  })

  it('liest die Vorwahl wie die Anzeige: Wien eine Stelle, Graz, Linz und Mobil drei, sonst vier', () => {
    expect(teilnehmerteil('+43 1 000 0000')).toBe('0000000')
    expect(teilnehmerteil('0316 000000')).toBe('000000')
    expect(teilnehmerteil('0732 000000')).toBe('000000')
    expect(teilnehmerteil('664 0000000')).toBe('0000000')
    expect(teilnehmerteil('43 664 0000000')).toBe('0000000')
    expect(teilnehmerteil('06212 0000')).toBe('0000')
    expect(teilnehmerteil('+49 151 0000 0000')).toBe('00000000')
    expect(teilnehmerteil('+43 660')).toBeNull()
    expect(teilnehmerteil('010000')).toBeNull()
  })

  it('eine Nummer hat in jeder Schreibweise dieselbe Kennung, und keine Kennung enthält eine Ziffer', () => {
    const schreibweisen = [
      '+43 664 000 0000',
      '0664 0000000',
      '0043 664 0000000',
      '+43 (0) 664 0000000',
      '664 0000000',
      '436640000000',
      '+43 (664) 000-0000',
      '(+43) 664 000 0000',
      '(664) 000 0000',
      '+43.664.0000000',
    ]
    const texte = [...schreibweisen.map(eingeschmuggelt), `${eingeschmuggelt('+43 664 000 0000')} 2026`]
    const funde = texte.map((text) => findeNummern(text))
    expect(funde.map((f) => f.length)).toEqual(texte.map(() => 1))
    const kennungen = new Set(funde.flat().map((f) => f.kennung))
    expect(kennungen.size).toBe(1)
    expect([...kennungen][0]).toMatch(/^[a-p]{12}$/)
  })
})
