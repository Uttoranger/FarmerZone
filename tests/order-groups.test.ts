/**
 * Tests für die Abholtag-Gruppierung der Bestellliste (src/lib/order-groups.ts).
 *
 * Beweist: heutige Gruppe zuerst, saubere Tagesgrenzen, Sortierung nach
 * Slot-Beginn innerhalb des Tages, leere Eingabe → leeres Ergebnis,
 * deutsche Labels (Heute/Morgen/Wochentag) — alles nach dem WIENER Tag, nie nach der
 * Serveruhr (Nr. 118): Die Zeitpunkte stehen mit Wiener Offset im Test, nicht als `new Date(y, m, d)`.
 */
import { describe, it, expect } from 'vitest'
import { groupOrdersByPickupDay, pickupDayLabel } from '@/lib/order-groups'

/** Ein Zeitpunkt im Juli 2026 in Wiener Sommerzeit (UTC+2) — unabhängig von der Zeitzone des Rechners. */
function wien(tag: number, stunde = 12, minute = 0): Date {
  return new Date(`2026-07-${String(tag).padStart(2, '0')}T${String(stunde).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+02:00`)
}

// Fixe "Jetzt"-Zeit: Montag, 20. Juli 2026, 10:00 in Wien
const NOW = wien(20, 10)

function order(day: number, start: string, id: string) {
  return { id, pickupDate: wien(day), pickupTimeStart: start }
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
    const lateToday = { id: 'x', pickupDate: wien(20, 23, 59), pickupTimeStart: '18:00' }
    const earlyTomorrow = { id: 'y', pickupDate: wien(21, 0, 1), pickupTimeStart: '08:00' }
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
      [{ id: 'z', pickupDate: wien(20).toISOString(), pickupTimeStart: '10:00' }],
      NOW
    )
    expect(groups[0].label).toBe('Heute')
  })
})

describe('pickupDayLabel', () => {
  it('liefert Heute/Morgen/deutschen Wochentag', () => {
    expect(pickupDayLabel(wien(20), NOW)).toBe('Heute')
    expect(pickupDayLabel(wien(21), NOW)).toBe('Morgen')
    expect(pickupDayLabel(wien(25), NOW)).toBe('Samstag, 25. Juli')
  })

  it('zählt den Wiener Tag, auch wenn es auf dem Server (UTC) noch gestern ist', () => {
    // 0:30 Uhr in Wien am 21. Juli = 22:30 Uhr UTC am 20. Juli: Der Hof steht schon im neuen Tag.
    const nachMitternacht = wien(21, 0, 30)
    expect(nachMitternacht.getUTCDate()).toBe(20)
    expect(pickupDayLabel(wien(21), nachMitternacht)).toBe('Heute')
    expect(pickupDayLabel(wien(22), nachMitternacht)).toBe('Morgen')
    expect(pickupDayLabel(wien(20), nachMitternacht)).toBe('Montag, 20. Juli')
  })

  it('ordnet eine Abholung um 0:30 Uhr in Wien dem Wiener Tag zu, nicht dem UTC-Tag davor', () => {
    const groups = groupOrdersByPickupDay([{ id: 'n', pickupDate: wien(21, 0, 30), pickupTimeStart: '08:00' }], NOW)
    expect(groups[0].key).toBe('2026-07-21')
    expect(groups[0].label).toBe('Morgen')
  })

  it('"Morgen" folgt dem Kalender, nicht 24 Stunden (Nacht der Zeitumstellung)', () => {
    // 25. Oktober 2026: Sommerzeit endet, der Tag hat 25 Stunden. Jetzt: 23:30 Uhr am 24. Oktober (UTC+2).
    const jetzt = new Date('2026-10-24T23:30:00+02:00')
    expect(pickupDayLabel(new Date('2026-10-25T12:00:00+01:00'), jetzt)).toBe('Morgen')
    expect(pickupDayLabel(new Date('2026-10-26T12:00:00+01:00'), jetzt)).toBe('Montag, 26. Oktober')
  })
})
