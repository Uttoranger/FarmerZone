// "Nächste Abholung"-Tageskarten (Sprint 20, Referenz 17) aus den echten
// PickupSlots (wöchentlich wiederkehrend, dayOfWeek = JS getDay(), 0 = Sonntag).
import { formatTagKurz } from '@/lib/format'

export type WeeklySlot = { dayOfWeek: number; startTime: string; endTime: string }

/**
 * So weit voraus wird angeboten: heute und die 13 Tage danach. Gilt für die
 * Tageskarten hier und für die Abholfenster im Checkout (src/lib/abholfenster.ts),
 * die der Server genauso prüft.
 */
export const ABHOL_VORLAUF_TAGE = 14
export type PickupDay = {
  date: Date
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

/** Der Kalendertag (JJJJ-MM-TT) eines Datums in der Zeit, in der hier gerechnet wird. */
function kalendertag(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayLabel(date: Date, now: Date): string {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (date.toDateString() === now.toDateString()) return 'Heute'
  if (date.toDateString() === tomorrow.toDateString()) return 'Morgen'
  // Dieselbe Schreibweise wie die Kasse („Sa, 10. Okt", src/lib/format.ts).
  return formatTagKurz(kalendertag(date))
}

// Nächste `count` Abholtage innerhalb von 14 Tagen. Heute zählt nur, solange
// mindestens ein Zeitfenster noch nicht vorbei ist. Slots pro Tag nach Beginn
// sortiert, mehrere Fenster mit " · " verbunden.
export function nextPickupDays(
  slots: WeeklySlot[],
  count = 3,
  now: Date = new Date()
): PickupDay[] {
  if (slots.length === 0) return []

  const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const days: PickupDay[] = []

  for (let offset = 0; offset < ABHOL_VORLAUF_TAGE && days.length < count; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12, 0, 0)
    let daySlots = slots.filter((s) => s.dayOfWeek === date.getDay())
    if (offset === 0) daySlots = daySlots.filter((s) => s.endTime > nowHm)
    if (daySlots.length === 0) continue

    const sorted = daySlots.slice().sort((a, b) => a.startTime.localeCompare(b.startTime))
    days.push({
      date,
      label: dayLabel(date, now),
      datum: formatTagKurz(kalendertag(date)),
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
