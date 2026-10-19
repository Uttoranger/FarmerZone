// Gemeinsame WhatsApp-Helfer: Telefonnummern-Normalisierung für wa.me-Links
// (vorher lokal dupliziert in Kundendetail + Status-Werkstatt) und die
// Erinnerungs-Nachricht für Bestellkarten.
import { telefonZiffern } from '@/lib/telefon-anzeige'

/**
 * „+43 660 000-00 00“ / „0660 0000000“ / „0043 660 0000000“ → „436600000000“
 * (wa.me-Format ohne +). Dieselbe Lesart wie Anzeige und Anruf-Link (`telefonLink`)
 * (`telefonZiffern`, Nr. 85): Vorher las diese Funktion „0043 …“ und Eingaben
 * ohne führende 0 anders und baute tote Links. Nur Ziffern in der Adresse
 * (Sicherheitsprüfung 13.10., Nr. 75); null, wenn sich die Eingabe nicht
 * eindeutig lesen lässt (zwei Nummern, „ab 18 Uhr“, keine Ziffer).
 */
export function toWaPhone(phone: string): string | null {
  return telefonZiffern(phone)
}

/**
 * Die wa.me-Adresse zu einer Nummer, mit vorbelegtem Text — oder null, wenn
 * sich die Nummer nicht eindeutig lesen lässt: `https://wa.me/` ohne (oder mit
 * einer anderen) Nummer erreicht niemanden, also gibt es dann keinen Link (Nr. 75, 85).
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
    // Wiener Tag, nie der der Serveruhr (CODING_STANDARDS „Tage und Wochen").
    timeZone: 'Europe/Vienna',
  })
  return (
    `${opening} Bestellung ${order.orderNumber} bei ${order.farmName} liegt am ${date} ` +
    `zwischen ${order.pickupTimeStart}–${order.pickupTimeEnd} Uhr zur Abholung bereit. Bis dann!`
  )
}

export function buildOrderReminderUrl(phone: string, order: OrderReminderInfo): string | null {
  return whatsAppLink(phone, buildOrderReminderMessage(order))
}
