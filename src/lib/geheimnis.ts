import { timingSafeEqual } from 'crypto'

/**
 * Vergleich zweier Geheimnisse in konstanter Zeit — dasselbe Muster wie
 * `signatureMatches` in form-token.ts, hier als wiederverwendbare Funktion
 * für Bearer-Token in Routen (api/triage/export).
 *
 * Ein `!==` bricht beim ersten abweichenden Zeichen ab und verrät über die
 * Laufzeit, wie viele Zeichen stimmten. `timingSafeEqual` verlangt gleich
 * lange Puffer; ungleiche Länge ist deshalb vorab ein Nein — die Länge eines
 * Tokens ist kein Geheimnis, sein Inhalt schon.
 */
export function geheimnisGleich(a: string, b: string): boolean {
  const pa = Buffer.from(a, 'utf8')
  const pb = Buffer.from(b, 'utf8')
  if (pa.length !== pb.length) return false
  return timingSafeEqual(pa, pb)
}
