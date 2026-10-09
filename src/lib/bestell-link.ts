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
// nicht vor einer abgelaufenen Signatur stehen.
//
// WAS DER LINK DARF: Lesen einer einzelnen Bestellung — und seit Nr. 46 genau
// EINEN Schreibweg: die Anmeldung „Neuigkeiten vom Hof per E-Mail" auf der
// Bestätigungsseite (`meldeNeuigkeitenAn`). Ein abgefangener Link — oder der
// eigene Link zu einer Bestellung mit fremder Adresse — kann damit nur eine
// Bestätigungsmail an die Adresse DER Bestellung auslösen, nie an eine andere;
// angemeldet ist erst, wer in dieser Mail klickt (Double-Opt-in, S11). Dazu:
// nur für eine laufende Bestellung (`neuigkeitenErlaubt`), höchstens drei
// Anfragen je Bestellung und UTC-Tag (Datenbank-Bremse, an der Tagesgrenze bis
// zu doppelt), ein Link je Abo und zehn
// Minuten, immer dieselbe Antwort, und an der Bestellung ändert sich nichts
// (docs/ai/ARCHITECTURE.md §5). Jeder weitere Schreibweg braucht ein eigenes
// Token mit eigenem Zweck, nicht diese Signatur.
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

/**
 * Die ICS-Datei zum Abholtermin (/{hof}/bestellung/{id}/kalender) samt
 * Signatur — derselbe Zugang wie die Bestellseite darüber.
 */
export function kalenderPfad(farmSlug: string, orderId: string): string {
  return `/${farmSlug}/bestellung/${orderId}/kalender?s=${bestellSignatur(orderId)}`
}

/**
 * Der Pfad der Bestätigungsseite (/{hof}/confirm/{id}) samt Signatur — nach
 * dem Checkout, als Stripe-return_url und nach dem Bestätigungslink. Die
 * Seite zeigt Name, E-Mail, Artikel und Beträge nur mit gültiger Signatur;
 * die Bestell-ID allein ist ratbar. Parameter `sig`: Stripe hängt seine
 * eigenen (payment_intent, redirect_status …) an die return_url an, `sig`
 * bleibt dabei stehen. Den Pfad baut nur der Server — das Geheimnis gehört
 * nie in den Browser.
 */
export function bestaetigungsPfad(farmSlug: string, orderId: string): string {
  return `/${farmSlug}/confirm/${orderId}?sig=${bestellSignatur(orderId)}`
}

/**
 * Der Pfad der Bar-Bestätigung (/{hof}/bestaetigen/{token}, H3) — für die
 * Mail „Bitte bestätige deine Bestellung" und die Weiterleitung alter Links.
 * Keine Signatur: Der Token selbst ist das Einmal-Geheimnis (nanoid(32)) und
 * verfällt mit der Bestätigung. Die Seite bestätigt nicht beim Aufruf, erst
 * der Knopf darauf.
 */
export function barBestaetigungsPfad(farmSlug: string, token: string): string {
  return `/${farmSlug}/bestaetigen/${encodeURIComponent(token)}`
}
