import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZU_VIELE_ANFRAGEN } from '@/lib/bremse-datenbank'

// ── Rate-Limiting (Härtung 2b) ────────────────────────────────────────────────
//
// SERVERLESS-KAVEAT: Dieser Limiter hält seine Zähler im Prozess-Speicher.
// Auf Vercel gilt das Limit damit PRO INSTANZ, nicht global — parallel warme
// Instanzen haben je eigene Fenster. Für einen Pilothof mit einem echten
// Nutzer ist das bewusst ausreichend (Schutz gegen simple Schleifen/Bots).
//
// ZWEI STUFEN (Register R1, Nr. 40): Dieser Speicher ist die ERSTE Stufe.
// Für Anmeldecode, Registrierung, Problem melden, Bestellungen finden und
// Checkout zählt danach die Tabelle `RateLimitZaehler` über alle Instanzen
// (src/lib/bremse-datenbank.ts, src/server/bremse-datenbank.ts) — gefragt
// erst, wenn diese Stufe durchlässt.

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
//
// ZWEI SCHLÜSSEL, wenn eine Sitzung bekannt ist: IP UND Sitzung. Grund: Die
// Reservierung bindet Bestand an eine sessionId. Wer sie frei wählt, könnte
// sonst mit einer IP beliebig viele Sitzungen eröffnen und den ganzen Bestand
// eines Hofes blockieren; umgekehrt teilen sich hinter einem Mobilfunk-NAT
// viele echte Kundinnen eine IP. Erst beide Grenzen zusammen sind brauchbar.
//
// SERVERLESS-KAVEAT wie oben: Die Zähler leben im Prozess, das Limit gilt je
// Instanz. Für den Checkout folgt die zweite Stufe über alle Instanzen
// (`bremseCheckout`, src/server/bremse-datenbank.ts); die übrigen Routen
// bleiben bei dieser einen Stufe.
//
// EIGENE GRENZE (`max`, seit Nr. 47): nur, wo der Aufrufer kein Mensch ist und
// die Vorgabe echte Aufrufe abwiese — die Ein-Klick-Abmeldung kommt von den
// Servern weniger Mailanbieter (EIN_KLICK_JE_MINUTE, src/lib/abmelde-link.ts).
// Jede Grenze hat ihren eigenen Zähler, sie teilt ihn nie mit der Vorgabe.
export function enforceRateLimit(
  routeKey: string,
  request: NextRequest,
  sessionId?: string | null,
  { max = CHECKOUT_RESERVE_MAX_PER_WINDOW }: { max?: number } = {}
): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null

  const zaehler = `${routeKey}:${max}`
  let limiter = limiters.get(zaehler)
  if (!limiter) {
    limiter = createRateLimiter({ max })
    limiters.set(zaehler, limiter)
  }

  const ip = getClientIp(request.headers)
  const schluessel = [`${routeKey}:ip:${ip}`]
  if (sessionId) schluessel.push(`${routeKey}:sid:${sessionId}`)

  // check() zählt mit. Erst alle prüfen, dann entscheiden — sonst bliebe ein
  // Schlüssel ungezählt, sobald ein anderer schon über dem Limit ist.
  const ergebnisse = schluessel.map((k) => limiter.check(k))
  if (ergebnisse.every(Boolean)) return null

  return NextResponse.json(
    { error: ZU_VIELE_ANFRAGEN },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) } }
  )
}
