/**
 * Admin › Betrieb — die reinen Regeln (src/lib/betrieb.ts, Register N18, Nr. 103).
 *
 * Beweist ohne Mock: Anteil und Stufe an den Schwellen 80/95/100 %, die
 * Fortschreibung „voll in …“ (Deckel 5 Jahre), den Stand eines Ablaufs an der
 * Grenze Sommer-/Winterzeit und mit dem Spielraum von Hobby (Start irgendwann
 * in der Stunde), die Warnregeln je Art (Speicher mit Entwarnung unter 75 %,
 * Monatswerte still im neuen Monat, E-Mails des Vortags einmal am Morgen,
 * Abläufe höchstens einmal je Tag, „noch kein Lauf“ nie), den Hinweis der
 * Shell, Kacheln, CSV — und drei Wachen: ABLAEUFE ↔ vercel.json, die neuen
 * Tabellen ohne Textspalte außer `fehlerKlasse`, email.ts bindet den Zähler
 * nur dynamisch ein.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import {
  ABLAEUFE,
  GRENZE,
  GRENZEN,
  TARIF_ZEILEN,
  abrechnungsBeginn,
  ablaufSchritt,
  ablaufStand,
  anteil,
  betriebHinweis,
  betriebKacheln,
  betriebMail,
  betriebVerlauf,
  fehlerKlasse,
  neuMessenAb,
  vercelAusgabenKarte,
  vercelSchritt,
  vercelStufe,
  warnHinweis,
  grenzSchritt,
  messungenAlsCsv,
  prozentText,
  speicherText,
  stufe,
  verlaufAchse,
  vollIn,
  vollInText,
  wannText,
  warnEintraege,
  ablaufZeilen,
  type AblaufLaufDaten,
  type Messung,
} from '@/lib/betrieb'
import { formatDollar } from '@/lib/format'

const WURZEL = process.cwd()
const T = (iso: string): Date => new Date(iso)
const TAEGLICH = { rhythmus: 'taeglich' } as const
const WOECHENTLICH = { rhythmus: 'woechentlich' } as const

function lauf(gestartetAm: string, teil: Partial<AblaufLaufDaten> = {}): AblaufLaufDaten {
  const start = T(gestartetAm)
  return { gestartetAm: start, beendetAm: new Date(start.getTime() + 900), ok: true, fehlerKlasse: null, dauerMs: 900, ...teil }
}

describe('Anteil und Stufe', () => {
  it('rechnet in Prozent der Grenze, ohne Deckel', () => {
    expect(anteil(820_000_000, GRENZEN.vercel.HOBBY.bilderBytes)).toBeCloseTo(82)
    expect(anteil(1_200_000_000, GRENZEN.vercel.HOBBY.bilderBytes)).toBeCloseTo(120)
    expect(anteil(5, 0)).toBe(0)
  })

  it.each([
    [79.99, 0],
    [80, 1],
    [94.99, 1],
    [95, 2],
    [99.99, 2],
    [100, 3],
    [140, 3],
  ])('%s %% → Stufe %s', (prozent, erwartet) => {
    expect(stufe(prozent)).toBe(erwartet)
  })

  it('der Text rundet ab — 79,6 % heißt nie „80 %“, solange keine Warnung gilt', () => {
    expect(prozentText(79.6)).toBe('79 %')
    expect(prozentText(82.4)).toBe('82 %')
  })

  it('Speicher in Dezimal-Einheiten wie die Grenzen', () => {
    expect(speicherText(838_000_000)).toBe('838 MB')
    expect(speicherText(2_100_000)).toBe('2,1 MB')
    expect(speicherText(1_000_000_000)).toBe('1 GB')
    expect(speicherText(0)).toBe('0 MB')
  })
})

describe('vollIn — lineare Fortschreibung der letzten 30 Tage', () => {
  it('aus dem ältesten und jüngsten Punkt im Fenster', () => {
    const verlauf = [
      { tag: '2026-09-16', wert: 500 },
      { tag: '2026-10-01', wert: 650 },
      { tag: '2026-10-16', wert: 800 },
    ]
    expect(vollIn(verlauf, 1000, '2026-10-16')).toEqual({ zuwachs: 300, tage: 30, vollIn: { art: 'tage', tage: 20 } })
  })

  it('Punkte älter als 30 Tage zählen nicht', () => {
    const verlauf = [
      { tag: '2026-08-01', wert: 0 },
      { tag: '2026-10-06', wert: 790 },
      { tag: '2026-10-16', wert: 800 },
    ]
    expect(vollIn(verlauf, 1000, '2026-10-16')?.tage).toBe(10)
  })

  it('ohne Zuwachs oder bei Schwund: „mehr als 5 Jahre“; weit weg ebenso (Deckel)', () => {
    expect(vollIn([{ tag: '2026-10-01', wert: 500 }, { tag: '2026-10-16', wert: 500 }], 1000, '2026-10-16')?.vollIn).toEqual({ art: 'mehrAls5Jahre' })
    expect(vollIn([{ tag: '2026-10-01', wert: 500 }, { tag: '2026-10-16', wert: 400 }], 1000, '2026-10-16')?.vollIn).toEqual({ art: 'mehrAls5Jahre' })
    expect(vollIn([{ tag: '2026-09-16', wert: 100 }, { tag: '2026-10-16', wert: 101 }], 1_000_000, '2026-10-16')?.vollIn).toEqual({ art: 'mehrAls5Jahre' })
  })

  it('schon voll: „voll“; mit nur einem Messtag kein Trend', () => {
    expect(vollIn([{ tag: '2026-10-01', wert: 900 }, { tag: '2026-10-16', wert: 1000 }], 1000, '2026-10-16')?.vollIn).toEqual({ art: 'voll' })
    expect(vollIn([{ tag: '2026-10-16', wert: 900 }], 1000, '2026-10-16')).toBeNull()
  })

  it('Text: Tage, Monate, Jahre', () => {
    expect(vollInText({ art: 'tage', tage: 1 })).toBe('voll in ≈ 1 Tag')
    expect(vollInText({ art: 'tage', tage: 90 })).toBe('voll in ≈ 3 Monaten')
    expect(vollInText({ art: 'tage', tage: 1100 })).toBe('voll in ≈ 3 Jahren')
    expect(vollInText({ art: 'mehrAls5Jahre' })).toBe('voll in mehr als 5 Jahren')
  })
})

describe('ablaufStand — pünktlich, überfällig, Fehler, noch kein Lauf', () => {
  it('ohne Zeile: „noch kein Lauf“, nie überfällig — auch Wochen nach dem Deploy', () => {
    expect(ablaufStand(WOECHENTLICH, null, T('2026-12-01T12:00:00Z'))).toBe('nochKeinLauf')
  })

  it('Hobby startet irgendwann in der Stunde: 05:00 und am Tag darauf 05:59 sind pünktlich (24 h 59 min)', () => {
    expect(ablaufStand(TAEGLICH, lauf('2026-10-15T03:00:00Z'), T('2026-10-16T03:59:00Z'))).toBe('puenktlich')
  })

  it('täglich: bis 26 h nach dem letzten Start pünktlich, danach überfällig', () => {
    const l = lauf('2026-10-15T03:00:00Z')
    expect(ablaufStand(TAEGLICH, l, T('2026-10-16T05:00:00Z'))).toBe('puenktlich')
    expect(ablaufStand(TAEGLICH, l, T('2026-10-16T05:00:00.001Z'))).toBe('ueberfaellig')
  })

  it('an der Umstellung auf Winterzeit (25.10.2026) zählen echte Stunden, nicht die Wiener Uhr', () => {
    // Start Samstag 05:00 Wiener Sommerzeit; Sonntag 05:59 Winterzeit sind 25 h 59 min später.
    const l = lauf('2026-10-24T03:00:00Z')
    expect(ablaufStand(TAEGLICH, l, T('2026-10-25T04:59:00Z'))).toBe('puenktlich')
    expect(ablaufStand(TAEGLICH, l, T('2026-10-25T05:00:00.001Z'))).toBe('ueberfaellig')
  })

  it('an der Umstellung auf Sommerzeit (29.03.2026) ebenso', () => {
    const l = lauf('2026-03-28T03:00:00Z')
    expect(ablaufStand(TAEGLICH, l, T('2026-03-29T05:00:00Z'))).toBe('puenktlich')
    expect(ablaufStand(TAEGLICH, l, T('2026-03-29T05:00:01Z'))).toBe('ueberfaellig')
  })

  it('wöchentlich: 8 Tage Spielraum', () => {
    const l = lauf('2026-10-12T05:00:00Z')
    expect(ablaufStand(WOECHENTLICH, l, T('2026-10-20T05:00:00Z'))).toBe('puenktlich')
    expect(ablaufStand(WOECHENTLICH, l, T('2026-10-20T05:00:01Z'))).toBe('ueberfaellig')
  })

  it('gescheitert: Fehler; ein Lauf ohne Ende gilt nach 15 Minuten als gescheitert', () => {
    expect(ablaufStand(TAEGLICH, lauf('2026-10-16T03:00:00Z', { ok: false, fehlerKlasse: 'PrismaClientKnownRequestError' }), T('2026-10-16T04:00:00Z'))).toBe('fehler')
    const offen = lauf('2026-10-16T03:00:00Z', { beendetAm: null, ok: false, dauerMs: null })
    expect(ablaufStand(TAEGLICH, offen, T('2026-10-16T03:10:00Z'))).toBe('puenktlich')
    expect(ablaufStand(TAEGLICH, offen, T('2026-10-16T03:16:00Z'))).toBe('fehler')
  })

  it('die Fehlerklasse ist nur ein Bezeichner, nie ein Text aus dem Fehler', () => {
    expect(fehlerKlasse(new TypeError('Adresse kunde@example.com'))).toBe('TypeError')
    const seltsam = new Error('x')
    seltsam.name = 'Fehler mit kunde@example.com'
    expect(fehlerKlasse(seltsam)).toBe('Unbekannt')
    expect(fehlerKlasse('nur Text')).toBe('Unbekannt')
  })

  it('„Wann“ in Wiener Zeit des Tages: im Sommer 05:00, im Winter 04:00; der Wochenlauf montags', () => {
    const aufraeumen = ABLAEUFE[0]
    expect(wannText(aufraeumen, T('2026-10-16T12:00:00Z'))).toBe('täglich ab 05:00')
    expect(wannText(aufraeumen, T('2026-11-16T12:00:00Z'))).toBe('täglich ab 04:00')
    expect(wannText(ABLAEUFE[3], T('2026-10-16T12:00:00Z'))).toBe('montags ab 07:00')
  })

  it('die Mail-Warteschlange (N26, Nr. 158): „jede Minute“, überfällig nach 10 Minuten — Gegenprobe täglich', () => {
    const mails = ABLAEUFE.find((a) => a.name === 'mails')
    expect(mails).toMatchObject({ pfad: '/api/cron/mails', zeitplan: '* * * * *', rhythmus: 'minuetlich' })
    if (!mails) return
    expect(wannText(mails, T('2026-10-16T12:00:00Z'))).toBe('jede Minute')
    const l = lauf('2026-10-16T12:00:00Z')
    expect(ablaufStand(mails, l, T('2026-10-16T12:10:00Z'))).toBe('puenktlich')
    expect(ablaufStand(mails, l, T('2026-10-16T12:10:00.001Z'))).toBe('ueberfaellig')
    expect(ablaufStand(ABLAEUFE[0], l, T('2026-10-16T12:10:00.001Z'))).toBe('puenktlich')
  })
})

describe('grenzSchritt — Speicher (Bilder, Datenbank)', () => {
  const jetzt = T('2026-10-16T04:05:00Z')
  const war = (s: number) => ({ stufe: s, gemeldetAm: T('2026-10-10T04:05:00Z') })

  it('80 → Warnung (Stufe 1), 85 → nichts, 95 → Warnung (Stufe 2), 78 → nichts, 74 → Entwarnung', () => {
    expect(grenzSchritt('speicher', null, 80, jetzt)).toEqual({ tun: 'warnen', stufe: 1 })
    expect(grenzSchritt('speicher', war(1), 85, jetzt)).toEqual({ tun: 'nichts' })
    expect(grenzSchritt('speicher', war(1), 95, jetzt)).toEqual({ tun: 'warnen', stufe: 2 })
    expect(grenzSchritt('speicher', war(2), 78, jetzt)).toEqual({ tun: 'nichts' })
    expect(grenzSchritt('speicher', war(2), 74, jetzt)).toEqual({ tun: 'entwarnen' })
  })

  it('voll ist Stufe 3; unter 75 % ohne offene Stufe passiert nichts', () => {
    expect(grenzSchritt('speicher', war(2), 100, jetzt)).toEqual({ tun: 'warnen', stufe: 3 })
    expect(grenzSchritt('speicher', war(0), 40, jetzt)).toEqual({ tun: 'nichts' })
    expect(grenzSchritt('speicher', null, 79, jetzt)).toEqual({ tun: 'nichts' })
  })
})

describe('grenzSchritt — Monatswerte (E-Mails, Bild-Vorgänge)', () => {
  it('je Monat einmal je Stufe, ohne Entwarnung', () => {
    const jetzt = T('2026-10-20T04:05:00Z')
    expect(grenzSchritt('monat', null, 81, jetzt)).toEqual({ tun: 'warnen', stufe: 1 })
    expect(grenzSchritt('monat', { stufe: 1, gemeldetAm: T('2026-10-12T04:00:00Z') }, 90, jetzt)).toEqual({ tun: 'nichts' })
    expect(grenzSchritt('monat', { stufe: 1, gemeldetAm: T('2026-10-12T04:00:00Z') }, 96, jetzt)).toEqual({ tun: 'warnen', stufe: 2 })
  })

  it('der neue Monat beginnt still bei 0 — und warnt neu, sobald 80 % wieder erreicht sind', () => {
    const anfang = T('2026-11-01T04:05:00Z')
    const vormonat = { stufe: 2, gemeldetAm: T('2026-10-28T04:00:00Z') }
    expect(grenzSchritt('monat', vormonat, 3, anfang)).toEqual({ tun: 'still' })
    expect(grenzSchritt('monat', vormonat, 82, anfang)).toEqual({ tun: 'warnen', stufe: 1 })
  })
})

describe('grenzSchritt — E-Mails je Tag (Anteil des Vortags)', () => {
  it('Vortag 82 % → ein Hinweis am Morgen; ein zweiter Lauf am selben Tag schweigt', () => {
    const morgen = T('2026-10-16T04:05:00Z')
    expect(grenzSchritt('tag', { stufe: 0, gemeldetAm: T('2026-10-01T04:00:00Z') }, 82, morgen)).toEqual({ tun: 'warnen', stufe: 1 })
    expect(grenzSchritt('tag', { stufe: 1, gemeldetAm: T('2026-10-16T04:05:00Z') }, 82, T('2026-10-16T09:00:00Z'))).toEqual({ tun: 'nichts' })
  })

  it('am nächsten Morgen wieder, wenn der Vortag erneut 80 % hatte; sonst still auf 0', () => {
    const gestern = { stufe: 1, gemeldetAm: T('2026-10-16T04:05:00Z') }
    expect(grenzSchritt('tag', gestern, 85, T('2026-10-17T04:05:00Z'))).toEqual({ tun: 'warnen', stufe: 1 })
    expect(grenzSchritt('tag', gestern, 30, T('2026-10-17T04:05:00Z'))).toEqual({ tun: 'still' })
  })
})

describe('ablaufSchritt', () => {
  const jetzt = T('2026-10-16T05:10:00Z')

  it('„noch kein Lauf“ warnt nie', () => {
    expect(ablaufSchritt('nochKeinLauf', null, jetzt)).toEqual({ tun: 'nichts' })
  })

  it('überfällig oder gescheitert → Warnung, höchstens eine je Ablauf und Tag', () => {
    expect(ablaufSchritt('ueberfaellig', null, jetzt)).toEqual({ tun: 'warnen', stufe: 1 })
    expect(ablaufSchritt('fehler', { stufe: 1, gemeldetAm: T('2026-10-16T03:31:00Z') }, jetzt)).toEqual({ tun: 'nichts' })
    expect(ablaufSchritt('ueberfaellig', { stufe: 1, gemeldetAm: T('2026-10-15T04:05:00Z') }, jetzt)).toEqual({ tun: 'warnen', stufe: 1 })
  })

  it('der nächste gute Lauf entwarnt', () => {
    expect(ablaufSchritt('puenktlich', { stufe: 1, gemeldetAm: T('2026-10-15T04:05:00Z') }, jetzt)).toEqual({ tun: 'entwarnen' })
    expect(ablaufSchritt('puenktlich', { stufe: 0, gemeldetAm: T('2026-10-15T04:05:00Z') }, jetzt)).toEqual({ tun: 'nichts' })
  })
})

describe('Hinweis der Shell (Punkt und Betriebsleiste, Register N15)', () => {
  const jetzt = T('2026-10-16T08:00:00Z')
  // Die Mail-Warteschlange läuft jede Minute (Nr. 158) — pünktlich heißt hier: vor 2 Minuten.
  const gut = new Map(ABLAEUFE.map((a) => [a.name, lauf(a.rhythmus === 'minuetlich' ? '2026-10-16T07:58:00Z' : '2026-10-16T03:00:00Z')]))

  it('nichts offen → null (kein Punkt)', () => {
    expect(betriebHinweis([{ art: 'bilder', stufe: 0 }], gut, jetzt)).toBeNull()
    expect(betriebHinweis([], new Map(), jetzt)).toBeNull()
  })

  it('eine Warnung → „1 Warnung“ mit dem Wert; die höhere Stufe steht vorn', () => {
    expect(betriebHinweis([{ art: 'bilder', stufe: 1 }], gut, jetzt)).toEqual({ anzahl: 1, text: 'Bilder-Speicher über 80 %', kurz: 'Bilder über 80 %' })
    expect(betriebHinweis([{ art: 'bilder', stufe: 1 }, { art: 'datenbank', stufe: 2 }], gut, jetzt)).toMatchObject({ anzahl: 2, text: 'Datenbank über 95 %' })
  })

  it('ein überfälliger Ablauf ohne Warnzeile zählt mit — so fällt auch ein ganz ausgefallener Lauf auf', () => {
    const alt = new Map(gut)
    alt.set('betrieb', lauf('2026-10-14T04:00:00Z'))
    expect(betriebHinweis([], alt, jetzt)).toEqual({ anzahl: 1, text: 'Ablauf „Messung (Betrieb)“ ausgefallen', kurz: 'Ablauf ausgefallen' })
  })
})

describe('Kacheln und Warnkarte', () => {
  const jetzt = T('2026-10-16T08:00:00Z')
  const m = (tag: string, art: Messung['art'], wert: number): Messung => ({ tag, art, wert, gemessenAm: T(`${tag}T04:05:00Z`) })

  it('ohne Messung: Werte leer, die Bilder-Kachel sagt warum; E-Mails zählen ab 0', () => {
    const [bilder, db, mails, vorgaenge] = betriebKacheln([], jetzt)
    expect(bilder.wert).toBeNull()
    expect(bilder.hinweis).toMatch(/ohne Zugang zum Bild-Speicher/)
    expect(db.wert).toBeNull()
    expect(mails.wert).toBe('0')
    expect(vorgaenge.wert).toBeNull()
  })

  it('heute gemessen: Datenbank ohne Hinweis; E-Mails heute und im Monat; ein Bilder-Wert vom Vortag sagt „Stand vom …“', () => {
    const messungen = [
      m('2026-10-15', 'bilderBytes', 800_000_000),
      m('2026-10-16', 'datenbankBytes', 46_000_000),
      m('2026-10-16', 'mails', 23),
      m('2026-10-02', 'mails', 389),
    ]
    const [bilder, db, mails] = betriebKacheln(messungen, jetzt)
    expect(db).toMatchObject({ wert: '46 MB', prozent: '9 %', warnt: false, hinweis: null })
    expect(bilder.hinweis).toMatch(/^Stand vom Do,\s15\.\sOkt/)
    expect(mails.zeile).toMatch(/^Monat: 412 von 3\s000 \(13\s%\) · zählt je Empfänger$/)
  })

  it('ein Monatswert aus dem Vormonat gilt nicht mehr', () => {
    const [, , , vorgaenge] = betriebKacheln([m('2026-09-30', 'bildVorgaengeMonat', 1900)], jetzt)
    expect(vorgaenge.wert).toBeNull()
  })

  it('außerhalb der Produktion nennt die Warnkarte keinen überfälligen Ablauf (es gibt dort keine Überfällig-Prüfung)', () => {
    const laeufe = new Map([['betrieb', lauf('2026-10-10T04:00:00Z')]])
    const zeilen = ablaufZeilen(laeufe, jetzt)
    const kacheln = betriebKacheln([], jetzt)
    expect(warnEintraege([], kacheln, zeilen, [], jetzt, false)).toEqual([])
    expect(warnEintraege([], kacheln, zeilen, [], jetzt, true).map((e) => e.titel)).toEqual(['Ablauf „Messung (Betrieb)“ überfällig'])
  })
})

describe('„Jetzt messen“, Achse, Mail, CSV', () => {
  it('misst erst nach 10 Minuten wieder: eine Messung um 08:00 sperrt bis 08:09:59, um 08:10 nicht mehr', () => {
    // Die Anweisung sperrt, wenn eine Messung NACH neuMessenAb begann (src/server/betrieb.ts, beginneMessung).
    const letzte = T('2026-10-16T08:00:00Z')
    expect(letzte.getTime() > neuMessenAb(T('2026-10-16T08:09:59Z')).getTime()).toBe(true)
    expect(letzte.getTime() > neuMessenAb(T('2026-10-16T08:10:00Z')).getTime()).toBe(false)
  })

  it('die Zeitachse: erster Tag, Monatserste, heute — Monatsnamen fest', () => {
    expect(verlaufAchse('2026-07-19', '2026-10-16')).toEqual([
      { index: 0, text: '19. Juli' },
      { index: 13, text: '1. Aug' },
      { index: 44, text: '1. Sep' },
      { index: 74, text: '1. Okt' },
      { index: 89, text: 'heute' },
    ])
  })

  it('Warn-Mail: Betreff mit Wert und Stufe, nur Zahlen und feste Namen', () => {
    const mail = betriebMail({ art: 'grenze', wert: 'datenbank', anteil: 82.4, stand: '412 MB von 500 MB sind belegt', trend: null, ohneVerwendungBytes: null })
    expect(mail.betreff).toBe('Betrieb: Datenbank bei 82 %')
    expect(mail.absaetze[0]).toMatch(/^412 MB von 500 MB sind belegt\. Bei 500 MB ist die Datenbank nur noch lesbar/)
    expect(betriebMail({ art: 'grenze', wert: 'datenbank', anteil: 100, stand: '500 MB von 500 MB sind belegt', trend: null, ohneVerwendungBytes: null }).betreff).toBe(
      'Betrieb: Datenbank voll'
    )
    expect(betriebMail({ art: 'ablauf', name: 'verwaisteBestellungen', stand: 'fehler', zuletzt: 'heute 05:31', stundenSeit: 1, wann: 'täglich ab 05:30' }).betreff).toBe(
      'Betrieb: Ablauf „Verwaiste Bestellungen“ ist gescheitert'
    )
  })

  it('CSV: BOM, Kopf, je Tag und Art eine Zeile, sortiert — nur Zahlen', () => {
    const csv = messungenAlsCsv([
      { tag: '2026-10-16', art: 'mails', wert: 3 },
      { tag: '2026-10-15', art: 'datenbankBytes', wert: 46_000_000 },
    ])
    expect(csv).toBe('\uFEFFTag;Art;Wert\r\n2026-10-15;datenbankBytes;46000000\r\n2026-10-16;mails;3\r\n')
  })
})

describe('Vercel Pro — Bilder ohne feste Grenze (Nr. 113)', () => {
  const jetzt = T('2026-10-19T08:00:00Z')
  const m = (tag: string, art: Messung['art'], wert: number): Messung => ({ tag, art, wert, gemessenAm: T(`${tag}T04:05:00Z`) })

  it('Bilder und Bild-Vorgänge zeigen den Wert ohne Prozent und Balken, mit dem Satz statt Balken — und warnen nie', () => {
    const [bilder, db, , vorgaenge] = betriebKacheln(
      [m('2026-10-19', 'bilderBytes', 5_000_000_000), m('2026-10-19', 'bildVorgaengeMonat', 9_000), m('2026-10-19', 'datenbankBytes', 46_000_000)],
      jetzt
    )
    expect(bilder).toMatchObject({ wert: '5 GB', tarif: 'Vercel Pro', anteil: null, prozent: null, warnt: false, ohneGrenze: 'nutzungsbasiert (Pro) – zählt zum Ausgabenlimit' })
    expect(vorgaenge).toMatchObject({ anteil: null, prozent: null, warnt: false, ohneGrenze: 'nutzungsbasiert (Pro) – zählt zum Ausgabenlimit' })
    expect(`${bilder.von} ${bilder.zeile} ${bilder.kurz}`).not.toMatch(/%|von 1 GB|sperrt Vercel alle Bilder/)
    expect(bilder.satz).toBe('Keine Sperre bei einer Menge – erst bei 100 % des Ausgabenlimits pausiert Vercel das Projekt.')
    // Gegenprobe: die Datenbank (Supabase Free) behält Grenze, Prozent und Balken.
    expect(db).toMatchObject({ prozent: '9 %', ohneGrenze: null })
  })

  it('ohne Grenze keine Warnstufe für Bilder: eine alte Stufe (Hobby) geht still auf 0, sonst nichts', () => {
    expect(grenzSchritt('speicher', { stufe: 2, gemeldetAm: T('2026-10-10T04:00:00Z') }, null, jetzt)).toEqual({ tun: 'still' })
    expect(grenzSchritt('speicher', null, null, jetzt)).toEqual({ tun: 'nichts' })
    expect(grenzSchritt('monat', { stufe: 0, gemeldetAm: T('2026-10-10T04:00:00Z') }, null, jetzt)).toEqual({ tun: 'nichts' })
  })

  it('der Verlauf zeigt ohne Grenze keine Linie der Bilder; die Tarif-Zeile nennt Pro und das Ausgabenlimit', () => {
    expect(betriebVerlauf([m('2026-10-19', 'bilderBytes', 5_000_000_000)], jetzt).linien.map((l) => l.id)).toEqual(['datenbank', 'mailsMonat'])
    const vercel = TARIF_ZEILEN.find((t) => t.dienst === 'Vercel')
    expect(`${vercel?.marke}, ${vercel?.satz}`).toMatch(/^Pro · nutzungsbasiert, Ausgabenlimit in Spend Management\./)
    expect(GRENZE).toMatchObject({ bilderBytes: null, bildVorgaengeMonat: null, bildUebertragungBytesMonat: null, datenbankBytes: 500_000_000 })
  })
})

describe('Vercel-Ausgaben — Abrechnungszeitraum, Stufe, Karte, Mail (Nr. 113)', () => {
  const m = (tag: string, art: Messung['art'], wert: number): Messung => ({ tag, art, wert, gemessenAm: T(`${tag}T09:00:00Z`) })

  it('der Zeitraum beginnt am 19. um 0 Uhr UTC; davor gilt der 19. des Vormonats, im Januar der Dezember', () => {
    expect(abrechnungsBeginn(T('2026-10-19T00:00:00Z')).toISOString()).toBe('2026-10-19T00:00:00.000Z')
    expect(abrechnungsBeginn(T('2026-10-18T23:59:59Z')).toISOString()).toBe('2026-09-19T00:00:00.000Z')
    expect(abrechnungsBeginn(T('2027-01-05T12:00:00Z')).toISOString()).toBe('2026-12-19T00:00:00.000Z')
  })

  it('50/75/100 % sind die Stufen 1/2/3, darunter keine', () => {
    expect([49, 50, 74, 75, 99, 100, 120].map(vercelStufe)).toEqual([0, 1, 1, 2, 2, 3, 3])
  })

  it('je Zeitraum einmal je Stufe: 50 warnt, nochmal 50 nicht, 75 warnt; der neue Zeitraum beginnt still bei 0', () => {
    const jetzt = T('2026-10-25T10:00:00Z')
    const gemeldet = (stufe: number, am: string) => ({ stufe, gemeldetAm: T(am) })
    expect(vercelSchritt(null, 1, jetzt)).toEqual({ tun: 'warnen', stufe: 1 })
    expect(vercelSchritt(gemeldet(1, '2026-10-20T10:00:00Z'), 1, jetzt)).toEqual({ tun: 'nichts' })
    expect(vercelSchritt(gemeldet(1, '2026-10-20T10:00:00Z'), 2, jetzt)).toEqual({ tun: 'warnen', stufe: 2 })
    // Stufe 2 aus dem alten Zeitraum (vor dem 19.): ohne Meldung still auf 0, mit 50 % neu Stufe 1.
    expect(vercelSchritt(gemeldet(2, '2026-10-18T10:00:00Z'), 0, jetzt)).toEqual({ tun: 'still' })
    expect(vercelSchritt(gemeldet(2, '2026-10-18T10:00:00Z'), 1, jetzt)).toEqual({ tun: 'warnen', stufe: 1 })
    expect(vercelSchritt(gemeldet(0, '2026-10-18T10:00:00Z'), 0, jetzt)).toEqual({ tun: 'nichts' })
  })

  it('Dollar aus ganzen Cent ohne Rundung auf dem Weg', () => {
    expect([formatDollar(2510), formatDollar(5000), formatDollar(1999), formatDollar(0)]).toEqual(['25,10 $', '50 $', '19,99 $', '0 $'])
    expect(formatDollar(123456)).toMatch(/^1\s234,56 \$$/)
  })

  it('Karte: die jüngste Meldung im laufenden Zeitraum, sonst „Unter 50 %“ — eine aus dem alten Zeitraum zählt nicht', () => {
    const jetzt = T('2026-10-25T10:00:00Z')
    const karte = vercelAusgabenKarte(
      [m('2026-10-21', 'vercelAusgaben', 2510), m('2026-10-21', 'vercelLimit', 5000), m('2026-10-23', 'vercelAusgaben', 3800), m('2026-10-23', 'vercelLimit', 5000)],
      jetzt
    )
    expect(karte).toMatchObject({ gemeldet: true, kurz: '38 $ von 50 $ (76 %)' })
    expect(karte.satz).toMatch(/^Zuletzt gemeldet: 38 \$ von 50 \$ \(76 %\) am Fr,\s23\.\sOkt$/)
    expect(vercelAusgabenKarte([m('2026-10-18', 'vercelAusgaben', 4000), m('2026-10-18', 'vercelLimit', 5000)], jetzt)).toEqual({
      gemeldet: false,
      satz: 'Unter 50 % – Vercel meldet erst ab 50 % des Limits.',
      kurz: 'Unter 50 %',
    })
  })

  it('Warn-Mail bei 100 %: der Satz, dass die Seite offline ist; bei 50 % die Vorwarnung — nur Beträge, keine Kennung', () => {
    const voll = betriebMail({ art: 'vercelAusgaben', stufe: 3, ausgabenCent: 5000, limitCent: 5000 })
    expect(voll.betreff).toBe('Betrieb: Vercel-Ausgabenlimit erreicht')
    expect(voll.absaetze).toEqual([
      'Vercel meldet 50 $ von 50 $ (100 %) des Ausgabenlimits in diesem Abrechnungszeitraum.',
      'Vercel pausiert das Projekt – die Seite ist offline, bis du fortsetzt oder das Limit erhöhst.',
    ])
    const halb = betriebMail({ art: 'vercelAusgaben', stufe: 1, ausgabenCent: 2510, limitCent: 5000 })
    expect(halb.betreff).toBe('Betrieb: Vercel-Ausgaben ab 50 %')
    expect(halb.absaetze[1]).toMatch(/^Bei 100 % pausiert Vercel das Projekt/)
    expect(warnHinweis('vercelAusgaben', 2)).toEqual({ text: 'Vercel-Ausgaben ab 75 %', kurz: 'Vercel ab 75 %' })
  })

  it('die Warnkarte der Seite nennt die letzte Meldung und die Mail', () => {
    const jetzt = T('2026-10-25T10:00:00Z')
    const messungen = [m('2026-10-23', 'vercelAusgaben', 3800), m('2026-10-23', 'vercelLimit', 5000)]
    const [eintrag] = warnEintraege([{ art: 'vercelAusgaben', stufe: 2, gemeldetAm: T('2026-10-23T09:00:00Z') }], betriebKacheln(messungen, jetzt), [], messungen, jetzt, true)
    expect(eintrag.titel).toBe('Vercel-Ausgaben ab 75 %')
    expect(eintrag.saetze[0]).toMatch(/^Zuletzt gemeldet: 38 \$ von 50 \$ \(76 %\)/)
  })
})

describe('Warn-Mail: Bilder ohne Verwendung (Nacharbeit 104, Nr. 113)', () => {
  it('beim Bilder-Speicher nennt „Was hilft“ die Summe der Bilder ohne Verwendung — ohne gezählte Bilder der feste Satz', () => {
    const mit = betriebMail({ art: 'grenze', wert: 'bilder', anteil: 82, stand: '820 MB sind belegt', trend: null, ohneVerwendungBytes: 214_000_000 })
    expect(mit.hilft).toBe('214 MB hängen an nichts mehr, oder Vercel Pro (ohne harte Sperre).')
    const ohne = betriebMail({ art: 'grenze', wert: 'bilder', anteil: 82, stand: '820 MB sind belegt', trend: null, ohneVerwendungBytes: null })
    expect(ohne.hilft).toBe('Vercel Pro, dort gibt es keine harte Sperre.')
    // Andere Werte nennen die Bilder nie.
    expect(betriebMail({ art: 'grenze', wert: 'datenbank', anteil: 82, stand: '410 MB von 500 MB sind belegt', trend: null, ohneVerwendungBytes: 214_000_000 }).hilft).toBe('Supabase Pro mit 8 GB.')
  })
})

describe('Wachen', () => {
  it('ABLAEUFE und vercel.json nennen dieselben Abläufe mit demselben Zeitplan', () => {
    const konfig = JSON.parse(readFileSync(join(WURZEL, 'vercel.json'), 'utf8')) as { crons: Array<{ path: string; schedule: string }> }
    const ausKonfig = konfig.crons.map((c) => `${c.path} ${c.schedule}`).sort()
    expect(ABLAEUFE.map((a) => `${a.pfad} ${a.zeitplan}`).sort()).toEqual(ausKonfig)
    expect(ausKonfig).toContain('/api/cron/betrieb 0 4 * * *')
  })

  it('jeder Ablauf hat seine Route — und ruft mitHerzschlag mit seinem Namen', () => {
    for (const a of ABLAEUFE) {
      const quelle = readFileSync(join(WURZEL, 'src/app', a.pfad, 'route.ts'), 'utf8')
      expect(quelle, a.pfad).toContain(`mitHerzschlag('${a.name}'`)
    }
  })

  it('die drei Tabellen von Betrieb haben keine Textspalte außer Namen, Arten und fehlerKlasse (keine Inhalte)', () => {
    const schema = readFileSync(join(WURZEL, 'prisma/schema.prisma'), 'utf8')
    const textSpalten = (modell: string): string[] => {
      const block = new RegExp(`model ${modell} \\{([^}]*)\\}`).exec(schema)?.[1] ?? ''
      return block
        .split('\n')
        .map((z) => z.trim().split(/\s+/))
        .filter(([, typ]) => typ === 'String' || typ === 'String?' || typ === 'Json' || typ === 'Json?')
        .map(([name]) => `${modell}.${name}`)
    }
    expect(['BetriebMessung', 'AblaufLauf', 'BetriebWarnung'].flatMap(textSpalten)).toEqual([
      'BetriebMessung.art',
      'AblaufLauf.name',
      'AblaufLauf.fehlerKlasse',
      'BetriebWarnung.art',
    ])
    // Gegenprobe: die Suche findet eine Textspalte, wo es eine gibt.
    expect(textSpalten('Meldung').length).toBeGreaterThan(0)
  })

  /** Wie email.ts ein Modul einbindet: statisch (import … from) oder dynamisch (await import(…)). */
  function einbindungen(quelle: string, modul: string): { statisch: number; dynamisch: number } {
    const datei = ts.createSourceFile('email.ts', quelle, ts.ScriptTarget.Latest, true)
    let statisch = 0
    let dynamisch = 0
    const besuche = (k: ts.Node): void => {
      if (ts.isImportDeclaration(k) && ts.isStringLiteral(k.moduleSpecifier) && k.moduleSpecifier.text === modul) statisch += 1
      if (ts.isCallExpression(k) && k.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(k.arguments[0]) && k.arguments[0].text === modul) dynamisch += 1
      ts.forEachChild(k, besuche)
    }
    besuche(datei)
    return { statisch, dynamisch }
  }

  it('email.ts bindet den Mail-Zähler nur dynamisch ein und liest nie selbst Prisma (ARCHITECTURE §4, die eine Ausnahme)', () => {
    const quelle = readFileSync(join(WURZEL, 'src/lib/email.ts'), 'utf8')
    expect(einbindungen(quelle, '@/server/betrieb-zaehler')).toEqual({ statisch: 0, dynamisch: 1 })
    expect(einbindungen(quelle, '@/lib/prisma')).toEqual({ statisch: 0, dynamisch: 0 })
    expect(einbindungen(quelle, '@/server/betrieb')).toEqual({ statisch: 0, dynamisch: 0 })
  })

  it('Gegenprobe: die Suche erkennt einen statischen Import', () => {
    expect(einbindungen("import { zaehleMail } from '@/server/betrieb-zaehler'", '@/server/betrieb-zaehler')).toEqual({ statisch: 1, dynamisch: 0 })
  })
})
