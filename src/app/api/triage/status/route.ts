import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { createRateLimiter, getClientIp, RATE_LIMIT_WINDOW_MS } from '@/lib/rate-limit'
import { ROLLE_JE_ZIEL, entscheideUebergang, rolleAusToken } from '@/lib/triage-status'
import { triageStatusSchema } from '@/schemas/meldung'

/**
 * Schreibroute des Fehlerbriefkastens (Sprint Briefkasten-Rückkopplung, Teil B):
 * POST /api/triage/status → setzt einen Status, sonst nichts.
 *
 * Aufrufer: das CLI (`pnpm briefkasten geplant | vermutlich-wunsch`, Token
 * TRIAGE_WRITE_TOKEN) und die GitHub Action nach einem Production-Deployment
 * (ERLEDIGT und Wiederöffnen, Token TRIAGE_MERGE_TOKEN). Welcher Token was
 * darf und welche Übergänge gelten, entscheidet lib/triage-status.ts.
 *
 * Schutz, in dieser Reihenfolge:
 *   1. Rate-Limit 10 Aufrufe je Minute je IP — VOR dem Token, wie die Leseroute.
 *   2. Bearer-Token in konstanter Zeit, fail-closed: unbekannt → 401; kennt
 *      die Route den Token, darf er aber diesen Status nicht → 403.
 *   3. Zod, STRIKT — kein antwortAnMelder, kein Freitext an den Melder.
 *   4. Schreiben nur auf den gelesenen Stand (Status UND Notiz). Hat sich die
 *      Meldung dazwischen geändert, 409 statt Überschreiben.
 * Antwort bei Erfolg: nur der neue Status.
 */

const MAX_AUFRUFE_PRO_MINUTE = 10
const drossel = createRateLimiter({ max: MAX_AUFRUFE_PRO_MINUTE, windowMs: RATE_LIMIT_WINDOW_MS })

const KEIN_CACHE = { 'Cache-Control': 'no-store' }

function fehler(status: number, code: string, error: string, extra: Record<string, string> = {}) {
  return NextResponse.json({ error, code }, { status, headers: { ...KEIN_CACHE, ...extra } })
}

export async function POST(request: NextRequest) {
  // 1. Rate-Limit je IP
  if (!drossel.check(`triage-status:${getClientIp(request.headers)}`)) {
    return fehler(429, 'ZU_VIELE', 'Zu viele Anfragen — bitte warte einen Moment und versuche es erneut.', {
      'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)),
    })
  }

  // 2. Token → Rolle
  const rolle = rolleAusToken(request.headers.get('authorization') ?? '', {
    lesen: env.TRIAGE_TOKEN,
    write: env.TRIAGE_WRITE_TOKEN,
    merge: env.TRIAGE_MERGE_TOKEN,
  })
  if (rolle === 'nicht-getrennt') {
    // Nur Namen, nie Werte — die Meldung landet im Log und damit ggf. in Sentry.
    console.error('[triage-status] TRIAGE_TOKEN, TRIAGE_WRITE_TOKEN und TRIAGE_MERGE_TOKEN müssen verschieden sein — Route gesperrt.')
  }
  if (rolle !== 'WRITE' && rolle !== 'MERGE') return fehler(401, 'TOKEN', 'Token fehlt oder ist unbekannt.')

  // 3. Body
  let roh: unknown
  try {
    roh = await request.json()
  } catch {
    return fehler(400, 'UNGUELTIG', 'Der Body ist kein JSON.')
  }
  const eingabe = triageStatusSchema.safeParse(roh)
  if (!eingabe.success) return fehler(400, 'UNGUELTIG', eingabe.error.issues[0]?.message ?? 'Ungültige Eingabe.')
  const { meldungId, status: ziel, prNummer, grund, quelle } = eingabe.data

  if (ROLLE_JE_ZIEL[ziel] !== rolle) {
    return fehler(403, 'FALSCHER_TOKEN', `Dieser Token darf ${ziel} nicht setzen.`)
  }

  // 4. Meldung — Kurznummer muss eindeutig sein; beim Schreiben keine beliebige nehmen.
  const treffer = await prisma.meldung.findMany({
    where: meldungId.length >= 20 ? { id: meldungId } : { id: { startsWith: meldungId } },
    take: 2,
    select: { id: true, status: true, art: true, triageNotiz: true, antwortAnMelder: true },
  })
  if (treffer.length === 0) return fehler(404, 'NICHT_GEFUNDEN', `Keine Meldung zu „${meldungId}".`)
  if (treffer.length > 1) {
    return fehler(409, 'MEHRDEUTIG', `„${meldungId}" passt auf mehrere Meldungen — bitte die volle ID nehmen.`)
  }
  const meldung = treffer[0]

  const entscheidung = entscheideUebergang(
    meldung,
    { ziel, prNummer: prNummer ?? null, grund: grund ?? null, quelle },
    new Date()
  )
  if (entscheidung.art === 'abgelehnt') return fehler(409, entscheidung.code, entscheidung.grund)
  if (entscheidung.art === 'unveraendert') {
    return NextResponse.json({ status: meldung.status }, { headers: KEIN_CACHE })
  }

  // 5. Bedingt schreiben: nur auf genau den Stand, den die Entscheidung gesehen hat.
  const { count } = await prisma.meldung.updateMany({
    where: { id: meldung.id, status: meldung.status, triageNotiz: meldung.triageNotiz },
    data: entscheidung.daten,
  })
  if (count === 0) {
    return fehler(409, 'GEAENDERT', 'Die Meldung hat sich gerade geändert — bitte noch einmal versuchen.')
  }

  revalidatePath('/admin')
  revalidatePath('/admin/meldungen')
  revalidatePath(`/admin/meldungen/${meldung.id}`)
  revalidatePath('/meldungen')
  return NextResponse.json({ status: entscheidung.daten.status }, { headers: KEIN_CACHE })
}
