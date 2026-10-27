import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { bestellstoppAktiv, type Bestellstopp } from '@/lib/notbremse'
import { ladeBestellstopp } from '@/server/queries/plattform-einstellung'

/*
 * Das Band der Notbremse (Register N34, Nr. 189) fragt hier nach: Satz und
 * Ende, solange die Notbremse JETZT gilt, sonst `null`. API-Route statt
 * Server Action (ARCHITECTURE §3: Aufruf aus `fetch()` im Browser mit eigener
 * Fehlerbehandlung): Die Kundenseiten haben keine Sitzung, und eine Action
 * ohne Sitzungsprüfung ließe die Actions-Wache nicht zu.
 *
 * Öffentlich und nur lesend: Die Antwort ist genau das, was ohnehin im Band
 * steht — nie Grund, Beginn oder Person. Gelesen aus dem Cache der
 * Einstellung (Setzen und Aufheben leeren ihn mit `updateTag`); ob sie gilt,
 * entscheidet die Uhr beim Lesen. Durchgesetzt wird die Notbremse nicht hier,
 * sondern in der Prüfkette (`pruefeBestellstopp`, src/server/warenkorb.ts):
 * Ein Ladefehler heißt darum „kein Band“, nicht 500.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gebremst = enforceRateLimit('notbremse', request)
  if (gebremst) return gebremst

  let stopp: Bestellstopp | null = null
  try {
    stopp = bestellstoppAktiv(await ladeBestellstopp(), new Date())
  } catch (err) {
    Sentry.captureException(err, { level: 'warning', tags: { bereich: 'notbremse-band' } })
  }
  return NextResponse.json({ stopp }, { headers: { 'Cache-Control': 'no-store' } })
}
