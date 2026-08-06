import { createHmac, timingSafeEqual } from 'crypto'
import { env } from '@/lib/env'

// Signierter Zeitstempel für das Registrierungsformular.
//
// Warum signiert: Ein Formular, das weniger als drei Sekunden nach dem
// Ausliefern der Seite zurückkommt, hat niemand von Hand ausgefüllt. Damit
// diese Schranke etwas wert ist, muss der Zeitstempel vom Server stammen und
// fälschungssicher sein — ein blanker Wert im versteckten Feld wäre in einer
// Zeile umgeschrieben.
//
// Gleiches Muster wie src/lib/reorder-token.ts und src/lib/unsubscribe.ts:
// HMAC-SHA256 mit dem BETTER_AUTH_SECRET aus dem validierten env-Modul,
// Vergleich in konstanter Zeit. Keine eigene Krypto.
const SECRET = env.BETTER_AUTH_SECRET

// Der Zweck steckt mit im Payload: ein Reorder- oder Abmelde-Token trägt
// dieselbe Signatur-Art und soll hier trotzdem nicht durchgehen.
const PURPOSE = 'register'

/**
 * Untergrenze. Vor- und Nachname, E-Mail und zweimal das Passwort füllt
 * niemand in unter drei Sekunden aus. Bewusst niedrig angesetzt: die
 * Schranke soll Skripte erwischen, nicht schnelle Menschen.
 */
export const MIN_FORM_AGE_MS = 3_000

/**
 * Obergrenze. Ein offen liegengelassener Tab soll nicht beliebig lange
 * gültig bleiben — sonst wäre ein einmal abgeholtes Token dauerhaft
 * brauchbar. Zwölf Stunden decken jede realistische Sitzung ab.
 */
export const MAX_FORM_AGE_MS = 12 * 60 * 60 * 1000

/**
 * Der EINZIGE Fall, in dem die Bot-Abwehr sichtbar wird: Das Formular lag zu
 * lange offen. Dahinter steckt ein echter Mensch, und eine stille
 * Erfolgsmeldung wäre hier fatal — er würde glauben, sein Konto sei angelegt,
 * und stünde beim Einloggen vor dem Nichts.
 */
export const FORM_EXPIRED_MESSAGE =
  'Das Formular ist abgelaufen. Bitte lade die Seite neu und versuche es noch einmal.'

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex')
}

// Vergleich in konstanter Zeit: ein `!==` bricht beim ersten abweichenden
// Zeichen ab und verrät über die Laufzeit, wie viele Zeichen stimmten.
function signatureMatches(actual: string, expected: string): boolean {
  const a = Buffer.from(actual, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Beim Rendern des Formulars ausstellen — pro Seitenaufruf frisch. */
export function generateFormToken(): string {
  const payload = `${PURPOSE}:${Date.now()}`
  const b64 = Buffer.from(payload).toString('base64url')
  return `${b64}.${sign(payload)}`
}

/**
 * `ok`         — echtes Formular, alt genug, Signatur stimmt.
 * `zu-schnell` — unter drei Sekunden ausgefüllt: automatisiert.
 * `abgelaufen` — echtes Formular, aber zu lange offen gelegen.
 * `ungueltig`  — fehlend, verstümmelt, manipuliert oder aus der Zukunft.
 */
export type FormTokenVerdict = 'ok' | 'zu-schnell' | 'abgelaufen' | 'ungueltig'

export function checkFormToken(token: string): FormTokenVerdict {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 0) return 'ungueltig'
    const b64 = token.slice(0, dotIdx)
    const hmac = token.slice(dotIdx + 1)
    const payload = Buffer.from(b64, 'base64url').toString()
    if (!signatureMatches(hmac, sign(payload))) return 'ungueltig'

    const parts = payload.split(':')
    if (parts.length !== 2 || parts[0] !== PURPOSE) return 'ungueltig'
    const issuedAt = Number(parts[1])
    if (!Number.isFinite(issuedAt)) return 'ungueltig'

    const alter = Date.now() - issuedAt
    // Ein Zeitstempel aus der Zukunft kann nicht aus einem ausgelieferten
    // Formular stammen — Signatur hin oder her, hier stimmt etwas nicht.
    if (alter < 0) return 'ungueltig'
    if (alter < MIN_FORM_AGE_MS) return 'zu-schnell'
    if (alter > MAX_FORM_AGE_MS) return 'abgelaufen'
    return 'ok'
  } catch {
    return 'ungueltig'
  }
}
