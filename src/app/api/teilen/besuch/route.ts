import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { enforceRateLimit } from '@/lib/rate-limit'
import { istMaschine, istVorabruf, teilenKanalAus } from '@/lib/teilen-kanal'
import { teilenBesuchSchema } from '@/schemas/teilen'
import { zaehleBesuchFuerSlug } from '@/server/teilen-zaehlung'

/**
 * Besuch über einen geteilten Link zählen (Gate 7, Teilen-Zählung; S8).
 *
 * Warum eine API-Route: Die Hofseite meldet den Besuch per
 * `navigator.sendBeacon` aus dem Browser (ARCHITECTURE §3, „Aufruf aus fetch()
 * im Browser") — erst dann, wenn ein echter Browser die Seite mit `?k=`
 * geöffnet und JavaScript ausgeführt hat. Damit zählen Vorschau-Abrufer der
 * Messenger, Suchmaschinen und Vorabrufe nicht, und das Zählen ist ein POST,
 * nie ein Nebeneffekt eines GET (S2).
 *
 * Gespeichert wird NUR die Summe je Hof, Kanal und Tag: kein Cookie, keine
 * IP, kein Gerät, kein Browser-Text. Die IP nimmt nur die Bremse im Speicher
 * des Prozesses (wie bei jeder öffentlichen Route), sie landet nirgends.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = enforceRateLimit('teilen-besuch', request)
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.', code: 'UNGUELTIG' }, { status: 400 })
  }

  const parsed = teilenBesuchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.', code: 'UNGUELTIG' }, { status: 400 })
  }

  // Maschinen und Vorabrufe zählen nicht — die Antwort ist dieselbe, damit
  // niemand daran ablesen kann, was gezählt wurde.
  if (istMaschine(request.headers.get('user-agent')) || istVorabruf(request.headers)) {
    return NextResponse.json({ ok: true })
  }

  // Das Schema lässt nur die sieben Kürzel durch — null ist hier unmöglich,
  // die Prüfung bleibt als Absicherung.
  const kanal = teilenKanalAus(parsed.data.kanal)
  if (!kanal) return NextResponse.json({ ok: true })

  try {
    await zaehleBesuchFuerSlug(parsed.data.farmSlug, kanal)
  } catch (fehler) {
    // Ein Zähler, kein Geld: melden, der Kundin passiert nichts.
    Sentry.captureException(fehler, { tags: { bereich: 'teilen-besuch' } })
    return NextResponse.json({ error: 'Konnte nicht gezählt werden.', code: 'NICHT_GEZAEHLT' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
