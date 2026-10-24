import { pruefeLink, signiereLink } from '@/lib/link-signatur'

// Signiert über src/lib/link-signatur.ts (Zweck `nachbestellen`, Register S17,
// Nr. 166): mit LINK_SECRET hängt die Signatur als `2.<hex>` am Token, ohne wie
// bisher als `<hex>` mit BETTER_AUTH_SECRET. Bereits versendete Links gelten
// weiter. Das Token ist `<Base64url>.<Signatur>`; Base64url enthält nie einen
// Punkt, deshalb trennt der ERSTE Punkt Inhalt und Signatur.
const ZWECK = 'nachbestellen'

// Reorder-Links stecken in Bestellmails und liegen dort dauerhaft im Postfach.
// 180 Tage decken jede realistische Nachbestellung ab und begrenzen trotzdem,
// wie lange ein abgefangener Link brauchbar bleibt.
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000

export function generateReorderToken(orderId: string, farmId: string): string {
  const payload = `${orderId}:${farmId}:${Date.now()}`
  const b64 = Buffer.from(payload).toString('base64url')
  return `${b64}.${signiereLink(ZWECK, payload)}`
}

export function verifyReorderToken(token: string): { orderId: string; farmId: string } | null {
  try {
    const dotIdx = token.indexOf('.')
    if (dotIdx < 0) return null
    const b64 = token.slice(0, dotIdx)
    const signatur = token.slice(dotIdx + 1)
    const payload = Buffer.from(b64, 'base64url').toString()
    if (!pruefeLink(ZWECK, payload, signatur)) return null

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
