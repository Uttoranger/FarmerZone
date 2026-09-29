/**
 * Tests für den Zeitraum der Auswertung in der URL (src/schemas/auswertung.ts).
 *
 * Beweist: Unpassendes wird verworfen, nie ein Fehler — dann gilt die laufende
 * Woche; die Adresse lässt Standardwerte weg.
 */
import { describe, it, expect } from 'vitest'
import { AUSWERTUNG_MAX_ZURUECK, auswertungHref, leseAuswertungZeitraum } from '@/schemas/auswertung'

describe('leseAuswertungZeitraum', () => {
  it('ohne Parameter die laufende Woche', () => {
    expect(leseAuswertungZeitraum({})).toEqual({ periode: 'woche', zurueck: 0 })
  })

  it('liest Periode und Schritte zurück', () => {
    expect(leseAuswertungZeitraum({ periode: 'monat', zurueck: '2' })).toEqual({ periode: 'monat', zurueck: 2 })
  })

  it('bei mehreren Werten gilt der erste', () => {
    expect(leseAuswertungZeitraum({ periode: ['jahr', 'woche'], zurueck: ['1', '5'] })).toEqual({ periode: 'jahr', zurueck: 1 })
  })

  it('verwirft Unbekanntes, Negatives, Brüche und zu weit Zurückliegendes', () => {
    expect(leseAuswertungZeitraum({ periode: 'quarter' }).periode).toBe('woche')
    expect(leseAuswertungZeitraum({ zurueck: '-1' }).zurueck).toBe(0)
    expect(leseAuswertungZeitraum({ zurueck: '1.5' }).zurueck).toBe(0)
    expect(leseAuswertungZeitraum({ zurueck: 'abc' }).zurueck).toBe(0)
    expect(leseAuswertungZeitraum({ zurueck: String(AUSWERTUNG_MAX_ZURUECK + 1) }).zurueck).toBe(0)
    expect(leseAuswertungZeitraum({ zurueck: String(AUSWERTUNG_MAX_ZURUECK) }).zurueck).toBe(AUSWERTUNG_MAX_ZURUECK)
  })
})

describe('auswertungHref', () => {
  it('lässt die Standardwerte weg', () => {
    expect(auswertungHref('woche', 0)).toBe('/analytics')
    expect(auswertungHref('monat', 0)).toBe('/analytics?periode=monat')
    expect(auswertungHref('woche', 3)).toBe('/analytics?zurueck=3')
    expect(auswertungHref('jahr', 1)).toBe('/analytics?periode=jahr&zurueck=1')
  })
})
