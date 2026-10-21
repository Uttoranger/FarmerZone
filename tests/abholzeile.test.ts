/**
 * Die Abholzeile (Register N22, Nr. 120): EINE Regel für „bestellbar" — die
 * der Kasse (istFensterBestellbar) —, die Lagen heute · morgen · Wochentag ·
 * später · Pause · keine, die Tage des Filters „Abholung", istBestellbar und
 * die Uhr im Browser (beim Hydrieren der Zeitpunkt des Servers, danach die
 * eigene Uhr, auf die Minute).
 *
 * Alle Zeitpunkte in UTC: Bis So, 25. Okt 2026 gilt in Wien Sommerzeit (+2 h).
 * Mi, 21. Okt 2026, 08:00 UTC ist also 10:00 in Wien.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Der Prüfstand für die Uhr (TESTING_GUIDELINES §1): Nur useSyncExternalStore wird
// umgeschaltet — „server" rendert wie React auf dem Server, „hydrieren" wie der
// erste Render im Browser (getServerSnapshot), „browser" danach (getSnapshot).
const uhrModus = vi.hoisted(() => ({ wert: 'echt' as 'echt' | 'hydrieren' | 'browser' }))
vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  return {
    ...echt,
    useSyncExternalStore: <T,>(abonnieren: (melden: () => void) => () => void, lesen: () => T, server?: () => T): T => {
      if (uhrModus.wert === 'browser') return lesen()
      if (uhrModus.wert === 'hydrieren' && server) return server()
      return echt.useSyncExternalStore(abonnieren, lesen, server)
    },
  }
})

import { istFensterBestellbar } from '@/lib/abholfenster'
import { abholLage, abholzeileText, holtAbAn, holtAbAnTagen, tageDerAbholwahl, type AbholFenster } from '@/lib/hofuebersicht'
import { istBestellbar } from '@/lib/bereiche-anzeige'
import { Abholzeile } from '@/components/hoefe/abholzeile'
import { abonniereUhr, aufMinute, leseUhr } from '@/components/hoefe/use-uhr'

const MITTWOCH_10 = new Date('2026-10-21T08:00:00Z')
const fenster = (dayOfWeek: number, startTime: string, endTime: string): AbholFenster => ({ dayOfWeek, startTime, endTime })
const MI_15 = fenster(3, '15:00', '18:00')

afterEach(() => {
  uhrModus.wert = 'echt'
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('istFensterBestellbar — die Regel der Kasse, jetzt auch für die Übersicht', () => {
  it('bis eine Millisekunde vor dem Beginn bestellbar, ab dem Beginn nicht mehr', () => {
    expect(istFensterBestellbar('2026-10-21', '15:00', new Date('2026-10-21T12:59:59.999Z'))).toBe(true)
    expect(istFensterBestellbar('2026-10-21', '15:00', new Date('2026-10-21T13:00:00.000Z'))).toBe(false)
  })
})

describe('abholLage — die sechs Lagen des Boards ohne „jetzt"', () => {
  it('heute, morgen, Wochentag (bis 6 Tage) und später mit Datum — mit Text im Hausformat „09:00"', () => {
    const heute = abholLage([MI_15], false, MITTWOCH_10)
    expect(heute).toMatchObject({ art: 'heute', kalendertag: '2026-10-21' })
    expect(abholzeileText(heute)).toBe('Abholung heute 15:00–18:00')

    const morgen = abholLage([fenster(4, '16:00', '18:00')], false, MITTWOCH_10)
    expect(abholzeileText(morgen)).toBe('Abholung morgen 16:00–18:00')

    const samstag = abholLage([fenster(6, '09:00', '12:00')], false, MITTWOCH_10)
    expect(samstag.art).toBe('wochentag')
    expect(abholzeileText(samstag)).toBe('Abholung Samstag 09:00–12:00')

    // Das heutige Fenster ist vorbei: Es kommt erst in einer Woche wieder — mit Datum, sonst läse es sich wie heute.
    const spaeter = abholLage([fenster(3, '08:00', '10:00')], false, MITTWOCH_10)
    expect(spaeter).toMatchObject({ art: 'spaeter', kalendertag: '2026-10-28' })
    expect(abholzeileText(spaeter)).toBe('Abholung Mi, 28. Okt 08:00–10:00')
  })

  it('beginnt das Fenster in einer Minute, ist es heute; hat es vor einer Minute begonnen, nennt sie das nächste', () => {
    expect(abholLage([MI_15], false, new Date('2026-10-21T12:59:00Z')).art).toBe('heute')
    const begonnen = abholLage([MI_15, fenster(5, '14:00', '16:00')], false, new Date('2026-10-21T13:01:00Z'))
    expect(begonnen).toMatchObject({ art: 'wochentag', fenster: { dayOfWeek: 5 } })
    // Kein „jetzt · bis 18:00": Ein laufendes Fenster kann man nicht mehr bestellen (freigegebene Abweichung).
    expect(abholzeileText(begonnen)).not.toMatch(/jetzt/)
  })

  it('um Mitternacht wird aus „morgen" „heute" — in Wiener Zeit, nicht in UTC', () => {
    const donnerstag = [fenster(4, '09:00', '12:00')]
    expect(abholLage(donnerstag, false, new Date('2026-10-21T21:59:00Z')).art).toBe('morgen') // Mi 23:59 in Wien
    expect(abholLage(donnerstag, false, new Date('2026-10-21T22:00:00Z'))).toMatchObject({ art: 'heute', kalendertag: '2026-10-22' }) // Do 00:00
  })

  // Register N19, Ergänzung 21.10.2026 (Nr. 131).
  it('ist das Fenster von heute voll, zeigt die Zeile das nächste freie; sind alle voll, wie ohne Abholzeit', () => {
    const heuteVoll = fenster(3, '11:00', '14:00')
    const lage = abholLage([{ ...heuteVoll, ausgebuchtAm: ['2026-10-21'] }, fenster(4, '09:00', '12:00')], false, MITTWOCH_10)
    expect(lage).toMatchObject({ art: 'morgen', kalendertag: '2026-10-22' })
    expect(abholzeileText(lage)).toBe('Abholung morgen 09:00–12:00')
    expect(abholLage([{ ...heuteVoll, ausgebuchtAm: ['2026-10-21', '2026-10-28'] }], false, MITTWOCH_10)).toEqual({ art: 'keine' })
  })

  it('Pause schlägt jedes Fenster; ohne Fenster — auch ohne das Feld (alter Cache-Eintrag) — „keine"', () => {
    expect(abholLage([MI_15], true, MITTWOCH_10)).toEqual({ art: 'pause' })
    expect(abholzeileText({ art: 'pause' })).toBe('Macht gerade Pause – Bestellen geht bald wieder')
    expect(abholLage([], false, MITTWOCH_10)).toEqual({ art: 'keine' })
    expect(abholLage(undefined, false, MITTWOCH_10)).toEqual({ art: 'keine' })
    expect(abholzeileText({ art: 'keine' })).toBeNull()
  })
})

describe('tageDerAbholwahl und holtAbAn — der Filter „Abholung"', () => {
  it('Wochenende = Samstag und Sonntag dieser Woche; am Samstag beide, am Sonntag nur noch Sonntag', () => {
    expect(tageDerAbholwahl('heute', MITTWOCH_10)).toEqual(['2026-10-21'])
    expect(tageDerAbholwahl('morgen', MITTWOCH_10)).toEqual(['2026-10-22'])
    expect(tageDerAbholwahl('wochenende', MITTWOCH_10)).toEqual(['2026-10-24', '2026-10-25'])
    expect(tageDerAbholwahl('wochenende', new Date('2026-10-24T08:00:00Z'))).toEqual(['2026-10-24', '2026-10-25'])
    // Sonntag, 25. Okt: der Tag der Zeitumstellung — trotzdem nur dieser Sonntag.
    expect(tageDerAbholwahl('wochenende', new Date('2026-10-25T10:00:00Z'))).toEqual(['2026-10-25'])
  })

  it('„heute" zählt nur Fenster, die man heute noch bestellen kann', () => {
    expect(holtAbAn([MI_15], ['2026-10-21'], MITTWOCH_10)).toBe(true)
    expect(holtAbAn([MI_15], ['2026-10-21'], new Date('2026-10-21T13:00:00Z'))).toBe(false)
    expect(holtAbAn([MI_15], ['2026-10-22'], MITTWOCH_10)).toBe(false)
    expect(holtAbAn(undefined, ['2026-10-21'], MITTWOCH_10)).toBe(false)
  })

  // Register N19, Ergänzung 21.10.2026 (Nr. 131): dieselbe Regel wie die Abholzeile, ohne eigenen Code.
  it('„heute" zählt einen Hof nicht mit, dessen einziges Fenster heute voll ist', () => {
    const voll = { ...MI_15, ausgebuchtAm: ['2026-10-21'] }
    const hof = { isPaused: false, angebot: [{}], abholfenster: [voll] }
    expect(holtAbAnTagen(hof, tageDerAbholwahl('heute', MITTWOCH_10), MITTWOCH_10)).toBe(false)
    expect(holtAbAnTagen({ ...hof, abholfenster: [MI_15] }, tageDerAbholwahl('heute', MITTWOCH_10), MITTWOCH_10)).toBe(true)
    // In einer Woche ist dasselbe Fenster wieder frei.
    expect(holtAbAn([voll], ['2026-10-28'], MITTWOCH_10)).toBe(true)
  })

  it('ein nicht bestellbarer oder pausierter Hof erfüllt keinen Abholung-Filter', () => {
    const hof = { isPaused: false, angebot: [{}], abholfenster: [MI_15] }
    expect(holtAbAnTagen(hof, ['2026-10-21'], MITTWOCH_10)).toBe(true)
    expect(holtAbAnTagen({ ...hof, angebot: [] }, ['2026-10-21'], MITTWOCH_10)).toBe(false)
    expect(holtAbAnTagen({ ...hof, isPaused: true }, ['2026-10-21'], MITTWOCH_10)).toBe(false)
  })
})

describe('istBestellbar — kaufbares Produkt UND kommende Abholzeit, die Pause zählt nicht hinein', () => {
  it('nur mit beidem; fehlt eines oder das Feld, nicht', () => {
    expect(istBestellbar({ angebot: [{}], abholfenster: [MI_15] })).toBe(true)
    expect(istBestellbar({ angebot: [], abholfenster: [MI_15] })).toBe(false)
    expect(istBestellbar({ angebot: [{}], abholfenster: [] })).toBe(false)
    expect(istBestellbar({ angebot: [{}] })).toBe(false)
  })
})

describe('Abholzeile — die Zeile mit der Uhr im Browser', () => {
  const zeile = (props: Partial<Parameters<typeof Abholzeile>[0]> = {}) =>
    renderToStaticMarkup(createElement(Abholzeile, { fenster: [MI_15], isPaused: false, jetzt: MITTWOCH_10.toISOString(), ...props }))

  it('auf dem Server rechnet sie mit dem Zeitpunkt der Seite, im Browser danach mit der eigenen Uhr', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-22T06:30:00Z')) // Do 08:30 in Wien — die Seite ist einen Tag alt
    expect(zeile()).toContain('Abholung heute 15:00–18:00')
    uhrModus.wert = 'browser'
    expect(zeile()).toContain('Abholung Mittwoch 15:00–18:00')
  })

  it('nach Mitternacht sagt eine alte Seite im Browser „heute" statt „morgen"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T22:10:00Z')) // Do 00:10 in Wien
    const donnerstag = { fenster: [fenster(4, '09:00', '12:00')], jetzt: '2026-10-21T21:50:00.000Z' } // gebaut Mi 23:50
    expect(zeile(donnerstag)).toContain('Abholung morgen 09:00–12:00')
    uhrModus.wert = 'browser'
    expect(zeile(donnerstag)).toContain('Abholung heute 09:00–12:00')
  })

  it('kein Hydrationsfehler: Der erste Render im Browser gleicht dem Server-HTML, gleich wie die Uhr des Browsers steht', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-25T18:00:00Z'))
    const server = zeile()
    uhrModus.wert = 'hydrieren'
    expect(zeile()).toBe(server)
    // Gegenprobe: Mit der Uhr des Browsers käme etwas anderes heraus.
    uhrModus.wert = 'browser'
    expect(zeile()).not.toBe(server)
  })

  it('grün mit Uhr, Pause orange, ohne kaufbares Produkt oder ohne Abholzeiten grau „Noch nicht bestellbar"', () => {
    const offen = zeile()
    expect(offen).toContain('text-status-fertig')
    expect(offen).toContain('lucide-clock')
    expect(zeile({ isPaused: true })).toContain('text-status-offen')
    expect(zeile({ isPaused: true, bestellbar: false })).toContain('Macht gerade Pause')
    expect(zeile({ bestellbar: false })).toContain('Noch nicht bestellbar')
    expect(zeile({ fenster: undefined })).toContain('Noch nicht bestellbar')
    expect(zeile({ bestellbar: false })).not.toContain('lucide-clock')
  })
})

describe('die Uhr: auf die Minute, ein Takt für alle Zeilen', () => {
  it('leseUhr rundet auf die volle Minute — dieselbe Zahl, solange die Minute läuft', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T08:00:42.500Z'))
    expect(leseUhr()).toBe(Date.parse('2026-10-21T08:00:00Z'))
    vi.setSystemTime(new Date('2026-10-21T08:00:59.999Z'))
    expect(leseUhr()).toBe(Date.parse('2026-10-21T08:00:00Z'))
    expect(aufMinute(Date.parse('2026-10-21T08:01:00.001Z'))).toBe(Date.parse('2026-10-21T08:01:00Z'))
  })

  it('abonniert meldet im Takt, nach dem Abmelden nicht mehr', () => {
    vi.useFakeTimers()
    vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
    const melden = vi.fn()
    const abmelden = abonniereUhr(melden)
    vi.advanceTimersByTime(60_000)
    expect(melden.mock.calls.length).toBeGreaterThanOrEqual(3)
    abmelden()
    melden.mockClear()
    vi.advanceTimersByTime(60_000)
    expect(melden).not.toHaveBeenCalled()
  })
})
