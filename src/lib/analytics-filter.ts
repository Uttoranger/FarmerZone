import type { BeforeSendEvent } from '@vercel/analytics/next'
import { NIE_MELDEN_PARAMETER, NIE_MELDEN_PFADE } from '@/lib/nie-melden'

/**
 * Seiten mit `Referrer-Policy: no-referrer` in next.config.ts (Token, Signatur
 * oder Kennung in der Adresse), soweit sie nicht schon in NIE_MELDEN_PFADE
 * stehen — darunter die Bar-Bestätigung `/:farmSlug/bestaetigen/:token`.
 * tests/analytics-filter.test.ts gleicht die Liste mit der Konfiguration ab,
 * damit eine neue Seite dort nicht hier vergessen wird.
 */
export const ANALYTICS_ZUSATZ_PFADE = [
  '/:farmSlug/confirm/:orderId',
  '/:farmSlug/bestaetigen/:token',
  '/bestellungen',
  '/verify',
  '/sicherheit/:pfad*',
  '/reset-password',
  '/account/neuigkeiten-bestaetigen',
  '/account/unsubscribe',
  '/api/abmelden',
  '/api/orders/confirm/:token',
  // Nr. 182: die Vorschau der Startseite trägt Signatur und Ablauf in der Adresse.
  '/startseite-vorschau',
] as const

/** Nexts einfache Pfadmuster (`:name`, `:name*`) als Ausdruck; mehr kommt in den Listen nicht vor. */
function alsAusdruck(muster: string): RegExp {
  const teile = muster
    .split('/')
    .filter(Boolean)
    .map((teil) => {
      if (/^:\w+\*$/.test(teil)) return '(?:/.*)?'
      if (/^:\w+$/.test(teil)) return '/[^/]+'
      return '/' + teil.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
  return new RegExp(`^${teile.join('')}/?$`)
}

const NIE_ERFASSEN = [...NIE_MELDEN_PFADE, ...ANALYTICS_ZUSATZ_PFADE].map(alsAusdruck)

/**
 * `beforeSend` für Vercel Web Analytics: Ereignisse auf Seiten mit Token in der
 * Adresse gehen nie raus (null), heikle Query-Werte (NIE_MELDEN_PARAMETER)
 * werden aus der Adresse gestrichen. Eine Adresse, die sich nicht lesen lässt,
 * wird verworfen — lieber ein Aufruf zu wenig gezählt als ein Token gesendet.
 * Rein: keine Umgebung, kein Zugriff auf den Browser.
 */
export function filtereAnalyticsEreignis<T extends BeforeSendEvent>(ereignis: T): T | null {
  let adresse: URL
  try {
    adresse = new URL(ereignis.url)
  } catch {
    return null
  }
  if (NIE_ERFASSEN.some((ausdruck) => ausdruck.test(adresse.pathname))) return null

  // Über URLSearchParams statt URL.searchParams: tests/hoefe-seite.test.ts sucht
  // im Baum von /hoefe nach dem Wort, um Nexts useSearchParams zu fassen.
  const query = new URLSearchParams(adresse.search)
  let gestrichen = false
  for (const schluessel of NIE_MELDEN_PARAMETER) {
    if (query.has(schluessel)) {
      query.delete(schluessel)
      gestrichen = true
    }
  }
  if (!gestrichen) return ereignis
  adresse.search = query.toString()
  return { ...ereignis, url: adresse.toString() }
}
