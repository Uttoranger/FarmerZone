/**
 * Die Fristen einer offenen Bestellung (src/lib/fristen.ts).
 *
 * Online: 30 Minuten ab Bestellung bis zur Zahlung. Bar: 2 Stunden bis zur
 * Bestätigung per E-Mail-Link, spätestens bis zum Bestellschluss des
 * gewählten Abholfensters (= dessen Beginn) — was früher eintritt.
 *
 * Zeitpunkte sind UTC wie in der Datenbank; die Abholfenster sind Wiener
 * Ortszeit. `pickupDate` steht so in der Datenbank, wie der Checkout es auf
 * dem Server (UTC) anlegt: 12:00 des gewählten Tages.
 */
import { describe, it, expect } from 'vitest'
import {
  BESTAETIGUNGSFRIST_BAR_MINUTEN,
  ZAHLUNGSFRIST_ONLINE_MINUTEN,
  bestellschluss,
  fristVon,
  istVerwaist,
  tagInWorten,
  uhrzeitInWien,
  zeitpunktFuerMail,
  wienerZeitpunkt,
} from '@/lib/fristen'

const abholtag = (jmt: string) => new Date(`${jmt}T12:00:00Z`)

describe('Konstanten — an EINER Stelle', () => {
  it('30 Minuten online, 2 Stunden bar', () => {
    expect(ZAHLUNGSFRIST_ONLINE_MINUTEN).toBe(30)
    expect(BESTAETIGUNGSFRIST_BAR_MINUTEN).toBe(120)
  })
})

describe('wienerZeitpunkt — Ortszeit in Wien → UTC', () => {
  it('Sommerzeit: 14:00 in Wien ist 12:00 UTC', () => {
    expect(wienerZeitpunkt('2026-10-02', '14:00')?.toISOString()).toBe('2026-10-02T12:00:00.000Z')
  })

  it('Winterzeit: 14:00 in Wien ist 13:00 UTC', () => {
    expect(wienerZeitpunkt('2026-01-15', '14:00')?.toISOString()).toBe('2026-01-15T13:00:00.000Z')
  })

  it('am Tag der Umstellung auf Sommerzeit gilt schon Sommerzeit', () => {
    // 29. März 2026: um 02:00 springt die Uhr auf 03:00.
    expect(wienerZeitpunkt('2026-03-29', '14:00')?.toISOString()).toBe('2026-03-29T12:00:00.000Z')
  })

  it('am Tag der Umstellung auf Winterzeit gilt schon Winterzeit', () => {
    // 25. Oktober 2026: um 03:00 springt die Uhr auf 02:00.
    expect(wienerZeitpunkt('2026-10-25', '14:00')?.toISOString()).toBe('2026-10-25T13:00:00.000Z')
  })

  it('lehnt Unsinn ab', () => {
    expect(wienerZeitpunkt('2026-13-01', '14:00')).toBeNull()
    expect(wienerZeitpunkt('2026-10-02', '25:00')).toBeNull()
    expect(wienerZeitpunkt('gestern', '14:00')).toBeNull()
  })
})

describe('bestellschluss — Beginn des gewählten Abholfensters', () => {
  it('Abholtag aus pickupDate (Wiener Kalendertag) + Beginn in Wiener Zeit', () => {
    expect(bestellschluss(abholtag('2026-10-02'), '09:30')?.toISOString()).toBe('2026-10-02T07:30:00.000Z')
  })
})

describe('fristVon', () => {
  const bestelltAm = new Date('2026-10-01T08:00:00Z')

  it('online: 30 Minuten ab Bestellung', () => {
    const frist = fristVon({
      paymentMethod: 'ONLINE',
      createdAt: bestelltAm,
      pickupDate: abholtag('2026-10-02'),
      pickupTimeStart: '14:00',
    })
    expect(frist.toISOString()).toBe('2026-10-01T08:30:00.000Z')
  })

  it('bar: 2 Stunden ab Bestellung, wenn das Abholfenster später beginnt', () => {
    for (const paymentMethod of ['ONSITE_CASH', 'ONSITE_CARD'] as const) {
      const frist = fristVon({
        paymentMethod,
        createdAt: bestelltAm,
        pickupDate: abholtag('2026-10-02'),
        pickupTimeStart: '14:00',
      })
      expect(frist.toISOString()).toBe('2026-10-01T10:00:00.000Z')
    }
  })

  it('bar: spätestens zum Bestellschluss, wenn der früher kommt', () => {
    // Bestellt um 23:00 Wiener Zeit, Abholfenster morgen ab 00:30 —
    // zwei Stunden reichten bis 01:00, der Bestellschluss ist früher.
    const frist = fristVon({
      paymentMethod: 'ONSITE_CASH',
      createdAt: new Date('2026-10-01T21:00:00Z'),
      pickupDate: abholtag('2026-10-02'),
      pickupTimeStart: '00:30',
    })
    expect(frist.toISOString()).toBe('2026-10-01T22:30:00.000Z')
  })

  it('bar: Bestellschluss genau zwei Stunden nach der Bestellung → derselbe Zeitpunkt', () => {
    const frist = fristVon({
      paymentMethod: 'ONSITE_CASH',
      createdAt: new Date('2026-10-01T21:00:00Z'),
      pickupDate: abholtag('2026-10-02'),
      pickupTimeStart: '01:00',
    })
    expect(frist.toISOString()).toBe('2026-10-01T23:00:00.000Z')
  })

  it('bar mit unlesbarer Abholzeit: es bleibt bei den zwei Stunden', () => {
    const frist = fristVon({
      paymentMethod: 'ONSITE_CASH',
      createdAt: bestelltAm,
      pickupDate: abholtag('2026-10-02'),
      pickupTimeStart: 'kaputt',
    })
    expect(frist.toISOString()).toBe('2026-10-01T10:00:00.000Z')
  })
})

describe('istVerwaist — die Frist gilt auf die Sekunde', () => {
  const online = {
    paymentMethod: 'ONLINE' as const,
    createdAt: new Date('2026-10-01T08:00:00Z'),
    pickupDate: abholtag('2026-10-02'),
    pickupTimeStart: '14:00',
  }

  it('vor der Frist: nein, ab der Frist: ja', () => {
    expect(istVerwaist(online, new Date('2026-10-01T08:29:59Z'))).toBe(false)
    expect(istVerwaist(online, new Date('2026-10-01T08:30:00Z'))).toBe(true)
  })
})

describe('Anzeige', () => {
  it('uhrzeitInWien: „HH:MM" in Wiener Ortszeit', () => {
    expect(uhrzeitInWien(new Date('2026-10-01T12:05:00Z'))).toBe('14:05')
    expect(uhrzeitInWien(new Date('2026-01-15T07:00:00Z'))).toBe('08:00')
  })

  it('tagInWorten: heute, morgen, sonst Wochentag und Datum — alles in Wien', () => {
    const jetzt = new Date('2026-10-01T20:00:00Z') // 22:00 in Wien
    expect(tagInWorten(new Date('2026-10-01T21:30:00Z'), jetzt)).toBe('heute')
    // 00:30 in Wien ist schon der nächste Tag, obwohl UTC noch den 1. zeigt.
    expect(tagInWorten(new Date('2026-10-01T22:30:00Z'), jetzt)).toBe('morgen')
    expect(tagInWorten(new Date('2026-10-03T10:00:00Z'), jetzt)).toBe('am Samstag, 3. Oktober')
  })

  it('tagInWorten: „morgen" auch in der Nacht der Zeitumstellung', () => {
    // 28. März 2026, 23:30 in Wien (Winterzeit); die Frist um 01:30 liegt am
    // 29. März — dieser Tag hat nur 23 Stunden, +24 h landete schon am 30.
    const jetzt = new Date('2026-03-28T22:30:00Z')
    expect(tagInWorten(new Date('2026-03-29T00:30:00Z'), jetzt)).toBe('morgen')
  })
})

describe('zeitpunktFuerMail — fester Tag mit Wochentag, nie „heute"/„morgen"', () => {
  it('Wochentag, Datum und Uhrzeit in Wiener Zeit (Sommer- und Winterzeit)', () => {
    expect(zeitpunktFuerMail(new Date('2026-10-05T10:12:00Z'))).toBe('Montag, 5. Oktober, 12:12 Uhr')
    expect(zeitpunktFuerMail(new Date('2026-11-02T10:12:00Z'))).toBe('Montag, 2. November, 11:12 Uhr')
  })

  it('nach Mitternacht in Wien schon der nächste Tag, obwohl UTC noch den Vortag zeigt', () => {
    expect(zeitpunktFuerMail(new Date('2026-10-05T22:30:00Z'))).toBe('Dienstag, 6. Oktober, 00:30 Uhr')
  })
})
