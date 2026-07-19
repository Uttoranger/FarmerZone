import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// ── Rate-Limiting (Härtung 2b) ────────────────────────────────────────────────
//
// SERVERLESS-KAVEAT: Dieser Limiter hält seine Zähler im Prozess-Speicher.
// Auf Vercel gilt das Limit damit PRO INSTANZ, nicht global — parallel warme
// Instanzen haben je eigene Fenster. Für einen Pilothof mit einem echten
// Nutzer ist das bewusst ausreichend (Schutz gegen simple Schleifen/Bots);
// ein globaler Store (Upstash/Redis) ist geparkt, Trigger: sichtbarer
// Missbrauch.

// Franz-tauglich: der eine echte Nutzer darf sich nie selbst aussperren.
// 20 Checkout-/Reservierungs-Aufrufe pro Minute erreicht kein Mensch beim
// normalen Bestellen (jeder Klick auf "Menge ändern" ist EIN reserve-Call) —
// eine curl-Schleife schon.
export const CHECKOUT_RESERVE_MAX_PER_WINDOW = 20
export const RATE_LIMIT_WINDOW_MS = 60_000

// IP-Ermittlung hinter Vercel/Proxies: x-forwarded-for enthält die Kette
// "client, proxy1, proxy2" — der ERSTE Eintrag ist der Client. Fallback
// x-real-ip (einige Proxies), sonst 'unknown' (limitiert dann gemeinsam —
// besser als gar kein Limit).
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

// Sliding Window: pro Schlüssel die Zeitstempel der letzten Aufrufe;
// Aufrufe älter als das Fenster fallen heraus.
export function createRateLimiter({
  max = CHECKOUT_RESERVE_MAX_PER_WINDOW,
  windowMs = RATE_LIMIT_WINDOW_MS,
}: { max?: number; windowMs?: number } = {}) {
  const hits = new Map<string, number[]>()

  return {
    // true = erlaubt (und gezählt), false = über dem Limit
    check(key: string, now: number = Date.now()): boolean {
      const cutoff = now - windowMs
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff)
      if (recent.length >= max) {
        hits.set(key, recent)
        return false
      }
      recent.push(now)
      hits.set(key, recent)
      return true
    },
  }
}

const limiters = new Map<string, ReturnType<typeof createRateLimiter>>()

// Für Routen-Handler: null = weiter, sonst fertige 429-Antwort.
// Aktiv NUR bei NODE_ENV=production — lokales `pnpm dev` bleibt ungebremst,
// damit sich Entwickler nicht selbst aussperren.
export function enforceRateLimit(routeKey: string, request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null

  let limiter = limiters.get(routeKey)
  if (!limiter) {
    limiter = createRateLimiter()
    limiters.set(routeKey, limiter)
  }

  const ip = getClientIp(request.headers)
  if (limiter.check(`${routeKey}:${ip}`)) return null

  return NextResponse.json(
    { error: 'Zu viele Anfragen — bitte warte einen Moment und versuche es erneut.' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) } }
  )
}
