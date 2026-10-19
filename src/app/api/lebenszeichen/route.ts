import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { geheimnisGleich } from '@/lib/geheimnis'
import { fehlendeAblaeufe } from '@/lib/betrieb'
import { ladeLaeufe } from '@/server/queries/betrieb'

/*
 * Das Lebenszeichen (Register N18, Nr. 113): die tägliche Prüfung von außen,
 * ob die Abläufe gelaufen sind. Ein GitHub-Workflow (.github/workflows/
 * lebenszeichen.yml) ruft die Route jeden Morgen auf; scheitert der Aufruf,
 * scheitert der Workflow, und GitHub schreibt der Projektleitung — auch wenn
 * bei Vercel gar nichts mehr läuft (am 19.10. lief keiner der vier Abläufe,
 * und die Prüfung nach jedem Ablauf warnte deshalb nie).
 *
 * Schutz, fail-closed: Ohne LEBENSZEICHEN_TOKEN antwortet sie 503 (nie 200),
 * ohne oder mit falschem Bearer-Token 401 — Vergleich in konstanter Zeit
 * (`geheimnisGleich`: Längenprüfung, dann timingSafeEqual).
 *
 * Antwort: 200 `{ ok: true }`, wenn jeder tägliche Ablauf in den letzten 26
 * Stunden und der wöchentliche in den letzten 8 Tagen ok lief (gleiche Regel
 * wie Admin › Betrieb, `ablaufStand`); sonst 503 mit den NAMEN der fehlenden
 * Abläufe — keine Zeiten, keine Fehlerklassen, nichts sonst.
 */
const KOPF = { 'Cache-Control': 'no-store' } as const

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = env.LEBENSZEICHEN_TOKEN
  if (!token) return NextResponse.json({ error: 'Nicht eingerichtet.' }, { status: 503, headers: KOPF })
  if (!geheimnisGleich(request.headers.get('authorization') ?? '', `Bearer ${token}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: KOPF })
  }

  const fehlen = fehlendeAblaeufe(await ladeLaeufe(), new Date())
  if (fehlen.length > 0) return NextResponse.json({ fehlen }, { status: 503, headers: KOPF })
  return NextResponse.json({ ok: true }, { headers: KOPF })
}
