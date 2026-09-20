import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { geheimnisGleich } from '@/lib/geheimnis'
import { createRateLimiter, getClientIp, RATE_LIMIT_WINDOW_MS } from '@/lib/rate-limit'
import { briefkastenAlsMarkdown } from '@/lib/briefkasten-export'
import { filterAusParametern, getMeldungenFuerExport } from '@/server/queries/meldung'

/**
 * Leseroute des Fehlerbriefkastens (Sprint triage-leseroute):
 * GET /api/triage/export → der Briefkasten als Markdown, erzeugt von DERSELBEN
 * Funktion wie das CLI (briefkastenAlsMarkdown). Das CLI holt den Export
 * hierüber, wenn TRIAGE_EXPORT_URL und TRIAGE_TOKEN gesetzt sind — für
 * Umgebungen ohne Direktzugang zur Datenbank (Pooler kennt die Leserolle
 * nicht, Direktverbindung nur über IPv6).
 *
 * NUR LESEND: Es gibt ausschließlich GET. Kein POST, kein Schreibpfad, keine
 * Statusänderung über HTTP — Triage bleibt der Server-Action im Admin
 * (isAdmin) vorbehalten. Wer hier etwas anderes als GET ergänzt, bricht den
 * Grundsatz „Eingangskanal, kein Befehlskanal".
 *
 * Schutz, in dieser Reihenfolge:
 *   1. Rate-Limit 10 Aufrufe je Minute je IP — VOR der Token-Prüfung, damit
 *      auch Rateversuche am Token gebremst werden. Immer aktiv (anders als
 *      enforceRateLimit in lib/rate-limit.ts, das lokal aussetzt): der
 *      einzige Aufrufer ist das CLI, das braucht einen Aufruf je Export.
 *      Serverless-Kaveat wie dort: Zähler je Instanz.
 *   2. Authorization: Bearer TRIAGE_TOKEN — fail-closed wie CRON_SECRET beim
 *      Cron: fehlt der Token in der Umgebung, antwortet die Route IMMER 401.
 *      Vergleich in konstanter Zeit (geheimnisGleich), anders als das `!==`
 *      des Cron.
 *   3. Cache-Control: no-store — der Export enthält Triage-Notizen und
 *      Kundinnen-E-Mails, nichts davon darf in einem Zwischenspeicher liegen.
 *
 * Query-Parameter wie im CLI: status (Liste, Voreinstellung NEU,GEPRUEFT) und
 * art (optional). Unbekannte Werte fallen still weg (filterAusParametern).
 */

const MAX_AUFRUFE_PRO_MINUTE = 10
const drossel = createRateLimiter({ max: MAX_AUFRUFE_PRO_MINUTE, windowMs: RATE_LIMIT_WINDOW_MS })

const KEIN_CACHE = { 'Cache-Control': 'no-store' }

export async function GET(request: NextRequest) {
  // 1. Rate-Limit je IP
  const ip = getClientIp(request.headers)
  if (!drossel.check(`triage-export:${ip}`)) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen — bitte warte einen Moment und versuche es erneut.' },
      { status: 429, headers: { ...KEIN_CACHE, 'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) } }
    )
  }

  // 2. Token, fail-closed, konstante Zeit
  const token = env.TRIAGE_TOKEN
  const authHeader = request.headers.get('authorization') ?? ''
  if (!token || !geheimnisGleich(authHeader, `Bearer ${token}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: KEIN_CACHE })
  }

  // 3. Filter aus der Adresse, Export wie im CLI
  const params = request.nextUrl.searchParams
  const filter = filterAusParametern({
    status: params.get('status')?.toUpperCase(),
    art: params.get('art')?.toUpperCase(),
  })
  const meldungen = await getMeldungenFuerExport(filter)

  return new NextResponse(briefkastenAlsMarkdown(meldungen, filter, new Date()), {
    status: 200,
    headers: { ...KEIN_CACHE, 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}
