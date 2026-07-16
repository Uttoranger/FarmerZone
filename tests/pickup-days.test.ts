/**
 * Tests für die "Nächste Abholung"-Tageskarten (src/lib/pickup-days.ts)
 * und die Kundenansicht-Links (src/lib/customer-links.ts).
 *
 * Beweist: Heute/Morgen/Wochentag-Labels, Heute nur solange ein Fenster
 * offen ist, Slot-Sortierung, keine Slots → leer, Maps-URL-Encoding.
 */
import { describe, it, expect } from 'vitest'
import { nextPickupDays, formatSlotTime, pickupWeekdaysLabel } from '@/lib/pickup-days'
import { buildMapsUrl, buildShareData } from '@/lib/customer-links'

// Montag, 20. Juli 2026, 10:00 (getDay() = 1)
const NOW = new Date(2026, 6, 20, 10, 0, 0)

const MI = { dayOfWeek: 3, startTime: '08:00', endTime: '18:00' }
const SA = { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' }

describe('nextPickupDays', () => {
  it('liefert die nächsten Termine mit Wochentag-Labels und Zeiten', () => {
    const days = nextPickupDays([MI, SA], 3, NOW)
    expect(days.map((d) => d.label)).toEqual(['Mi, 22. Juli', 'Sa, 25. Juli', 'Mi, 29. Juli'])
    expect(days[0].times).toBe('8–18 Uhr')
    expect(days[1].times).toBe('9–12 Uhr')
  })

  it('labelt heute als "Heute" und morgen als "Morgen"', () => {
    const days = nextPickupDays(
      [{ dayOfWeek: 1, startTime: '14:00', endTime: '18:00' }, { dayOfWeek: 2, startTime: '08:00', endTime: '12:00' }],
      2,
      NOW
    )
    expect(days.map((d) => d.label)).toEqual(['Heute', 'Morgen'])
  })

  it('überspringt Heute, wenn alle Zeitfenster schon vorbei sind', () => {
    // Montag-Slot endet 09:00, jetzt ist 10:00 → nächster Montag in einer Woche
    const days = nextPickupDays([{ dayOfWeek: 1, startTime: '07:00', endTime: '09:00' }], 1, NOW)
    expect(days[0].label).toBe('Mo, 27. Juli')
  })

  it('sortiert mehrere Fenster eines Tages nach Beginn', () => {
    const days = nextPickupDays(
      [
        { dayOfWeek: 3, startTime: '15:00', endTime: '18:00' },
        { dayOfWeek: 3, startTime: '08:00', endTime: '11:00' },
      ],
      1,
      NOW
    )
    expect(days[0].times).toBe('8–11 · 15–18 Uhr')
  })

  it('ohne Slots keine Karten', () => {
    expect(nextPickupDays([], 3, NOW)).toEqual([])
  })
})

describe('formatSlotTime', () => {
  it('kürzt volle Stunden und behält Minuten', () => {
    expect(formatSlotTime('08:00')).toBe('8')
    expect(formatSlotTime('09:30')).toBe('9:30')
    expect(formatSlotTime('18:00')).toBe('18')
  })
})

describe('pickupWeekdaysLabel', () => {
  it('nennt die Slot-Wochentage Mo-zuerst, dedupliziert', () => {
    expect(pickupWeekdaysLabel([SA, MI, MI])).toBe('Mi & Sa')
    expect(pickupWeekdaysLabel([{ dayOfWeek: 0, startTime: '08:00', endTime: '10:00' }, MI])).toBe('Mi & So')
  })
})

describe('buildMapsUrl / buildShareData', () => {
  it('baut eine korrekt encodierte Google-Maps-Suche aus der Adresse', () => {
    const url = buildMapsUrl('Hofgasse 12', '8700', 'Leoben')
    expect(url.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBe(true)
    expect(url).toContain('Hofgasse%2012%2C%208700%20Leoben')
    expect(url).not.toContain(' ')
  })

  it('Share-Daten enthalten Hofname und URL', () => {
    const data = buildShareData('Hof Müller', 'https://farmerzone.at/hof-mueller')
    expect(data.title).toBe('Hof Müller')
    expect(data.url).toBe('https://farmerzone.at/hof-mueller')
    expect(data.text).toContain('Hof Müller')
  })
})
