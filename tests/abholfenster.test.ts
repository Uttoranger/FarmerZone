/**
 * Die Regel der wählbaren Abholfenster (src/lib/abholfenster.ts) — rein, ohne
 * Datenbank, mit festem „jetzt".
 *
 * Beweist: Wählbar ist ein aktives Fenster mit dem Wochentag des Wiener
 * Kalendertags, dessen Beginn (Bestellschluss) noch in der Zukunft liegt, ab
 * heute und an den 13 Tagen danach. Der Wiener Kalender gilt auch dann, wenn
 * UTC noch beim Vortag ist, und am Tag der Zeitumstellung.
 */
import { describe, it, expect } from 'vitest'
import {
  abholSchluessel,
  angeboteneAbholfenster,
  findeAbholfenster,
  istVoll,
  type AbholSlot,
} from '@/lib/abholfenster'

/** Mittwoch, 7. Oktober 2026, 10:00 in Wien (Sommerzeit, UTC+2). */
const MITTWOCH_10_UHR = new Date('2026-10-07T08:00:00.000Z')

const MI = { id: 'mi', dayOfWeek: 3, startTime: '15:00', endTime: '18:00', isActive: true }
const SA = { id: 'sa', dayOfWeek: 6, startTime: '09:00', endTime: '12:00', isActive: true }

const daten = (slots: AbholSlot[], jetzt: Date) => angeboteneAbholfenster(slots, jetzt).map(abholSchluessel)

describe('angeboteneAbholfenster', () => {
  it('bietet heute an, solange das Fenster noch nicht begonnen hat', () => {
    expect(daten([MI], MITTWOCH_10_UHR)[0]).toBe('2026-10-07|15:00|18:00')
  })

  it('bietet heute nicht mehr an, sobald das Fenster begonnen hat — genau ab Beginn', () => {
    const beginn = new Date('2026-10-07T13:00:00.000Z') // 15:00 in Wien
    expect(daten([MI], beginn)[0]).toBe('2026-10-14|15:00|18:00')
    expect(daten([MI], new Date(beginn.getTime() - 60_000))[0]).toBe('2026-10-07|15:00|18:00')
  })

  it('reicht bis 13 Tage nach heute, nicht weiter', () => {
    // Mittwoch heute + nächster Mittwoch (7 Tage) — der übernächste (14 Tage) nicht mehr.
    expect(daten([MI], MITTWOCH_10_UHR)).toEqual(['2026-10-07|15:00|18:00', '2026-10-14|15:00|18:00'])
    // Dienstag heute: Samstag in 4 und in 11 Tagen; in 18 Tagen nicht.
    const dienstag = new Date('2026-10-06T08:00:00.000Z')
    expect(daten([SA], dienstag)).toEqual(['2026-10-10|09:00|12:00', '2026-10-17|09:00|12:00'])
  })

  it('lässt abgeschaltete Fenster weg', () => {
    expect(daten([{ ...MI, isActive: false }], MITTWOCH_10_UHR)).toEqual([])
  })

  it('nimmt Fenster ohne isActive (öffentliche Hofseite, schon gefiltert) als aktiv', () => {
    const ohne: AbholSlot = { dayOfWeek: MI.dayOfWeek, startTime: MI.startTime, endTime: MI.endTime }
    expect(daten([ohne], MITTWOCH_10_UHR)).toHaveLength(2)
  })

  it('sortiert nach Tag und Beginn', () => {
    const frueh = { ...MI, id: 'mi-frueh', startTime: '08:00', endTime: '10:00' }
    expect(daten([SA, MI, frueh], new Date('2026-10-07T04:00:00.000Z')).slice(0, 3)).toEqual([
      '2026-10-07|08:00|10:00',
      '2026-10-07|15:00|18:00',
      '2026-10-10|09:00|12:00',
    ])
  })

  it('rechnet mit dem Wiener Kalendertag, auch wenn UTC noch beim Vortag ist', () => {
    // 6.10. 22:30 UTC = Mittwoch 7.10. 00:30 in Wien.
    expect(daten([MI], new Date('2026-10-06T22:30:00.000Z'))[0]).toBe('2026-10-07|15:00|18:00')
  })

  it('stimmt am Tag der Zeitumstellung (Sonntag, 25. Oktober 2026)', () => {
    const so = { id: 'so', dayOfWeek: 0, startTime: '09:00', endTime: '11:00', isActive: true }
    // 08:59 Winterzeit = 07:59 UTC: noch wählbar; 09:00 = 08:00 UTC: nicht mehr.
    expect(daten([so], new Date('2026-10-25T07:59:00.000Z'))[0]).toBe('2026-10-25|09:00|11:00')
    expect(daten([so], new Date('2026-10-25T08:00:00.000Z'))[0]).toBe('2026-11-01|09:00|11:00')
  })
})

describe('findeAbholfenster', () => {
  it('findet nur die genaue Wahl — Tag, Beginn und Ende', () => {
    expect(findeAbholfenster([MI], { datum: '2026-10-07', start: '15:00', ende: '18:00' }, MITTWOCH_10_UHR)?.slot.id).toBe('mi')
    expect(findeAbholfenster([MI], { datum: '2026-10-07', start: '15:00', ende: '17:00' }, MITTWOCH_10_UHR)).toBeNull()
    expect(findeAbholfenster([MI], { datum: '2026-10-08', start: '15:00', ende: '18:00' }, MITTWOCH_10_UHR)).toBeNull()
  })
})

describe('istVoll', () => {
  it('voll erst an der Höchstzahl, ohne Höchstzahl nie', () => {
    expect(istVoll(1, 2)).toBe(false)
    expect(istVoll(2, 2)).toBe(true)
    expect(istVoll(3, 2)).toBe(true)
    expect(istVoll(1000, null)).toBe(false)
  })
})
