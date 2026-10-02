/**
 * Was die Bestätigungsseite (/{hof}/confirm/{id}) über den Stand einer
 * Bestellung sagt — AUSSCHLIESSLICH aus der Datenbank.
 *
 * Vorher steuerten ?confirmed=true und ?redirect_status=succeeded die Anzeige:
 * Wer die Adresse abtippte oder ein Lesezeichen setzte, sah „bestätigt" oder
 * „Zahlung erfolgreich", obwohl nichts bestätigt oder bezahlt war. Stripes
 * redirect_status ist hier nur noch ein Hinweis: „succeeded" heißt „Zahlung
 * wird geprüft", solange der Webhook den Stand noch nicht geschrieben hat;
 * „failed" bietet den neuen Versuch an. Nie macht er eine Bestellung bezahlt.
 *
 * Rein, ohne Datenbank (tests/bestaetigung.test.ts).
 */
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client'
import { GRUND_NICHT_BESTAETIGT } from '@/lib/fristen'

export type BestaetigungsZustand =
  | 'bezahlt'
  | 'zahlung-wird-geprueft'
  | 'zahlung-fehlgeschlagen'
  | 'bestaetigt'
  | 'bestaetigung-offen'
  | 'verfallen'

/** Vor Ort: bestätigt ist alles zwischen Bestätigung und Abholung. */
const VOR_ORT_BESTAETIGT: readonly OrderStatus[] = ['CONFIRMED', 'IN_PREPARATION', 'READY', 'PICKED_UP']

export function bestaetigungsZustand(
  order: { paymentMethod: PaymentMethod; paymentStatus: PaymentStatus; status: OrderStatus; cancelReason: string | null },
  redirectStatus: string | undefined
): BestaetigungsZustand | null {
  if (order.paymentMethod === 'ONLINE') {
    // Storniert (Frist vorbei, Hof) — weder ein Hinweis aus der URL noch ein
    // stehengebliebenes PAID (Erstattung noch nicht durch) macht daraus „bezahlt".
    if (order.status === 'CANCELLED') return null
    if (order.paymentStatus === 'PAID') return 'bezahlt'
    if (order.paymentStatus === 'FAILED' || redirectStatus === 'failed') return 'zahlung-fehlgeschlagen'
    if (redirectStatus === 'succeeded' || redirectStatus === 'processing') return 'zahlung-wird-geprueft'
    return null
  }
  if (order.status === 'CANCELLED') {
    return order.cancelReason === GRUND_NICHT_BESTAETIGT ? 'verfallen' : null
  }
  if (order.status === 'PENDING_CONFIRMATION') return 'bestaetigung-offen'
  return VOR_ORT_BESTAETIGT.includes(order.status) ? 'bestaetigt' : null
}
