// Gruppierung der Bestellliste nach Abholtag (Sprint 19, Referenz 19).
// Heutige Gruppe zuerst, danach chronologisch; innerhalb eines Tages
// nach Slot-Beginn. Tage ohne Bestellungen erscheinen nicht.
// Ein Tag ist der Wiener Kalendertag, nie der der Serveruhr (CODING_STANDARDS „Tage und Wochen").

import { tagVersetzt, wienKalendertag } from '@/lib/kalender'

export type GroupableOrder = {
  pickupDate: Date | string
  pickupTimeStart: string
}

export type OrderDayGroup<T> = {
  key: string // yyyy-mm-dd
  label: string // "Heute" | "Morgen" | "Samstag, 25. Juli"
  orders: T[]
}

export function pickupDayLabel(date: Date, now: Date = new Date()): string {
  const tag = wienKalendertag(date)
  const heute = wienKalendertag(now)
  if (tag === heute) return 'Heute'
  // Morgen über den Kalendertag, nicht über +24 Stunden: In der Nacht der Zeitumstellung hat ein Tag 23 oder 25.
  if (tag === tagVersetzt(heute, 1)) return 'Morgen'
  return date.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Vienna' })
}

export function groupOrdersByPickupDay<T extends GroupableOrder>(
  orders: T[],
  now: Date = new Date()
): OrderDayGroup<T>[] {
  const byDay = new Map<string, { date: Date; orders: T[] }>()

  for (const order of orders) {
    const date = new Date(order.pickupDate)
    const key = wienKalendertag(date)
    const entry = byDay.get(key)
    if (entry) entry.orders.push(order)
    else byDay.set(key, { date, orders: [order] })
  }

  const todayKey = wienKalendertag(now)
  const groups = [...byDay.entries()]
    .sort(([a], [b]) => {
      // Heutiger Tag immer zuerst, Rest chronologisch aufsteigend
      if (a === todayKey) return -1
      if (b === todayKey) return 1
      return a.localeCompare(b)
    })
    .map(([key, { date, orders: dayOrders }]) => ({
      key,
      label: pickupDayLabel(date, now),
      orders: dayOrders
        .slice()
        .sort((x, y) => x.pickupTimeStart.localeCompare(y.pickupTimeStart)),
    }))

  return groups
}
