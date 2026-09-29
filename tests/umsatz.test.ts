/**
 * Tests für die EINE Umsatzregel (src/lib/umsatz.ts) — Heute, Verkauf und
 * Auswertung rechnen damit.
 *
 * Beweist:
 *  - Wochen, Monate und Jahre beginnen um Wiener Mitternacht, auch über die
 *    Zeitumstellung; 0:30 Uhr Wien gehört schon zum neuen Tag und Monat.
 *  - Der Vergleich ist fair: bis zum selben Zeitpunkt der Vorperiode; gibt es
 *    den Tag dort nicht (31. März, 29. Februar), gilt der letzte Tag ganz.
 *  - Manuelle Verkäufe zählen nach ihrem Wiener Tag — auch vor 12 Uhr, obwohl
 *    sie um 12:00 gespeichert sind; Datenbankbedingung und Speicherregel
 *    sagen dasselbe.
 *  - Balken, Kanäle, Vergleichssatz, Einsichtssatz und Top-Produkte.
 */
import { describe, it, expect } from 'vitest'
import {
  auswerten,
  eimerDerPeriode,
  einsichtSatz,
  summeCent,
  topProdukte,
  umsatzfenster,
  umsatzVerkaufWhere,
  vergleichssatz,
  zaehltBestellung,
  zaehltVerkauf,
  zeitraumName,
  type UmsatzBuchung,
} from '@/lib/umsatz'

const iso = (d: Date) => d.toISOString()
/** Manuelle Verkäufe stehen um 12:00 UTC ihres Tages. */
const verkauf = (tag: string, cent: number, kanal = 'HOFLADEN'): UmsatzBuchung => ({
  quelle: 'verkauf',
  zeitpunkt: new Date(`${tag}T12:00:00Z`),
  cent,
  kanal,
})
const bestellung = (zeitpunkt: string, cent: number): UmsatzBuchung => ({
  quelle: 'bestellung',
  zeitpunkt: new Date(zeitpunkt),
  cent,
})

describe('umsatzfenster Woche — Vorwoche bis zum selben Wochentag und zur selben Uhrzeit', () => {
  it('Mittwoch 14:30 gegen den Mittwoch davor, 14:30', () => {
    const jetzt = new Date('2026-09-30T12:30:00Z')
    const { aktuell, vergleich } = umsatzfenster('woche', jetzt)
    expect(iso(aktuell.von)).toBe('2026-09-27T22:00:00.000Z')
    expect(aktuell.bis).toBe(jetzt)
    expect(iso(vergleich.von)).toBe('2026-09-20T22:00:00.000Z')
    expect(iso(vergleich.bis)).toBe('2026-09-23T12:30:00.000Z')
  })

  it('über die Zeitumstellung bleibt es 14:30 Wiener Zeit', () => {
    const { aktuell, vergleich } = umsatzfenster('woche', new Date('2026-10-28T13:30:00Z'))
    expect(iso(aktuell.von)).toBe('2026-10-25T23:00:00.000Z')
    expect(iso(vergleich.von)).toBe('2026-10-18T22:00:00.000Z')
    expect(iso(vergleich.bis)).toBe('2026-10-21T12:30:00.000Z')
  })

  it('am 25-Stunden-Sonntag reicht die Vorwoche nicht in diese Woche hinein', () => {
    const { aktuell, vergleich } = umsatzfenster('woche', new Date('2026-10-25T22:30:00Z'))
    expect(iso(aktuell.von)).toBe('2026-10-18T22:00:00.000Z')
    expect(iso(vergleich.von)).toBe('2026-10-11T22:00:00.000Z')
    expect(iso(vergleich.bis)).toBe('2026-10-18T21:59:59.999Z')
  })

  it('Montag 0:30 Wien: die Woche hat eben erst begonnen', () => {
    const { aktuell, vergleich } = umsatzfenster('woche', new Date('2026-10-04T22:30:00Z'))
    expect(iso(aktuell.von)).toBe('2026-10-04T22:00:00.000Z')
    expect(iso(vergleich.von)).toBe('2026-09-27T22:00:00.000Z')
    expect(iso(vergleich.bis)).toBe('2026-09-27T22:30:00.000Z')
  })

  it('eine vergangene Woche zählt ganz und vergleicht mit der ganzen davor', () => {
    const pf = umsatzfenster('woche', new Date('2026-09-30T12:30:00Z'), 1)
    expect(pf.laufend).toBe(false)
    expect(iso(pf.aktuell.von)).toBe('2026-09-20T22:00:00.000Z')
    expect(iso(pf.aktuell.bis)).toBe('2026-09-27T21:59:59.999Z')
    expect(iso(pf.vergleich.von)).toBe('2026-09-13T22:00:00.000Z')
    expect(iso(pf.vergleich.bis)).toBe('2026-09-20T21:59:59.999Z')
  })
})

describe('umsatzfenster Monat und Jahr', () => {
  it('29. September 14:30 gegen den 29. August 14:30', () => {
    const { aktuell, vergleich, startTag, vergleichStartTag } = umsatzfenster('monat', new Date('2026-09-29T12:30:00Z'))
    expect(startTag).toBe('2026-09-01')
    expect(vergleichStartTag).toBe('2026-08-01')
    expect(iso(aktuell.von)).toBe('2026-08-31T22:00:00.000Z')
    expect(iso(vergleich.von)).toBe('2026-07-31T22:00:00.000Z')
    expect(iso(vergleich.bis)).toBe('2026-08-29T12:30:00.000Z')
  })

  it('am 31. März gilt der ganze Februar — einen 31. Februar gibt es nicht', () => {
    const { vergleich } = umsatzfenster('monat', new Date('2026-03-31T10:00:00Z'))
    expect(iso(vergleich.von)).toBe('2026-01-31T23:00:00.000Z')
    expect(iso(vergleich.bis)).toBe('2026-02-28T22:59:59.999Z')
  })

  it('Jänner vergleicht mit dem Dezember des Vorjahres', () => {
    const pf = umsatzfenster('monat', new Date('2027-01-10T09:00:00Z'))
    expect(pf.vergleichStartTag).toBe('2026-12-01')
    expect(iso(pf.vergleich.bis)).toBe('2026-12-10T09:00:00.000Z')
  })

  it('am 29. Februar zählt im Vorjahr der ganze 28. Februar', () => {
    const { aktuell, vergleich } = umsatzfenster('jahr', new Date('2028-02-29T10:00:00Z'))
    expect(iso(aktuell.von)).toBe('2027-12-31T23:00:00.000Z')
    expect(iso(vergleich.von)).toBe('2026-12-31T23:00:00.000Z')
    expect(iso(vergleich.bis)).toBe('2027-02-28T22:59:59.999Z')
  })
})

describe('Zählregel an den Grenzen', () => {
  it('0:30 Uhr Wien am 1. Oktober gehört zum Oktober, 23:59 am 30. September zum September', () => {
    const jetzt = new Date('2026-10-01T08:00:00Z')
    const oktober = umsatzfenster('monat', jetzt).aktuell
    const september = umsatzfenster('monat', jetzt, 1).aktuell
    const nachMitternacht = new Date('2026-09-30T22:30:00Z')
    const vorMitternacht = new Date('2026-09-30T21:59:59Z')
    expect(zaehltBestellung(nachMitternacht, oktober)).toBe(true)
    expect(zaehltBestellung(nachMitternacht, september)).toBe(false)
    expect(zaehltBestellung(vorMitternacht, september)).toBe(true)
    expect(zaehltBestellung(vorMitternacht, oktober)).toBe(false)
  })

  it('ein Verkauf vom 30. September bleibt im September, auch wenn schon Oktober ist', () => {
    const jetzt = new Date('2026-10-01T08:00:00Z')
    const buchungen = [verkauf('2026-09-30', 2450), verkauf('2026-10-01', 1000)]
    expect(summeCent(buchungen, umsatzfenster('monat', jetzt, 1).aktuell)).toBe(2450)
    expect(summeCent(buchungen, umsatzfenster('monat', jetzt).aktuell)).toBe(1000)
  })

  it('ein heute eingetragener Verkauf zählt schon um 9 Uhr, obwohl er um 12:00 steht', () => {
    const jetzt = new Date('2026-09-29T07:00:00Z')
    expect(zaehltVerkauf(new Date('2026-09-29T12:00:00Z'), umsatzfenster('woche', jetzt).aktuell)).toBe(true)
  })

  it('ein Verkauf vom Vergleichstag zählt im fairen Vergleich — der ganze Tag', () => {
    // Mittwoch 9 Uhr: der Verkauf vom Mittwoch davor steht um 12:00, zählt aber.
    const pf = umsatzfenster('woche', new Date('2026-09-30T07:00:00Z'))
    expect(summeCent([verkauf('2026-09-23', 500), verkauf('2026-09-24', 700)], pf.vergleich)).toBe(500)
  })

  it('die Datenbankbedingung umfasst genau die Wiener Tage des Fensters', () => {
    const fenster = umsatzfenster('monat', new Date('2026-10-01T08:00:00Z'), 1).aktuell
    const bedingung = umsatzVerkaufWhere('hof', fenster).saleDate as { gte: Date; lt: Date }
    expect(iso(bedingung.gte)).toBe('2026-08-31T22:00:00.000Z')
    expect(iso(bedingung.lt)).toBe('2026-09-30T22:00:00.000Z')
  })
})

describe('eimerDerPeriode', () => {
  it('Woche: sieben Tage ab Montag', () => {
    const eimer = eimerDerPeriode('woche', '2026-09-28')
    expect(eimer.map((e) => e.label)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
    expect(eimer[6].vonTag).toBe('2026-10-04')
  })

  it('Monat: fünf Abschnitte, im Februar bleibt „ab 29." leer', () => {
    const feb = eimerDerPeriode('monat', '2026-02-01')
    expect(feb.map((e) => e.label)).toEqual(['1.–7.', '8.–14.', '15.–21.', '22.–28.', 'ab 29.'])
    expect(feb[4].vonTag > feb[4].bisTag).toBe(true)
    expect(eimerDerPeriode('monat', '2026-08-01')[4]).toEqual({ label: 'ab 29.', vonTag: '2026-08-29', bisTag: '2026-08-31' })
  })

  it('Jahr: zwölf Monate, österreichisch', () => {
    const jahr = eimerDerPeriode('jahr', '2026-01-01')
    expect(jahr).toHaveLength(12)
    expect(jahr[0].label).toBe('Jän')
    expect(jahr[1].bisTag).toBe('2026-02-28')
  })
})

describe('auswerten', () => {
  const jetzt = new Date('2026-09-30T12:30:00Z') // Mittwoch
  const pf = umsatzfenster('woche', jetzt)
  const buchungen: UmsatzBuchung[] = [
    verkauf('2026-09-28', 3000, 'HOFLADEN'),
    verkauf('2026-09-29', 1000, 'MARKT'),
    bestellung('2026-09-30T08:00:00Z', 1000),
    // Vorwoche: Montag zählt im fairen Vergleich, Freitag nur im blassen Balken
    verkauf('2026-09-21', 2000),
    verkauf('2026-09-25', 4000),
  ]

  it('Summe, fairer Vergleich und Balken mit ganzer Vorwoche', () => {
    const a = auswerten(buchungen, pf)
    expect(a.summeCent).toBe(5000)
    expect(a.vergleichCent).toBe(2000)
    expect(a.balken.map((b) => b.cent)).toEqual([3000, 1000, 1000, 0, 0, 0, 0])
    expect(a.balken.map((b) => b.vergleichCent)).toEqual([2000, 0, 0, 0, 4000, 0, 0])
  })

  it('Kanäle nach Betrag, mit Anteil', () => {
    const a = auswerten(buchungen, pf)
    expect(a.kanaele.map((k) => [k.kanal, k.anteilProzent])).toEqual([
      ['HOFLADEN', 60],
      ['MARKT', 20],
      ['PLATFORM', 20],
    ])
  })
})

describe('vergleichssatz', () => {
  const laufend = umsatzfenster('monat', new Date('2026-09-29T12:30:00Z'))

  it('mehr und weniger in Worten, gerundet', () => {
    expect(vergleichssatz(laufend, 11200, 10000)).toEqual({ richtung: 'mehr', text: '▲ 12 % mehr als im August' })
    expect(vergleichssatz(laufend, 9500, 10000)).toEqual({ richtung: 'weniger', text: '▼ 5 % weniger als im August' })
  })

  it('gleich und fast gleich', () => {
    expect(vergleichssatz(laufend, 10000, 10000).text).toBe('Genauso viel wie im August')
    expect(vergleichssatz(laufend, 10020, 10000)).toEqual({ richtung: 'gleich', text: 'Etwa gleich viel wie im August' })
  })

  it('ohne Vorperiode kein Prozent', () => {
    const jahr = umsatzfenster('jahr', new Date('2026-09-29T12:30:00Z'))
    expect(vergleichssatz(jahr, 5000, 0)).toEqual({ richtung: 'keiner', text: 'Noch kein Vorjahr zum Vergleich' })
    expect(vergleichssatz(laufend, 5000, 0).text).toBe('Noch kein Vormonat zum Vergleich')
  })

  it('Woche: laufend „letzte Woche", vergangen „in der Woche davor"; Jahr mit Jahreszahl', () => {
    const jetzt = new Date('2026-09-29T12:30:00Z')
    expect(vergleichssatz(umsatzfenster('woche', jetzt), 200, 100).text).toBe('▲ 100 % mehr als letzte Woche')
    expect(vergleichssatz(umsatzfenster('woche', jetzt, 2), 50, 100).text).toBe('▼ 50 % weniger als in der Woche davor')
    expect(vergleichssatz(umsatzfenster('jahr', jetzt), 150, 100).text).toBe('▲ 50 % mehr als 2025')
  })

  it('Jänner heißt Jänner', () => {
    expect(vergleichssatz(umsatzfenster('monat', new Date('2026-02-10T09:00:00Z')), 150, 100).text).toBe(
      '▲ 50 % mehr als im Jänner'
    )
  })
})

describe('einsichtSatz', () => {
  it('stärkster Kanal mit Anteil und bester Wochentag', () => {
    const pf = umsatzfenster('woche', new Date('2026-10-04T12:00:00Z'))
    const a = auswerten([verkauf('2026-09-28', 2000, 'HOFLADEN'), verkauf('2026-10-03', 12000, 'HOFLADEN'), verkauf('2026-10-02', 6000, 'MARKT')], pf)
    expect(einsichtSatz('woche', a)).toBe('Am meisten kam über den Hofladen (70 %), der stärkste Tag war der Samstag mit € 120,00.')
  })

  it('ein Kanal, ein Tag: kein Tagesbefund', () => {
    const pf = umsatzfenster('woche', new Date('2026-10-04T12:00:00Z'))
    expect(einsichtSatz('woche', auswerten([bestellung('2026-10-01T10:00:00Z', 900)], pf))).toBe('Alles kam über die Plattform.')
  })

  it('Monat nennt den Tag mit Datum, Jahr den Monat', () => {
    const monat = umsatzfenster('monat', new Date('2026-09-29T12:00:00Z'))
    const a = auswerten([verkauf('2026-09-12', 5000, 'MARKT'), verkauf('2026-09-13', 1000, 'WHATSAPP')], monat)
    expect(einsichtSatz('monat', a)).toBe('Am meisten kam über den Markt (83 %), der stärkste Tag war der 12. September mit € 50,00.')

    const jahr = umsatzfenster('jahr', new Date('2026-09-29T12:00:00Z'))
    const b = auswerten([verkauf('2026-05-12', 5000), verkauf('2026-05-20', 5000), verkauf('2026-06-01', 3000)], jahr)
    expect(einsichtSatz('jahr', b)).toBe('Alles kam über den Hofladen, der stärkste Monat war der Mai mit € 100,00.')
  })

  it('ohne Umsatz kein Satz', () => {
    const pf = umsatzfenster('woche', new Date('2026-10-04T12:00:00Z'))
    expect(einsichtSatz('woche', auswerten([], pf))).toBeNull()
  })
})

describe('zeitraumName', () => {
  const jetzt = new Date('2026-09-29T12:00:00Z')
  it('Woche, Monat, Jahr', () => {
    expect(zeitraumName(umsatzfenster('woche', jetzt))).toBe('Diese Woche')
    expect(zeitraumName(umsatzfenster('woche', jetzt, 1))).toBe('Letzte Woche')
    expect(zeitraumName(umsatzfenster('woche', jetzt, 2))).toBe('14.–20. Sep')
    expect(zeitraumName(umsatzfenster('woche', jetzt, 5))).toBe('24.–30. Aug')
    expect(zeitraumName(umsatzfenster('monat', jetzt))).toBe('September 2026')
    expect(zeitraumName(umsatzfenster('jahr', jetzt, 1))).toBe('2025')
  })

  it('über den Monatswechsel beide Monate', () => {
    expect(zeitraumName(umsatzfenster('woche', new Date('2026-10-14T12:00:00Z'), 2))).toBe('28. Sep – 4. Okt')
  })
})

describe('topProdukte', () => {
  it('fasst je Produkt zusammen, nach Betrag, höchstens drei', () => {
    const top = topProdukte([
      { schluessel: 'a', name: 'Eier', cent: 600, menge: 20, einheit: 'STUECK' },
      { schluessel: 'b', name: 'Kartoffeln', cent: 900, menge: 5, einheit: 'KG' },
      { schluessel: 'a', name: 'Eier', cent: 600, menge: 20, einheit: 'STUECK' },
      { schluessel: 'c', name: 'Honig', cent: 300, menge: 1, einheit: 'STUECK' },
      { schluessel: 'd', name: 'Milch', cent: 100, menge: 1, einheit: 'L' },
    ])
    expect(top).toEqual([
      { name: 'Eier', cent: 1200, menge: 40, einheit: 'STUECK' },
      { name: 'Kartoffeln', cent: 900, menge: 5, einheit: 'KG' },
      { name: 'Honig', cent: 300, menge: 1, einheit: 'STUECK' },
    ])
  })
})
