import { NextRequest, NextResponse } from 'next/server'
import { oeffneVorschau } from '@/server/startseite-vorschau'

/*
 * „Vorschau öffnen" aus Admin › Startseite (Register N16, Nr. 96, Runde 2):
 * Der Link wirkt auf jedem Gerät, auf dem der Admin angemeldet ist — auch am
 * eigenen Handy. Die Startseite selbst bleibt statisch und liest den Link nur
 * im Draft Mode; den schaltet diese Route für den aufrufenden Browser ein,
 * nachdem sie Signatur, Ablauf und Admin-Sitzung geprüft hat
 * (oeffneVorschau), und leitet dann auf `/?vorschau=…&sig=…` weiter. Ohne
 * Admin-Sitzung oder mit ungültigem Link: die normale Startseite.
 *
 * Ein Route Handler, keine Seite: Draft Mode lässt sich nur in Route Handlern
 * und Server Actions einschalten, und ein Handler hängt unter keinem Layout.
 * Antwort ohne Cache, damit kein Zwischenspeicher die Weiterleitung eines
 * Admins an jemand anderen ausliefert.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const ziel = await oeffneVorschau(Object.fromEntries(request.nextUrl.searchParams), new Date())
  const antwort = NextResponse.redirect(new URL(ziel, request.url), 303)
  antwort.headers.set('Cache-Control', 'no-store')
  return antwort
}
