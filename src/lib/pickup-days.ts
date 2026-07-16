// "Nächste Abholung"-Tageskarten (Sprint 20, Referenz 17) aus den echten
// PickupSlots (wöchentlich wiederkehrend, dayOfWeek = JS getDay(), 0 = Sonntag).

export type WeeklySlot = { dayOfWeek: number; startTime: string; endTime: string }
export type PickupDay = { date: Date; label: string; times: string }

const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

// "08:00" → "8" · "09:30" → "9:30"
export function formatSlotTime(t: string): string {
  const [h, m] = t.split(':')
  const hour = String(Number(h))
  return m === '00' ? hour : `${hour}:${m}`
}

function dayLabel(date: Date, now: Date): string {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (date.toDateString() === now.toDateString()) return 'Heute'
  if (date.toDateString() === tomorrow.toDateString()) return 'Morgen'
  const month = date.toLocaleDateString('de-AT', { month: 'long' })
  return `${WEEKDAY_SHORT[date.getDay()]}, ${date.getDate()}. ${month}`
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

  for (let offset = 0; offset < 14 && days.length < count; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12, 0, 0)
    let daySlots = slots.filter((s) => s.dayOfWeek === date.getDay())
    if (offset === 0) daySlots = daySlots.filter((s) => s.endTime > nowHm)
    if (daySlots.length === 0) continue

    const sorted = daySlots.slice().sort((a, b) => a.startTime.localeCompare(b.startTime))
    days.push({
      date,
      label: dayLabel(date, now),
      times: `${sorted
        .map((s) => `${formatSlotTime(s.startTime)}–${formatSlotTime(s.endTime)}`)
        .join(' · ')} Uhr`,
    })
  }

  return days
}

// Kurzlabel für die Aktionsleiste: "Mi & Sa" (Wochentage der Slots, Mo–So sortiert)
export function pickupWeekdaysLabel(slots: WeeklySlot[]): string {
  const order = [1, 2, 3, 4, 5, 6, 0] // Mo zuerst
  const present = [...new Set(slots.map((s) => s.dayOfWeek))]
  const sorted = order.filter((d) => present.includes(d)).map((d) => WEEKDAY_SHORT[d])
  return sorted.join(' & ')
}
