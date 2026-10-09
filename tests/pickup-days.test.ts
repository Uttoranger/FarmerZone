/**
 * Tests für die "Nächste Abholung"-Tageskarten (src/lib/pickup-days.ts)
 * und die Kundenansicht-Links (src/lib/customer-links.ts).
 *
 * Beweist: Heute/Morgen/Wochentag-Labels, Heute nur solange ein Fenster
 * offen ist, Slot-Sortierung, keine Slots → leer, Maps-URL-Encoding.
 */
import { describe, it, expect } from 'vitest'
import { abholtagZeile, nextPickupDays, formatSlotTime, pickupWeekdaysLabel } from '@/lib/pickup-days'
import { buildMapsUrl, buildShareData } from '@/lib/customer-links'

// Montag, 20. Juli 2026, 10:00 (getDay() = 1)
const NOW = new Date(2026, 6, 20, 10, 0, 0)

const MI = { dayOfWeek: 3, startTime: '08:00', endTime: '18:00' }
const SA = { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' }

describe('nextPickupDays', () => {
  it('liefert die nächsten Termine mit Wochentag und Datum („Sa, 25. Juli", Nr. 46) und Zeiten', () => {
    const days = nextPickupDays([MI, SA], 3, NOW)
    expect(days.map((d) => d.label)).toEqual(['Mi, 22.\u00a0Juli', 'Sa, 25.\u00a0Juli', 'Mi, 29.\u00a0Juli'])
    expect(days.map((d) => d.datum)).toEqual(days.map((d) => d.label))
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
    // Auch heute und morgen tragen ihr Datum (Nr. 46).
    expect(days.map((d) => d.datum)).toEqual(['Mo, 20.\u00a0Juli', 'Di, 21.\u00a0Juli'])
    expect(days.map(abholtagZeile)).toEqual(['Heute · Mo, 20.\u00a0Juli', 'Morgen · Di, 21.\u00a0Juli'])
  })

  it('ab übermorgen ist die Zeile nur das Datum — kein „Sa, 25. Juli · Sa, 25. Juli"', () => {
    const [mittwoch] = nextPickupDays([MI], 1, NOW)
    expect(abholtagZeile(mittwoch!)).toBe('Mi, 22.\u00a0Juli')
  })

  it('überspringt Heute, wenn alle Zeitfenster schon vorbei sind', () => {
    // Montag-Slot endet 09:00, jetzt ist 10:00 → nächster Montag in einer Woche
    const days = nextPickupDays([{ dayOfWeek: 1, startTime: '07:00', endTime: '09:00' }], 1, NOW)
    expect(days[0].label).toBe('Mo, 27.\u00a0Juli')
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

describe('nextPickupDays rechnet im Wiener Kalender — wie die Kasse, nicht mit der Uhr des Geräts (Nr. 46, Runde 1)', () => {
  const MO = { dayOfWeek: 1, startTime: '15:00', endTime: '18:00' }
  const DI = { dayOfWeek: 2, startTime: '15:00', endTime: '18:00' }
  const MI_SPAET = { dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }

  it('kurz nach Mitternacht in Wien (Sommerzeit, in UTC noch Montag) ist schon Dienstag', () => {
    const jetzt = new Date('2026-07-20T22:30:00Z') // Di, 21. Juli, 00:30 in Wien
    expect(nextPickupDays([DI], 1, jetzt)[0]).toMatchObject({ label: 'Heute', datum: 'Di, 21.\u00a0Juli' })
    // Gegenprobe: Der Montag ist in Wien vorbei — sein Fenster kommt erst nächste Woche.
    expect(nextPickupDays([MO], 1, jetzt)[0]).toMatchObject({ label: 'Mo, 27.\u00a0Juli' })
  })

  it('im Winter (eine Stunde Versatz): 23:30 UTC ist in Wien schon der nächste Tag', () => {
    const jetzt = new Date('2026-01-12T23:30:00Z') // Di, 13. Jänner, 00:30 in Wien
    expect(nextPickupDays([DI], 1, jetzt)[0]).toMatchObject({ label: 'Heute', datum: 'Di, 13.\u00a0Jän' })
  })

  it('Mitternacht UTC ist in Wien 2 Uhr desselben Tages — „Morgen" ist der Tag danach', () => {
    const jetzt = new Date('2026-07-21T00:00:00Z') // Di, 21. Juli, 02:00 in Wien
    expect(nextPickupDays([MI_SPAET], 1, jetzt)[0]).toMatchObject({ label: 'Morgen', datum: 'Mi, 22.\u00a0Juli' })
  })

  it('ob heute noch ein Fenster offen ist, entscheidet die Wiener Uhr', () => {
    const montag = { dayOfWeek: 1, startTime: '15:00', endTime: '17:00' }
    // 17:30 in Wien (15:30 UTC): vorbei — in UTC liefe es noch.
    expect(nextPickupDays([montag], 1, new Date('2026-07-20T15:30:00Z'))[0]).toMatchObject({ label: 'Mo, 27.\u00a0Juli' })
    // Gegenprobe: 16:30 in Wien läuft es noch.
    expect(nextPickupDays([montag], 1, new Date('2026-07-20T14:30:00Z'))[0]).toMatchObject({ label: 'Heute' })
  })

  it('jeder Tag trägt seinen Wiener Kalendertag — derselbe Schlüssel wie in der Kasse', () => {
    const tage = nextPickupDays([MO, DI], 2, new Date('2026-07-20T22:30:00Z'))
    expect(tage.map((t) => t.kalendertag)).toEqual(['2026-07-21', '2026-07-27'])
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
