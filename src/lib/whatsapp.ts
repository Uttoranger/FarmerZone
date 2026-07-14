// Gemeinsame WhatsApp-Helfer: Telefonnummern-Normalisierung für wa.me-Links
// (vorher lokal dupliziert in Kundendetail + Status-Werkstatt) und die
// Erinnerungs-Nachricht für Bestellkarten.

// "+43 660 123-45 67" / "0660 1234567" → "436601234567" (wa.me-Format ohne +)
export function toWaPhone(phone: string): string {
  const digits = phone.replace(/[\s\-().]/g, '')
  if (digits.startsWith('+')) return digits.slice(1)
  if (digits.startsWith('0')) return '43' + digits.slice(1)
  return digits
}

export type OrderReminderInfo = {
  customerName: string
  orderNumber: string
  farmName: string
  pickupDate: Date | string
  pickupTimeStart: string
  pickupTimeEnd: string
}

export function buildOrderReminderMessage(order: OrderReminderInfo): string {
  const firstName = order.customerName.trim().split(/\s+/)[0] ?? ''
  const opening = firstName ? `Hallo ${firstName}, deine` : 'Deine'
  const date = new Date(order.pickupDate).toLocaleDateString('de-AT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return (
    `${opening} Bestellung ${order.orderNumber} bei ${order.farmName} liegt am ${date} ` +
    `zwischen ${order.pickupTimeStart}–${order.pickupTimeEnd} Uhr zur Abholung bereit. Bis dann!`
  )
}

export function buildOrderReminderUrl(phone: string, order: OrderReminderInfo): string {
  return `https://wa.me/${toWaPhone(phone)}?text=${encodeURIComponent(buildOrderReminderMessage(order))}`
}
