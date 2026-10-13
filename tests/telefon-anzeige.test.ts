/**
 * Telefonnummern einheitlich anzeigen (Nr. 81, Register N8).
 *
 * Beweist an der reinen Funktion: Aus jeder lesbaren Eingabe wird
 * „+43 660 000 0000" — führende 0, 0043, vorhandener Ländercode, Klammern,
 * Bindestriche und Schrägstriche. Was sich nicht eindeutig lesen lässt, kommt
 * unverändert zurück, nie leer. Der tel:-Link entsteht aus denselben Ziffern,
 * die die Anzeige zeigt; wo sich die Nummer nicht lesen lässt, gibt es keinen —
 * er würde sonst eine andere Nummer wählen, als dort steht. Alle Nummern sind
 * erfunden, ihr Teilnehmerteil besteht aus Nullen. Gespeichert bleibt die
 * Eingabe — hier gibt es keinen Schreibweg.
 *
 * Dazu eine Wache am Quelltext: Wer einen tel:-Link braucht, nimmt
 * `telefonLink`; die Stellen, die noch von Hand bauen, stehen in einer Liste,
 * die nur kürzer werden darf. Die Anzeige in den Bauteilen prüfen die Tests
 * von Kasse, Hof erreichen, Kundendetail, Bestellung, Mail und Tipp-Liste.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'

const WURZEL = process.cwd()

/** Eingabe → so wird sie angezeigt. */
const LESBAR: ReadonlyArray<readonly [string, string]> = [
  // Österreichisches Mobilnetz in allen üblichen Schreibweisen
  ['0660 0000000', '+43 660 000 0000'],
  ['+43 660 0000000', '+43 660 000 0000'],
  ['0043 660 0000000', '+43 660 000 0000'],
  ['+43 660 000 0000', '+43 660 000 0000'],
  ['06600000000', '+43 660 000 0000'],
  ['(0660) 000-0000', '+43 660 000 0000'],
  ['0660/000 00 00', '+43 660 000 0000'],
  ['0660.000.0000', '+43 660 000 0000'],
  ['+43 (0) 660 000 0000', '+43 660 000 0000'],
  ['+43 0660 000 0000', '+43 660 000 0000'],
  ['  0660 0000000  ', '+43 660 000 0000'],
  // Ohne 0 und ohne +43 (Screenshot 12.10.): eine Mobil-Vorwahl ist eindeutig
  ['660 0000000', '+43 660 000 0000'],
  ['43 660 0000000', '+43 660 000 0000'],
  ['+43 664 000 0000', '+43 664 000 0000'],
  // Der Rest in Dreier- und Vierergruppen
  ['0664 000000', '+43 664 000 000'],
  ['0676 00000000', '+43 676 0000 0000'],
  // Festnetz: Wien einstellig, die kurzen Städte dreistellig, sonst vier Stellen
  ['06212 0000', '+43 6212 0000'],
  ['+43 6212 0000', '+43 6212 0000'],
  ['01 0000000', '+43 1 000 0000'],
  ['0316 000000', '+43 316 000 000'],
  ['0662 0000000', '+43 662 000 0000'],
  ['0732 000000', '+43 732 000 000'],
  ['0512 0000000', '+43 512 000 0000'],
  ['02742 000000', '+43 2742 000 000'],
  ['07752 00000', '+43 7752 00000'],
  // Ein vorhandener Ländercode bleibt
  ['+49 151 00000000', '+49 151 0000 0000'],
  ['0049 151 00000000', '+49 151 0000 0000'],
  ['+421 905 000000', '+421 905 000 000'],
]

/** Was sich nicht eindeutig lesen lässt: kommt so zurück, wie es war. */
const UNLESBAR: readonly string[] = [
  '',
  '   ',
  'keine Angabe',
  '12345',
  '+43',
  '0660 000',
  '0000 000000',
  '+0660 0000000',
  '0660 0000000 (Büro)',
  '0660 0000000 ab 18 Uhr',
  '0660 0000000 / 0664 0000000',
  '0660#0000000',
  '+43 660 000 0000 0000 0000',
]

describe('formatiereTelefon: lesbare Eingaben', () => {
  it.each(LESBAR)('%j wird zu %j', (eingabe, erwartet) => {
    expect(formatiereTelefon(eingabe)).toBe(erwartet)
  })

  it('eine schon fertige Anzeige bleibt, wie sie ist', () => {
    for (const [eingabe] of LESBAR) {
      const einmal = formatiereTelefon(eingabe)
      expect(formatiereTelefon(einmal), eingabe).toBe(einmal)
    }
  })
})

describe('formatiereTelefon: Unlesbares kommt unverändert zurück', () => {
  it.each(UNLESBAR)('%j bleibt', (eingabe) => {
    expect(formatiereTelefon(eingabe)).toBe(eingabe)
  })

  it('aus einer Eingabe mit Zeichen wird nie ein leerer Text', () => {
    for (const eingabe of [...LESBAR.map(([e]) => e), ...UNLESBAR.filter((e) => e.trim() !== '')]) {
      expect(formatiereTelefon(eingabe).trim(), eingabe).not.toBe('')
    }
  })
})

/** Eingabe → Link (null = kein Link). */
const LINKS: ReadonlyArray<readonly [string, string | null]> = [
  ['0660 0000000', 'tel:+436600000000'],
  ['(0660) 000-0000', 'tel:+436600000000'],
  ['0043 660 0000000', 'tel:+436600000000'],
  ['660 0000000', 'tel:+436600000000'],
  ['+43 660 0000000', 'tel:+436600000000'],
  ['06212 0000', 'tel:+4362120000'],
  ['+49 151 00000000', 'tel:+4915100000000'],
  // Nicht eindeutig lesbar, auch wenn Ziffern darin stehen: kein Link — er wählte sonst eine andere Nummer, als angezeigt wird
  ['0660 0000000 (Büro)', null],
  ['0660 0000000 ab 18 Uhr', null],
  ['0660 0000000 / 0664 0000000', null],
  ['+43 660 abc 0000000', null],
  ['12345', null],
  // Ohne Ziffer (oder mit mehr, als eine Nummer haben kann) erst recht nicht
  ['keine Angabe', null],
  ['', null],
  ['---', null],
  ['+', null],
  ['0660 0000000 0660 0000000 0660', null],
]

describe('telefonLink', () => {
  it.each(LINKS)('%j → %j', (eingabe, erwartet) => {
    expect(telefonLink(eingabe)).toBe(erwartet)
  })

  it('in die Adresse gehen nur ein Plus und Ziffern — nichts, was die Eingabe sonst enthielt', () => {
    for (const eingabe of [...LESBAR.map(([e]) => e), ...UNLESBAR, '0660 0000000"><b>', "0660 0000000'; x"]) {
      const link = telefonLink(eingabe)
      if (link !== null) expect(link, eingabe).toMatch(/^tel:\+\d+$/)
    }
  })

  it('Anzeige und Link meinen dieselbe Nummer', () => {
    for (const [eingabe] of LESBAR) {
      const link = telefonLink(eingabe)
      expect(formatiereTelefon(eingabe).replace(/\D/g, ''), eingabe).toBe(link?.replace(/\D/g, ''))
    }
  })
})

describe('Wache: tel:-Links entstehen in src/lib/telefon-anzeige.ts', () => {
  // Ein Anführungszeichen oder Backtick direkt vor „tel:" — so beginnt ein von Hand gebauter Link.
  const TEL_VON_HAND = /[`'"]tel:/

  /**
   * Noch von Hand gebaut, weil sie außerhalb der Grenze von Nr. 81 liegen — die
   * nächste Freigabe stellt sie auf `telefonLink` um. Die Liste darf nur
   * kürzer werden: Eine Datei, die dort steht und nicht mehr von Hand baut,
   * macht die Wache rot, damit die Liste nicht still stehen bleibt.
   */
  const NOCH_VON_HAND: readonly string[] = [
    'src/components/hof-kunden/kunden-ansicht.tsx',
    'src/emails/artikel-fehlt.tsx',
    'src/emails/order-confirmation.tsx',
    'src/emails/order-confirmed.tsx',
    'src/emails/order-not-ready.tsx',
    'src/emails/pickup-reminder.tsx',
  ]

  /** Die Quelle selbst; und die feste Nummer des BAES, deren Link aus der Konstante entsteht. */
  const ERLAUBT: readonly string[] = ['src/lib/telefon-anzeige.ts', 'src/lib/futter-registrierung.ts']

  function quelldateien(ordner: string): string[] {
    const funde: string[] = []
    for (const name of readdirSync(join(WURZEL, ordner))) {
      const pfad = join(ordner, name)
      if (statSync(join(WURZEL, pfad)).isDirectory()) funde.push(...quelldateien(pfad))
      else if (/\.tsx?$/.test(name)) funde.push(relative(WURZEL, join(WURZEL, pfad)).split('\\').join('/'))
    }
    return funde
  }

  const lies = (pfad: string): string => readFileSync(join(WURZEL, pfad), 'utf8')

  it('Gegenprobe: die Suche schlägt an einem Link von Hand an, an Kommentaren und Texten nicht', () => {
    expect(TEL_VON_HAND.test('<a href={`tel:${telefon}`}>')).toBe(true)
    expect(TEL_VON_HAND.test('<a href="tel:+436600000000">')).toBe(true)
    expect(TEL_VON_HAND.test("const link = 'tel:' + nummer")).toBe(true)
    expect(TEL_VON_HAND.test('öffnet; tel:, mailto: und alles, was nicht http(s) ist')).toBe(false)
    expect(TEL_VON_HAND.test('const titel: string')).toBe(false)
  })

  it('außer den erlaubten und den gelisteten baut keine Datei in src/ einen tel:-Link von Hand', () => {
    const funde = quelldateien('src').filter((pfad) => TEL_VON_HAND.test(lies(pfad)))
    expect(funde.filter((pfad) => !ERLAUBT.includes(pfad) && !NOCH_VON_HAND.includes(pfad))).toEqual([])
  })

  it('die Liste „noch von Hand" ist ehrlich: jede Datei darin baut wirklich noch von Hand', () => {
    expect(NOCH_VON_HAND.filter((pfad) => !TEL_VON_HAND.test(lies(pfad)))).toEqual([])
  })
})
