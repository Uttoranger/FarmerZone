import { createHmac, timingSafeEqual } from 'crypto'
import { env } from '@/lib/env'

// Der signierte Bestell-Link: /{farmSlug}/bestellung/{orderId}?s={signatur}
//
// Dasselbe HMAC-Muster wie reorder-token.ts und unsubscribe.ts (Geheimnis aus
// dem validierten env-Modul, Hex-Signatur, Vergleich in konstanter Zeit) —
// nur schlanker: Die Bestell-ID steht bereits im Pfad, deshalb trägt der
// Query-Parameter NUR die Signatur statt eines selbsttragenden Tokens.
//
// BEWUSST OHNE ABLAUFDATUM (anders als der Reorder-Token, wie der
// Abmeldelink in unsubscribe.ts): Der Link ist der einzige Weg der Kundin
// zurück zu ihrer Bestellung — es gibt kein Konto und keine Historie. Wer
// nach Wochen den Kaufbeleg oder die Abholadresse nachschlagen will, darf
// nicht vor einer abgelaufenen Signatur stehen. Der Link gewährt nur LESEN
// einer einzelnen Bestellung; ein abgefangener Link kann nichts auslösen.
const SECRET = env.BETTER_AUTH_SECRET

// Domänen-Präfix gegen Verwechslung: reorder-token und unsubscribe signieren
// mit DEMSELBEN Geheimnis. Ohne Präfix wäre HMAC("orderId") von einem
// hypothetischen anderen Link-Typ über dieselbe ID nicht unterscheidbar —
// mit Präfix gilt jede Signatur nur für genau diesen Zweck.
const ZWECK = 'bestellung-ansehen'

export function bestellSignatur(orderId: string): string {
  return createHmac('sha256', SECRET).update(`${ZWECK}:${orderId}`).digest('hex')
}

// Vergleich in konstanter Zeit: ein `!==` bricht beim ersten abweichenden
// Zeichen ab und verrät über die Laufzeit, wie viele Zeichen stimmten.
export function bestellLinkGilt(orderId: string, signatur: string): boolean {
  const a = Buffer.from(signatur, 'utf8')
  const b = Buffer.from(bestellSignatur(orderId), 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Der Pfad der Bestellseite samt Signatur — für Mails und interne Links. */
export function bestellungPfad(farmSlug: string, orderId: string): string {
  return `/${farmSlug}/bestellung/${orderId}?s=${bestellSignatur(orderId)}`
}
