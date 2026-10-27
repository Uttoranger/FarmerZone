import type { Monatsschluessel } from '@/lib/servicegebuehr'
import { MARKE } from '@/lib/marke'

/*
 * Die Sätze von Admin › Geld (Register N32, N37; Nr. 191; Mockup admin-geld)
 * — eine Quelle für Seite und Tests. „Finanzen“ heißt seit N32 „Geld“.
 */
export const GELD_TEXT = {
  titel: 'Geld',
  satz: `Was durch ${MARKE} fließt, ob es mit Stripe übereinstimmt, und der Monatsabschluss.`,
  kennzahlen: 'Geld in Zahlen',
  abgleich: 'Abgleich mit Stripe',
  abgleichZusatz: 'täglich, nur lesend',
  stripeGebuehrTraeger: `trägt ${MARKE} (Destination Charges)`,
  abschluss: (bezeichnung: string): string => `Monatsabschluss ${bezeichnung}`,
  abschliessen: (monatName: string): string => `${monatName} abschließen …`,
  abgeschlossen: 'abgeschlossen',
  nachAbschluss: 'Danach sind Kosten des Monats nur mit Grund änderbar.',
  laufendGrund: 'Geht erst nach dem Monatsende.',
  fehler: 'Wir konnten Geld gerade nicht laden.',
  regel:
    'Die Stripe-Gebühren der Kartenzahlungen trägt bei Destination Charges die Plattform – sie stehen darum als Kosten neben der Servicegebühr. Der Abgleich liest Zahlungen, Erstattungen und Gebühren der letzten 48 Stunden bei Stripe und vergleicht sie mit den Bestellungen. Weicht etwas ab, steht es als Aufgabe in Heute – mit Bestellnummer und Betrag.',
} as const

export const ADMIN_GELD_HREF = '/admin/geld'

/** Die Adresse eines Monats von Geld — ohne Monat der laufende. */
export function geldAdresse(monat?: Monatsschluessel): string {
  return monat ? `${ADMIN_GELD_HREF}?monat=${monat}` : ADMIN_GELD_HREF
}

/** Die Jahresansicht (dieselbe Seite wie bisher unter Finanzen, Nr. 100). */
export function geldJahrAdresse(jahr: number): string {
  return `${ADMIN_GELD_HREF}?zeitraum=jahr&jahr=${jahr}`
}

/**
 * /admin/finanzen → /admin/geld (308, N32) mit denselben Parametern — Lesezeichen,
 * die Links der Jahresansicht und die CSV-Rückkehr führen so weiter.
 */
export function vonFinanzenNachGeld(parameter: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams()
  for (const [name, wert] of Object.entries(parameter)) {
    for (const w of Array.isArray(wert) ? wert : wert === undefined ? [] : [wert]) q.append(name, w)
  }
  const text = q.toString()
  return text === '' ? ADMIN_GELD_HREF : `${ADMIN_GELD_HREF}?${text}`
}
