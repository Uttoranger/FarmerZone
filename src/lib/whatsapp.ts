// Gemeinsame WhatsApp-Helfer: Telefonnummern-Normalisierung für wa.me-Links
// (vorher lokal dupliziert in Kundendetail + Status-Werkstatt) und die
// Erinnerungs-Nachricht für Bestellkarten.

// "+43 660 123-45 67" / "0660 1234567" → "436601234567" (wa.me-Format ohne +)
export function toWaPhone(phone: string): string {
  const digits = phone.replace(/[\s\-().]/g, '')
  const international = digits.startsWith('+') ? digits.slice(1) : digits.startsWith('0') ? '43' + digits.slice(1) : digits
  // Nur Ziffern in die Adresse (Sicherheitsprüfung 13.10., Nr. 75): Gespeichert
  // ist, was eingegeben wurde — ein Buchstabe, „/" oder „?" landete sonst im Link.
  return international.replace(/\D/g, '')
}

/**
 * Die wa.me-Adresse zu einer Nummer, mit vorbelegtem Text — oder null, wenn
 * in der Nummer keine Ziffer steht: `https://wa.me/` ohne Nummer erreicht
 * niemanden, also gibt es dann keinen Link (Nr. 75).
 */
export function whatsAppLink(phone: string, text?: string): string | null {
  const nummer = toWaPhone(phone)
  if (!nummer) return null
  return text === undefined ? `https://wa.me/${nummer}` : `https://wa.me/${nummer}?text=${encodeURIComponent(text)}`
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

export function buildOrderReminderUrl(phone: string, order: OrderReminderInfo): string | null {
  return whatsAppLink(phone, buildOrderReminderMessage(order))
}
