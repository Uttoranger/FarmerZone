// "Nächste Abholung"-Tageskarten (Sprint 20, Referenz 17) aus den echten
// PickupSlots (wöchentlich wiederkehrend, dayOfWeek = JS getDay(), 0 = Sonntag).
import { formatTagKurz } from '@/lib/format'
import { uhrzeitInWien } from '@/lib/fristen'
import { tagVersetzt, wochentagVon } from '@/lib/kalender'
import { kalendertagInWien } from '@/lib/wiener-tag'

export type WeeklySlot = { dayOfWeek: number; startTime: string; endTime: string }

/**
 * So weit voraus wird angeboten: heute und die 13 Tage danach. Gilt für die
 * Tageskarten hier und für die Abholfenster im Checkout (src/lib/abholfenster.ts),
 * die der Server genauso prüft.
 */
export const ABHOL_VORLAUF_TAGE = 14
export type PickupDay = {
  /** 12:00 UTC des Wiener Kalendertags — eindeutig je Tag (Schlüssel in Listen). */
  date: Date
  /** Der Wiener Kalendertag JJJJ-MM-TT — derselbe Schlüssel wie in der Kasse. */
  kalendertag: string
  /** „Heute", „Morgen", sonst das Datum „Sa, 10. Okt". */
  label: string
  /** Immer das Datum „Sa, 10. Okt" (Nr. 46: jeder Termin mit Datum). */
  datum: string
  times: string
}

const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

// "08:00" → "8" · "09:30" → "9:30"
export function formatSlotTime(t: string): string {
  const [h, m] = t.split(':')
  const hour = String(Number(h))
  return m === '00' ? hour : `${hour}:${m}`
}

// Nächste `count` Abholtage innerhalb von 14 Tagen. Heute zählt nur, solange
// mindestens ein Zeitfenster noch nicht vorbei ist. Slots pro Tag nach Beginn
// sortiert, mehrere Fenster mit " · " verbunden.
//
// WIENER KALENDER UND UHR (Nr. 46, Runde 1), mit denselben Helfern wie die
// Kasse (`angeboteneAbholfenster`, `abholKacheln`): Vorher galt die Uhr des
// Geräts — der Server (UTC) und ein Browser in Wien zeigten zwischen 00:00 und
// 01:00 bzw. 02:00 Wiener Zeit einen anderen Tag, und mit dem Datum in der
// Zeile („Heute · Di, 21. Juli") fiel das auf.
export function nextPickupDays(
  slots: WeeklySlot[],
  count = 3,
  now: Date = new Date()
): PickupDay[] {
  if (slots.length === 0) return []

  const heute = kalendertagInWien(now)
  const jetztHm = uhrzeitInWien(now)
  const days: PickupDay[] = []

  for (let offset = 0; offset < ABHOL_VORLAUF_TAGE && days.length < count; offset++) {
    const kalendertag = tagVersetzt(heute, offset)
    let daySlots = slots.filter((s) => s.dayOfWeek === wochentagVon(kalendertag))
    if (offset === 0) daySlots = daySlots.filter((s) => s.endTime > jetztHm)
    if (daySlots.length === 0) continue

    const sorted = daySlots.slice().sort((a, b) => a.startTime.localeCompare(b.startTime))
    // Dieselbe Schreibweise wie die Kasse („Sa, 10. Okt", src/lib/format.ts).
    const datum = formatTagKurz(kalendertag)
    days.push({
      date: new Date(`${kalendertag}T12:00:00Z`),
      kalendertag,
      label: offset === 0 ? 'Heute' : offset === 1 ? 'Morgen' : datum,
      datum,
      times: `${sorted
        .map((s) => `${formatSlotTime(s.startTime)}–${formatSlotTime(s.endTime)}`)
        .join(' · ')} Uhr`,
    })
  }

  return days
}

/**
 * Eine Zeile der Karte „Nächste Abholung" (Nr. 46: Termine als Text, keine
 * Knopf-Optik ohne Funktion): „Heute · Do, 8. Okt", sonst das Datum.
 */
export function abholtagZeile(tag: Pick<PickupDay, 'label' | 'datum'>): string {
  return tag.label === tag.datum ? tag.datum : `${tag.label} · ${tag.datum}`
}

// Kurzlabel für die Aktionsleiste: "Mi & Sa" (Wochentage der Slots, Mo–So sortiert)
export function pickupWeekdaysLabel(slots: WeeklySlot[]): string {
  const order = [1, 2, 3, 4, 5, 6, 0] // Mo zuerst
  const present = [...new Set(slots.map((s) => s.dayOfWeek))]
  const sorted = order.filter((d) => present.includes(d)).map((d) => WEEKDAY_SHORT[d])
  return sorted.join(' & ')
}

const WEEKDAY_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

/**
 * Die Karte „Abholzeiten" der Hofseite (Nr. 10): je Wochentag eine Zeile,
 * Montag zuerst, mehrere Fenster eines Tages nach Beginn mit " · " verbunden —
 * „Mittwoch, 15–18 Uhr". Dieselbe Schreibweise der Zeiten wie die Tageskarten.
 */
export function abholzeitenJeWochentag(slots: WeeklySlot[]): string[] {
  const order = [1, 2, 3, 4, 5, 6, 0]
  return order.flatMap((tag) => {
    const fenster = slots
      .filter((s) => s.dayOfWeek === tag)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((s) => `${formatSlotTime(s.startTime)}–${formatSlotTime(s.endTime)}`)
    return fenster.length > 0 ? [`${WEEKDAY_LONG[tag]}, ${fenster.join(' · ')} Uhr`] : []
  })
}
