import { z } from 'zod'

/**
 * Eine Bestellnummer, wie sie auf Beleg und Mail steht (`Order.orderNumber`).
 * Die Kasse baut sie aus bis zu drei Anfangsbuchstaben des Hofs, Tag und
 * Monat und vier Hexziffern („HM-2611-A4F2“, `generateOrderNumber` in
 * src/app/api/checkout/route.ts); ältere und Seed-Nummern sind kürzer
 * („TD-0001“). Das Muster nimmt beides an, aber nie eine Adresse (kein @),
 * kein Leerzeichen und keinen Platzhalter — der Support liest sie am Telefon
 * vor, darum ohne Ränder und in Großbuchstaben (Admin › Betrieb › E-Mails,
 * Nr. 161).
 */
export const BESTELLNUMMER_MUSTER = /^[A-Z0-9]{1,6}-[A-Z0-9]{1,8}(-[A-Z0-9]{1,8})?$/

export const bestellnummerSchema = z.string().trim().toUpperCase().regex(BESTELLNUMMER_MUSTER)
