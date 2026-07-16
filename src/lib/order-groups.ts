// Gruppierung der Bestellliste nach Abholtag (Sprint 19, Referenz 19).
// Heutige Gruppe zuerst, danach chronologisch; innerhalb eines Tages
// nach Slot-Beginn. Tage ohne Bestellungen erscheinen nicht.

export type GroupableOrder = {
  pickupDate: Date | string
  pickupTimeStart: string
}

export type OrderDayGroup<T> = {
  key: string // yyyy-mm-dd
  label: string // "Heute" | "Morgen" | "Samstag, 25. Juli"
  orders: T[]
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function pickupDayLabel(date: Date, now: Date = new Date()): string {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (date.toDateString() === now.toDateString()) return 'Heute'
  if (date.toDateString() === tomorrow.toDateString()) return 'Morgen'
  return date.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function groupOrdersByPickupDay<T extends GroupableOrder>(
  orders: T[],
  now: Date = new Date()
): OrderDayGroup<T>[] {
  const byDay = new Map<string, { date: Date; orders: T[] }>()

  for (const order of orders) {
    const date = new Date(order.pickupDate)
    const key = dayKey(date)
    const entry = byDay.get(key)
    if (entry) entry.orders.push(order)
    else byDay.set(key, { date, orders: [order] })
  }

  const todayKey = dayKey(now)
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
