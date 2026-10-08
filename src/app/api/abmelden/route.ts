import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { enforceRateLimit } from '@/lib/rate-limit'
import { APP_URL } from '@/lib/umgebung-server'
import { ABMELDEN_FEHLGESCHLAGEN, ABMELDE_LINK_UNGUELTIG, ABMELDE_SEITE, abmeldeSeitenPfad } from '@/lib/abmelde-link'
import { abmeldeTokenSchema, einKlickAbmeldungSchema } from '@/schemas/abmelden'
import { meldeAboMitTokenAb } from '@/server/abo-anmeldung'

/**
 * Ein-Klick-Abmeldung aus dem Mailprogramm (RFC 8058, Nr. 47).
 *
 * Warum eine API-Route: Der Aufrufer ist extern — das Mailprogramm der
 * Kundin schickt nach „Abmelden" einen POST an die Adresse aus der
 * Kopfzeile `List-Unsubscribe` (src/lib/abmelde-link.ts), mit dem festen
 * Inhalt „List-Unsubscribe=One-Click", ohne Cookie und ohne weitere Frage.
 *
 * - Berechtigt ist, wer den signierten Token hat (er steht nur in der Mail an
 *   genau diese Adresse); er gilt bewusst ohne Ablauf wie der Link im Text.
 * - Idempotent: Ein zweiter POST trifft nichts mehr und antwortet gleich.
 * - Keine Auskunft: Dieselbe Antwort, ob es ein Abo gab oder nicht.
 * - GET ändert nie etwas (S2, ARCHITECTURE §5): Link-Scanner und Vorschauen
 *   rufen Adressen aus Mails ungefragt auf. Ein GET führt nur auf die Seite
 *   mit dem Knopf.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const gebremst = enforceRateLimit('abmelden', request)
  if (gebremst) return gebremst

  const token = abmeldeTokenSchema.safeParse(request.nextUrl.searchParams.get('token'))
  if (!token.success) return linkUngueltig()
  const inhalt = einKlickAbmeldungSchema.safeParse(await formularFelder(request))
  if (!inhalt.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.', code: 'UNGUELTIG' }, { status: 400 })
  }

  try {
    const { gueltig } = await meldeAboMitTokenAb(token.data)
    if (!gueltig) return linkUngueltig()
  } catch (fehler) {
    // Fester Text und nur die Fehlerklasse — die Nachricht eines
    // Prisma-Fehlers kann die Adresse tragen, die Adresse den Token.
    const meldung = new Error('Ein-Klick-Abmeldung nicht gespeichert')
    meldung.name = fehler instanceof Error ? fehler.name : 'Unbekannt'
    Sentry.captureException(meldung, { tags: { bereich: 'abmelden', weg: 'ein-klick' } })
    return NextResponse.json({ error: ABMELDEN_FEHLGESCHLAGEN, code: 'NICHT_GESPEICHERT' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

/** Ein GET bucht nichts — weiter zur Seite mit dem Knopf (ohne gültige Gestalt ohne Token). */
export function GET(request: NextRequest): NextResponse {
  const token = abmeldeTokenSchema.safeParse(request.nextUrl.searchParams.get('token'))
  const ziel = token.success ? abmeldeSeitenPfad(token.data) : ABMELDE_SEITE
  return NextResponse.redirect(`${APP_URL}${ziel}`, 303)
}

function linkUngueltig(): NextResponse {
  return NextResponse.json({ error: ABMELDE_LINK_UNGUELTIG, code: 'LINK_UNGUELTIG' }, { status: 400 })
}

/**
 * Die Felder des Formulars — RFC 8058 erlaubt multipart/form-data und
 * application/x-www-form-urlencoded. Alles andere (JSON, leer, kaputt) ist
 * kein Formular: `null`, das Schema lehnt ab.
 */
async function formularFelder(request: NextRequest): Promise<Record<string, string> | null> {
  const art = request.headers.get('content-type') ?? ''
  if (!/^(multipart\/form-data|application\/x-www-form-urlencoded)\b/i.test(art)) return null
  try {
    const felder: Record<string, string> = {}
    for (const [name, wert] of (await request.formData()).entries()) {
      if (typeof wert === 'string') felder[name] = wert
    }
    return felder
  } catch {
    // Ein Körper, der sich nicht als Formular lesen lässt, ist eine ungültige Anfrage — das Schema meldet sie.
    return null
  }
}
