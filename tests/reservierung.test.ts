/**
 * Tests für die Reservierungsfrist (src/lib/reservierung.ts, Bug-Report
 * Befund 3). Reine Regeln, ohne Datenbank: Was gilt noch, was wurde weniger,
 * was ist weg — und war die eigene, verfallene Reservierung der Grund.
 */
import { describe, it, expect } from 'vitest'
import {
  pruefeWarenkorb,
  befundMeldung,
  istGueltig,
  neueFrist,
  RESERVIERUNG_TTL_MS,
  RESERVIERUNG_ABGELAUFEN,
  type Bestandslage,
} from '@/lib/reservierung'

const JETZT = new Date('2026-09-20T10:00:00Z')
const spaeter = (ms: number) => new Date(JETZT.getTime() + ms)

const lage = (productId: string, verfuegbar: number, verkaeuflich = true): Bestandslage => ({
  productId,
  verfuegbar,
  verkaeuflich,
})

describe('istGueltig', () => {
  it('gilt, solange die Frist in der Zukunft liegt', () => {
    expect(istGueltig({ productId: 'p', quantity: 1, expiresAt: spaeter(1000) }, JETZT)).toBe(true)
  })

  it('gilt nicht mehr im Moment des Ablaufs und danach', () => {
    expect(istGueltig({ productId: 'p', quantity: 1, expiresAt: JETZT }, JETZT)).toBe(false)
    expect(istGueltig({ productId: 'p', quantity: 1, expiresAt: spaeter(-1) }, JETZT)).toBe(false)
  })

  it('eine fehlende Reservierung ist wie eine verfallene', () => {
    expect(istGueltig(undefined, JETZT)).toBe(false)
  })
})

describe('pruefeWarenkorb — alles in Ordnung', () => {
  it('lässt einen gültigen Warenkorb unangetastet', () => {
    const b = pruefeWarenkorb(
      [{ productId: 'p1', quantity: 2 }],
      [{ productId: 'p1', quantity: 2, expiresAt: spaeter(60_000) }],
      [lage('p1', 5)],
      JETZT
    )
    expect(b.etwasAbgelaufen).toBe(false)
    expect(b.etwasGeaendert).toBe(false)
    expect(b.positionen[0]).toEqual({ productId: 'p1', gewuenscht: 2, moeglich: 2, abgelaufen: false, zustand: 'ok' })
    expect(befundMeldung(b)).toBeNull()
  })
})

describe('pruefeWarenkorb — Frist verfallen', () => {
  it('merkt die verfallene Reservierung an, lässt die Menge aber stehen, wenn der Bestand reicht', () => {
    const b = pruefeWarenkorb(
      [{ productId: 'p1', quantity: 2 }],
      [{ productId: 'p1', quantity: 2, expiresAt: spaeter(-1000) }],
      [lage('p1', 5)],
      JETZT
    )
    expect(b.etwasAbgelaufen).toBe(true)
    expect(b.etwasGeaendert).toBe(false)
    expect(b.positionen[0].moeglich).toBe(2)
    expect(b.positionen[0].zustand).toBe('ok')
    // Der Warenkorb bleibt sichtbar, die Kundin erfährt trotzdem den Grund.
    expect(befundMeldung(b)).toBe(RESERVIERUNG_ABGELAUFEN)
  })

  it('kürzt, wenn in der Zwischenzeit jemand anderes zugegriffen hat', () => {
    const b = pruefeWarenkorb(
      [{ productId: 'p1', quantity: 5 }],
      [{ productId: 'p1', quantity: 5, expiresAt: spaeter(-1000) }],
      [lage('p1', 2)],
      JETZT
    )
    expect(b.positionen[0]).toMatchObject({ moeglich: 2, abgelaufen: true, zustand: 'gekuerzt' })
    expect(b.etwasGeaendert).toBe(true)
    expect(befundMeldung(b)).toContain(RESERVIERUNG_ABGELAUFEN)
    expect(befundMeldung(b)).toContain('angepasst')
  })

  it('entfernt, wenn nichts mehr da ist', () => {
    const b = pruefeWarenkorb(
      [{ productId: 'p1', quantity: 3 }],
      [{ productId: 'p1', quantity: 3, expiresAt: spaeter(-1000) }],
      [lage('p1', 0)],
      JETZT
    )
    expect(b.positionen[0]).toMatchObject({ moeglich: 0, zustand: 'weg' })
    expect(befundMeldung(b)).toContain('entfernt')
  })

  it('eine fehlende Reservierung zählt wie eine verfallene', () => {
    const b = pruefeWarenkorb([{ productId: 'p1', quantity: 1 }], [], [lage('p1', 9)], JETZT)
    expect(b.etwasAbgelaufen).toBe(true)
    expect(b.positionen[0].moeglich).toBe(1)
  })
})

describe('pruefeWarenkorb — Produkt weg', () => {
  it('entfernt ein gelöschtes Produkt, auch bei gültiger Reservierung', () => {
    const b = pruefeWarenkorb(
      [{ productId: 'weg', quantity: 1 }],
      [{ productId: 'weg', quantity: 1, expiresAt: spaeter(60_000) }],
      [],
      JETZT
    )
    expect(b.positionen[0]).toMatchObject({ moeglich: 0, zustand: 'weg', abgelaufen: false })
    expect(b.etwasGeaendert).toBe(true)
  })

  it('entfernt ein abgeschaltetes Produkt', () => {
    const b = pruefeWarenkorb(
      [{ productId: 'p1', quantity: 1 }],
      [{ productId: 'p1', quantity: 1, expiresAt: spaeter(60_000) }],
      [lage('p1', 5, false)],
      JETZT
    )
    expect(b.positionen[0].zustand).toBe('weg')
  })
})

describe('pruefeWarenkorb — mehrere Positionen', () => {
  it('bewertet jede Position für sich und meldet die Summe', () => {
    const b = pruefeWarenkorb(
      [
        { productId: 'ok', quantity: 1 },
        { productId: 'kurz', quantity: 5 },
        { productId: 'weg', quantity: 2 },
      ],
      [
        { productId: 'ok', quantity: 1, expiresAt: spaeter(60_000) },
        { productId: 'kurz', quantity: 5, expiresAt: spaeter(-1) },
      ],
      [lage('ok', 3), lage('kurz', 1), lage('weg', 0)],
      JETZT
    )
    expect(b.positionen.map((p) => p.zustand)).toEqual(['ok', 'gekuerzt', 'weg'])
    expect(b.etwasAbgelaufen).toBe(true)
    expect(b.etwasGeaendert).toBe(true)
    const m = befundMeldung(b)
    expect(m).toContain('Eine Position ist nicht mehr verfügbar')
    expect(m).toContain('Eine Menge wurde')
  })

  it('zählt mehrere entfernte Positionen im Plural', () => {
    const b = pruefeWarenkorb(
      [
        { productId: 'a', quantity: 1 },
        { productId: 'b', quantity: 1 },
      ],
      [],
      [lage('a', 0), lage('b', 0)],
      JETZT
    )
    expect(befundMeldung(b)).toContain('2 Positionen sind nicht mehr verfügbar')
  })

  it('leerer Warenkorb: nichts zu melden', () => {
    const b = pruefeWarenkorb([], [], [], JETZT)
    expect(b.etwasAbgelaufen).toBe(false)
    expect(befundMeldung(b)).toBeNull()
  })
})

describe('neueFrist', () => {
  it('setzt die Frist fünfzehn Minuten in die Zukunft', () => {
    expect(neueFrist(JETZT).getTime() - JETZT.getTime()).toBe(RESERVIERUNG_TTL_MS)
    expect(RESERVIERUNG_TTL_MS).toBe(15 * 60 * 1000)
  })
})
