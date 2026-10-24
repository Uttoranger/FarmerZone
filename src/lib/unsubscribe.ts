import { pruefeLink, signiereLink } from '@/lib/link-signatur'

// Signiert über src/lib/link-signatur.ts (Zweck `abmelden`, Register S17,
// Nr. 166): mit LINK_SECRET hängt die Signatur als `2.<hex>` am Token, ohne wie
// bisher als `<hex>` mit BETTER_AUTH_SECRET. Bereits versendete Links gelten
// weiter. Das Token ist `<Base64url>.<Signatur>`; Base64url enthält nie einen
// Punkt, deshalb trennt der ERSTE Punkt Inhalt und Signatur.
const ZWECK = 'abmelden'

export function generateUnsubscribeToken(email: string, farmId: string): string {
  const payload = `${email.toLowerCase()}:${farmId}`
  const b64 = Buffer.from(payload).toString('base64url')
  return `${b64}.${signiereLink(ZWECK, payload)}`
}

// BEWUSST OHNE ABLAUFDATUM: ein Abmeldelink muss auch nach Jahren noch
// funktionieren, sonst sitzt der Empfänger in einem Newsletter fest.
export function verifyUnsubscribeToken(token: string): { email: string; farmId: string } | null {
  try {
    const dotIdx = token.indexOf('.')
    if (dotIdx < 0) return null
    const b64 = token.slice(0, dotIdx)
    const signatur = token.slice(dotIdx + 1)
    const payload = Buffer.from(b64, 'base64url').toString()
    if (!pruefeLink(ZWECK, payload, signatur)) return null
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
