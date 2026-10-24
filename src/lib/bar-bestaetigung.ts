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
import { createHash } from 'crypto'
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

/*
 * NUR DER HASH IN DER DATENBANK (Register S17 Punkt 2, Nr. 151). Der Token aus
 * der Mail ist die einzige Berechtigung zum Bestätigen und Stornieren. Stünde
 * er im Klartext in `Order.confirmationToken`, könnte jeder, der die Tabelle
 * lesen kann (Sicherung, Auszug, Datenbank-Werkzeug), fremde Bestellungen
 * bestätigen. Darum speichert der Checkout nur den Hash; die Mail trägt den
 * Token.
 *
 * SHA-256 ohne Geheimnis genügt: Der Token hat 32 Zeichen aus nanoid (rund
 * 190 Bit) — nachrechnen lässt er sich nicht. Das Präfix „bar-bestaetigung:"
 * trennt diesen Zweck von jedem anderen Hash im Haus; „h1:" vorn trägt die
 * Fassung und enthält einen Doppelpunkt, den das Token-Schema
 * (src/schemas/bar-bestaetigung.ts) nie durchlässt. Ein gespeicherter Wert
 * taugt also nie selbst als Token.
 */
/** Das Präfix jedes gespeicherten Hashs — das Aufräumen leert alle Werte ohne es (Nr. 164). */
export const BAR_HASH_PRAEFIX = 'h1:'
const HASH_ZWECK = 'bar-bestaetigung:'

/** Der gespeicherte Wert zu einem Token aus der Mail. */
export function barTokenHash(token: string): string {
  return BAR_HASH_PRAEFIX + createHash('sha256').update(HASH_ZWECK + token).digest('hex')
}

/**
 * Die Werte, unter denen eine Bestellung zu diesem Token stehen kann — EINE
 * Quelle für alle Leser (Seite, Knöpfe, alter Mail-Link):
 * `confirmationToken: { in: tokenKandidaten(token) }`.
 *
 * Nur der Hash (Nr. 164, Register S17): Der Klartext älterer Bestellungen
 * galt nur bis zum Ende der Barfrist; das tägliche Aufräumen
 * (src/server/aufraeumen.ts) setzt die übrig gebliebenen Klartext-Werte auf
 * leer. Die Liste bleibt eine Liste, damit die Leser nicht umgebaut werden.
 */
export function tokenKandidaten(token: string): string[] {
  return [barTokenHash(token)]
}

/** Wie oft „Erneut senden" je Bestellung und Tag eine Mail auslöst (S17 Punkt 2). */
export const BAR_LINK_JE_BESTELLUNG_UND_TAG = 3

/**
 * Gibt es „Mail nicht bekommen? Erneut senden"? Nur für eine offene
 * Barbestellung (bar oder Karte beim Hof, in der Frist) bei einem Hof, der
 * nicht stillgelegt ist. EINE Regel für den Knopf auf der Bestätigungsseite
 * und die Action `sendeBarLinkErneut`.
 */
export function barLinkErneutMoeglich(
  bestellung: BarBestellung & { farm: { archivedAt: Date | null } },
  jetzt: Date
): boolean {
  if (bestellung.farm.archivedAt) return false
  if (bestellung.paymentMethod !== 'ONSITE_CASH' && bestellung.paymentMethod !== 'ONSITE_CARD') return false
  return barBestaetigungsAnsicht(bestellung, jetzt) === 'offen'
}

/**
 * Was Seite und Knöpfe bei einem Link sagen, der nicht (mehr) gilt — seit
 * Nr. 151 auch nach „Erneut senden": Der neue Link ersetzt den alten.
 */
export const LINK_UNGUELTIG_TITEL = 'Dieser Link gilt nicht mehr'
export const LINK_UNGUELTIG_SATZ =
  'Hast du schon bestätigt oder einen neuen Link angefordert? Nimm den Link aus der neuesten Mail.'

/**
 * Die eine Antwort auf „Erneut senden" — in jedem Fall dieselbe (gesendet,
 * gebremst, Link falsch, Bestellung nicht mehr offen): Sie verrät nichts über
 * die Bestellung.
 */
export const BAR_LINK_ERNEUT_ANTWORT = 'Wenn die Bestellung noch offen ist, ist eine neue Mail unterwegs.'
