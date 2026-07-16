/**
 * Tests für die Abholtag-Gruppierung der Bestellliste (src/lib/order-groups.ts).
 *
 * Beweist: heutige Gruppe zuerst, saubere Tagesgrenzen, Sortierung nach
 * Slot-Beginn innerhalb des Tages, leere Eingabe → leeres Ergebnis,
 * deutsche Labels (Heute/Morgen/Wochentag).
 */
import { describe, it, expect } from 'vitest'
import { groupOrdersByPickupDay, pickupDayLabel } from '@/lib/order-groups'

// Fixe "Jetzt"-Zeit: Montag, 20. Juli 2026, 10:00
const NOW = new Date(2026, 6, 20, 10, 0, 0)

function order(day: number, start: string, id: string) {
  return { id, pickupDate: new Date(2026, 6, day, 12, 0, 0), pickupTimeStart: start }
}

describe('groupOrdersByPickupDay', () => {
  it('stellt die heutige Gruppe an den Anfang, auch wenn andere Tage früher wären', () => {
    const groups = groupOrdersByPickupDay(
      [order(22, '09:00', 'a'), order(20, '14:00', 'b'), order(21, '09:00', 'c')],
      NOW
    )
    expect(groups.map((g) => g.label)).toEqual(['Heute', 'Morgen', 'Mittwoch, 22. Juli'])
  })

  it('sortiert innerhalb eines Tages nach Slot-Beginn', () => {
    const groups = groupOrdersByPickupDay(
      [order(20, '16:00', 'spät'), order(20, '08:00', 'früh'), order(20, '12:00', 'mittag')],
      NOW
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].orders.map((o) => o.id)).toEqual(['früh', 'mittag', 'spät'])
  })

  it('respektiert Tagesgrenzen: 23:59 und 00:01 des Folgetags sind getrennte Gruppen', () => {
    const lateToday = { id: 'x', pickupDate: new Date(2026, 6, 20, 23, 59), pickupTimeStart: '18:00' }
    const earlyTomorrow = { id: 'y', pickupDate: new Date(2026, 6, 21, 0, 1), pickupTimeStart: '08:00' }
    const groups = groupOrdersByPickupDay([lateToday, earlyTomorrow], NOW)
    expect(groups.map((g) => g.label)).toEqual(['Heute', 'Morgen'])
    expect(groups[0].orders.map((o) => o.id)).toEqual(['x'])
    expect(groups[1].orders.map((o) => o.id)).toEqual(['y'])
  })

  it('leere Eingabe ergibt leeres Ergebnis (Tage ohne Bestellungen erscheinen nicht)', () => {
    expect(groupOrdersByPickupDay([], NOW)).toEqual([])
  })

  it('vergangene Tage bleiben chronologisch hinter Heute einsortiert', () => {
    const groups = groupOrdersByPickupDay(
      [order(18, '09:00', 'alt'), order(20, '09:00', 'heute')],
      NOW
    )
    expect(groups[0].label).toBe('Heute')
    expect(groups[1].label).toBe('Samstag, 18. Juli')
  })

  it('akzeptiert ISO-Strings als pickupDate (RSC-Serialisierung)', () => {
    const groups = groupOrdersByPickupDay(
      [{ id: 'z', pickupDate: new Date(2026, 6, 20, 12).toISOString(), pickupTimeStart: '10:00' }],
      NOW
    )
    expect(groups[0].label).toBe('Heute')
  })
})

describe('pickupDayLabel', () => {
  it('liefert Heute/Morgen/deutschen Wochentag', () => {
    expect(pickupDayLabel(new Date(2026, 6, 20), NOW)).toBe('Heute')
    expect(pickupDayLabel(new Date(2026, 6, 21), NOW)).toBe('Morgen')
    expect(pickupDayLabel(new Date(2026, 6, 25), NOW)).toBe('Samstag, 25. Juli')
  })
})
