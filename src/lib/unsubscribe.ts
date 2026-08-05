import { createHmac, timingSafeEqual } from 'crypto'
import { env } from '@/lib/env'

// Das Geheimnis kommt aus dem validierten env-Modul, nicht aus process.env.
// env.ts erzwingt BETTER_AUTH_SECRET beim Start; ein stiller Literal-Fallback
// würde einen Konfigurationsfehler verschleiern und Links mit einem im Code
// nachlesbaren Geheimnis signieren. Die Signatur-Logik selbst ist unverändert —
// bereits versendete Links bleiben gültig (in Produktion war der Fallback
// ohnehin nie aktiv, sonst hätte env.ts den Start abgebrochen).
const SECRET = env.BETTER_AUTH_SECRET

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

export function generateUnsubscribeToken(email: string, farmId: string): string {
  const payload = `${email.toLowerCase()}:${farmId}`
  const b64 = Buffer.from(payload).toString('base64url')
  return `${b64}.${sign(payload)}`
}

// BEWUSST OHNE ABLAUFDATUM: ein Abmeldelink muss auch nach Jahren noch
// funktionieren, sonst sitzt der Empfänger in einem Newsletter fest.
export function verifyUnsubscribeToken(token: string): { email: string; farmId: string } | null {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 0) return null
    const b64 = token.slice(0, dotIdx)
    const hmac = token.slice(dotIdx + 1)
    const payload = Buffer.from(b64, 'base64url').toString()
    if (!signatureMatches(hmac, sign(payload))) return null
    const colonIdx = payload.indexOf(':')
    if (colonIdx < 0) return null
    return {
      email: payload.slice(0, colonIdx),
      farmId: payload.slice(colonIdx + 1),
    }
  } catch {
    return null
  }
}
