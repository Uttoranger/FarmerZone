/**
 * Die Bar-Bestätigung per Knopf (H3) — was die Seite /{hof}/bestaetigen/{token}
 * zeigt und ob der Knopf bestätigen darf. EINE Entscheidung für Seite und
 * Server Action (src/server/actions/bar-bestaetigung.ts).
 *
 * Vorher bestätigte schon der Aufruf des Mail-Links (GET) die Bestellung
 * verbindlich. Link-Scanner der Mailprogramme, Vorschauen und Vorabrufe
 * rufen Links aber ungefragt auf — dann hatte die Kundin „verbindlich
 * bestätigt", ohne je zu klicken. Jetzt führt der Link nur zur Seite, und
 * erst der Knopf (POST) bestätigt.
 *
 * DIE FRIST GILT BEIM LESEN (src/lib/fristen.ts): Eine Bestellung über ihrer
 * Frist ist „verfallen", auch wenn sie noch niemand storniert hat — der Knopf
 * bestätigt sie nie.
 *
 * Rein, ohne Datenbank (tests/bar-bestaetigung.test.ts).
 */
import type { OrderStatus } from '@prisma/client'
import { GRUND_NICHT_BESTAETIGT, istVerwaist, type FristBestellung } from '@/lib/fristen'

/** Storno-Grund, wenn die Kundin auf „Doch nicht" tippt (Order.cancelReason) — der Hof liest ihn. */
export const GRUND_KUNDIN_STORNIERT = 'Von der Kundin vor der Bestätigung storniert'

export type BarBestellung = FristBestellung & {
  status: OrderStatus
  cancelReason: string | null
}

/**
 * - `ungueltig`: kein Token dazu (schon benutzt, falsch abgetippt) oder keine
 *   Barbestellung — die Seite zeigt nichts von der Bestellung.
 * - `offen`: wartet auf Bestätigung und liegt in der Frist — nur hier gibt es
 *   die Knöpfe.
 * - `verfallen`: Frist vorbei (storniert oder noch nicht aufgeräumt).
 * - `storniert`: von der Kundin oder vom Hof storniert.
 * - `erledigt`: schon bestätigt oder weiter — die Seite leitet zur
 *   Bestätigungsseite.
 */
export type BarBestaetigungsAnsicht = 'ungueltig' | 'offen' | 'verfallen' | 'storniert' | 'erledigt'

export function barBestaetigungsAnsicht(bestellung: BarBestellung | null, jetzt: Date): BarBestaetigungsAnsicht {
  // Online-Bestellungen tragen nie einen Bestätigungs-Token; sollte doch
  // einer da sein, wird über ihn nichts bestätigt — sie bestätigt die Zahlung.
  if (!bestellung || bestellung.paymentMethod === 'ONLINE') return 'ungueltig'
  if (bestellung.status === 'CANCELLED') {
    return bestellung.cancelReason === GRUND_NICHT_BESTAETIGT ? 'verfallen' : 'storniert'
  }
  if (bestellung.status === 'PENDING_CONFIRMATION') {
    return istVerwaist(bestellung, jetzt) ? 'verfallen' : 'offen'
  }
  return 'erledigt'
}
