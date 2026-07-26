import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production'

// Reorder-Links stecken in Bestellmails und liegen dort dauerhaft im Postfach.
// 180 Tage decken jede realistische Nachbestellung ab und begrenzen trotzdem,
// wie lange ein abgefangener Link brauchbar bleibt.
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000

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

export function generateReorderToken(orderId: string, farmId: string): string {
  const payload = `${orderId}:${farmId}:${Date.now()}`
  const b64 = Buffer.from(payload).toString('base64url')
  return `${b64}.${sign(payload)}`
}

export function verifyReorderToken(token: string): { orderId: string; farmId: string } | null {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx < 0) return null
    const b64 = token.slice(0, dotIdx)
    const hmac = token.slice(dotIdx + 1)
    const payload = Buffer.from(b64, 'base64url').toString()
    if (!signatureMatches(hmac, sign(payload))) return null

    const parts = payload.split(':')
    // Alt-Tokens ohne Ausstellungszeitpunkt tragen kein prüfbares Alter —
    // sie gelten damit als ungültig (bestehende Fehlerbehandlung: kein Vorbefüllen)
    if (parts.length !== 3) return null
    const [orderId, farmId, issuedAtRaw] = parts
    const issuedAt = Number(issuedAtRaw)
    if (!orderId || !farmId || !Number.isFinite(issuedAt)) return null
    if (Date.now() - issuedAt > MAX_AGE_MS) return null

    return { orderId, farmId }
  } catch {
    return null
  }
}
