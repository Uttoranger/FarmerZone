import { createHmac } from 'crypto'

/**
 * Die Kennung einer Kundin in der Adresse der Kundenseite (/customers/<kundeId>).
 *
 * WARUM: Vorher stand die E-Mail-Adresse selbst im Pfad. Pfade landen in
 * Server-Protokollen, in der Statistik und im Verlauf des Browsers — eine
 * E-Mail dort ist ein personenbezogenes Datum an Orten, die niemand löscht.
 *
 * WIE: gekürzter HMAC-SHA256 über Hof und E-Mail. Ohne Schema-Änderung: Es gibt
 * keine Kunden-Tabelle, eine Kundin ist die Menge der Bestellungen mit
 * derselben E-Mail. Die Seite findet sie, indem sie die Kennungen der Kundinnen
 * DIESES Hofs berechnet und vergleicht (queries/customers.ts).
 *  - Der Hof steht mit im HMAC: Dieselbe Kundin hat bei zwei Höfen zwei
 *    Kennungen — eine Adresse aus einem Hof verrät im anderen nichts.
 *  - Das Geheimnis verhindert, dass jemand aus einer bekannten E-Mail die
 *    Kennung nachrechnet (bei einem nackten Hash ginge das).
 *  - Das Präfix „kunde:" trennt diese Verwendung des Geheimnisses von den
 *    anderen Signaturen mit demselben Schlüssel.
 *  - E-Mail klein und ohne Rand: So gruppiert auch die Kundenliste.
 *
 * 16 Zeichen base64url = 96 Bit; zufällige Treffer innerhalb eines Hofs sind
 * ausgeschlossen, und die Kennung ist kein Zugang — die Seite prüft weiterhin
 * die Anmeldung und sucht nur unter den Kundinnen des eigenen Hofs.
 */
export const KUNDE_ID_LAENGE = 16

export const KUNDE_ID_MUSTER = /^[A-Za-z0-9_-]{16}$/

export function kundeIdAus(geheimnis: string, farmId: string, email: string): string {
  return createHmac('sha256', geheimnis)
    .update(`kunde:${farmId}:${email.trim().toLowerCase()}`)
    .digest('base64url')
    .slice(0, KUNDE_ID_LAENGE)
}

/**
 * Eine alte Adresse trug die E-Mail im Pfad — erkennbar am @ (auch als %40).
 * Sie wird auf die neue Adresse umgeleitet; ein kaputt kodierter Pfad ist
 * keine alte Adresse, sondern schlicht nicht gefunden.
 */
export function alteKundenAdresse(pfadTeil: string): string | null {
  let roh: string
  try {
    roh = decodeURIComponent(pfadTeil)
  } catch {
    return null
  }
  return roh.includes('@') ? roh : null
}
