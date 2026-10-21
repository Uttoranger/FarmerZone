import * as Sentry from '@sentry/nextjs'
import { NextResponse, type NextRequest } from 'next/server'
import { DB_BREMSEN } from '@/lib/bremse-datenbank'
import {
  CSP_BERICHT_MAX_BYTES,
  CSP_MELDUNGEN_JE_ANFRAGE,
  cspBerichtArt,
  istNeueCspMeldung,
  leseCspMeldungen,
  merkeCspMeldung,
  vergissCspMeldung,
  type CspMeldung,
} from '@/lib/csp'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { ohneAnfrage } from '@/lib/sentry-hygiene'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'

/*
 * Meldungen der CSP zum Beobachten (Register G8, Nr. 125). Nur die Produktion
 * meldet hierher (next.config.ts); Seiten mit Token in der Adresse nie.
 *
 * Die Schritte in GENAU dieser Reihenfolge: Größe → Art des Inhalts → Lesen →
 * Kürzen → Entdoppeln im Speicher → Bremse im Speicher → Bremse über die
 * Datenbank → Sentry. Billiges zuerst: Eine Meldung, die diese Instanz in der
 * letzten Stunde schon weitergab, kostet keine Datenbankabfrage.
 *
 * Die Schritte 5 bis 8 laufen je Meldung: Eine Anfrage kann viele Einträge
 * tragen, die Grenze „30 je Minute und IP" gilt aber für das, was bei Sentry
 * ankommt — darum zählt jede weitergegebene Meldung in beiden Bremsen einzeln,
 * höchstens `CSP_MELDUNGEN_JE_ANFRAGE` je Anfrage (Runde 1).
 *
 * Die Meldung ist Fremdtext (jeder kann hierher schicken): Es bleiben nur
 * Anweisung, Schema und Host bzw. Stichwort und der Pfad der Seite
 * (src/lib/csp.ts). Die Antwort ist immer 204 ohne Inhalt — der Browser
 * wertet sie nicht aus, und ein Absender erfährt nichts über die Bremsen.
 */

const OHNE_INHALT = (): NextResponse => new NextResponse(null, { status: 204 })

/** Je Instanz: welche Meldung zuletzt wann an Sentry ging. */
const GESEHEN = new Map<string, number>()
/** Erste Stufe, wie bei den anderen Bremsen: je Instanz im Speicher, dieselbe Grenze wie die zweite. */
const ERSTE_STUFE = createRateLimiter({ max: DB_BREMSEN.cspBerichtIp.max, windowMs: DB_BREMSEN.cspBerichtIp.fensterMs })

/** Liest höchstens `max` Bytes; null = mehr geschickt (dann wird nicht weitergelesen). */
async function leseBegrenzt(request: NextRequest, max: number): Promise<string | null> {
  if (!request.body) return ''
  const leser = request.body.getReader()
  const teile: Uint8Array[] = []
  let laenge = 0
  for (;;) {
    const { done, value } = await leser.read()
    if (done) break
    laenge += value.byteLength
    if (laenge > max) {
      await leser.cancel()
      return null
    }
    teile.push(value)
  }
  return Buffer.concat(teile).toString('utf8')
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Größe — die Angabe des Absenders; gelesen wird unten trotzdem begrenzt.
  if (Number(request.headers.get('content-length') ?? 0) > CSP_BERICHT_MAX_BYTES) return new NextResponse(null, { status: 413 })

  // 2. Art des Inhalts — nur die beiden Formate der Browser.
  const art = cspBerichtArt(request.headers.get('content-type'))
  if (!art) return new NextResponse(null, { status: 415 })

  // 3. Lesen — bricht der Absender den Datenstrom ab, wirft read(); auch dann 204, denn
  // ein Abbruch ist kein Fehler dieser Seite und gehört nicht zu Sentry.
  let text: string | null
  try {
    text = await leseBegrenzt(request, CSP_BERICHT_MAX_BYTES)
  } catch {
    return OHNE_INHALT()
  }
  if (text === null) return new NextResponse(null, { status: 413 })

  // 4. Kürzen — kaputter Inhalt ergibt keine Meldung.
  let roh: unknown
  try {
    roh = JSON.parse(text)
  } catch {
    return OHNE_INHALT()
  }
  const meldungen = leseCspMeldungen(art, roh)

  const jetztMs = Date.now()
  const ip = getClientIp(request.headers)
  let weitergegeben = 0
  for (const meldung of meldungen) {
    if (weitergegeben >= CSP_MELDUNGEN_JE_ANFRAGE) break
    // 5. Entdoppeln im Speicher. Vorgemerkt wird vor dem ersten await: Eine
    // gleichzeitige Anfrage derselben Instanz mit derselben Meldung zählt sie so
    // schon als gesehen. Lässt eine Bremse sie nicht durch, wird die Vormerkung
    // zurückgenommen — dann geht sie beim nächsten Mal raus.
    if (!istNeueCspMeldung(GESEHEN, meldung, jetztMs)) continue
    merkeCspMeldung(GESEHEN, meldung, jetztMs)
    // 6. und 7. Bremse im Speicher, dann über alle Instanzen — je Meldung ein Treffer.
    if (!ERSTE_STUFE.check(`csp-bericht:${ip}`) || !(await bremseUeberAlleInstanzen([{ bremse: DB_BREMSEN.cspBerichtIp, merkmal: ip }]))) {
      vergissCspMeldung(GESEHEN, meldung)
      break
    }
    // 8. Sentry
    meldeAnSentry(meldung)
    weitergegeben += 1
  }
  return OHNE_INHALT()
}

/** Ohne Anfrage-Daten (Kopfzeilen der Meldung), gruppiert nach Anweisung und Host. */
function meldeAnSentry({ anweisung, host, pfad }: CspMeldung): void {
  Sentry.captureMessage('CSP-Verstoß (nur beobachtet)', (scope) =>
    scope
      .setLevel('warning')
      .setTags({ bereich: 'csp', anweisung, host })
      .setFingerprint(['csp', anweisung, host])
      .setExtras({ pfad })
      .addEventProcessor(ohneAnfrage)
  )
}
