/**
 * Tests für die Grenzwert-Karte der Auswertung (src/lib/revenue-limit.ts).
 *
 * Beweist: Die Grenze steht auf 55.000 € (LK OÖ, Stand 2025) und die
 * Fortschritts-/Restwert-Berechnung der Karte rechnet korrekt dagegen —
 * inklusive Deckelung bei Überschreitung und der Ampel-Schwellen 75 %/95 %.
 */
import { describe, it, expect } from 'vitest'
import { PROCESSING_REVENUE_LIMIT, limitProgress } from '@/lib/revenue-limit'

describe('PROCESSING_REVENUE_LIMIT', () => {
  it('beträgt 55.000 € (LK OÖ, Stand 2025)', () => {
    expect(PROCESSING_REVENUE_LIMIT).toBe(55_000)
  })
})

describe('limitProgress', () => {
  it('startet bei 0 % mit vollem Spielraum', () => {
    expect(limitProgress(0)).toEqual({ pct: 0, remaining: 55_000 })
  })

  it('halber Umsatz ergibt 50 % und halben Spielraum', () => {
    expect(limitProgress(27_500)).toEqual({ pct: 50, remaining: 27_500 })
  })

  it('exakt an der Grenze: 100 %, kein Spielraum', () => {
    expect(limitProgress(55_000)).toEqual({ pct: 100, remaining: 0 })
  })

  it('über der Grenze: Prozent gedeckelt bei 100, Spielraum nie negativ', () => {
    expect(limitProgress(80_000)).toEqual({ pct: 100, remaining: 0 })
  })

  it('Ampel-Schwellen: 41.250 € ⇒ genau 75 %, 52.250 € ⇒ genau 95 %', () => {
    expect(limitProgress(41_250).pct).toBe(75)
    expect(limitProgress(52_250).pct).toBe(95)
  })

  it('rechnet gegen die Konstante — eine Grenzänderung schlägt automatisch durch', () => {
    const { pct, remaining } = limitProgress(PROCESSING_REVENUE_LIMIT * 0.6)
    expect(pct).toBeCloseTo(60, 10)
    expect(remaining).toBeCloseTo(PROCESSING_REVENUE_LIMIT * 0.4, 10)
  })
})
