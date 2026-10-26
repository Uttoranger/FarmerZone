import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit } from '@/lib/rate-limit'
import { UEBERFAELLIG_NACH_MS } from '@/lib/betrieb'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { mitFrist } from '@/server/bremse-datenbank'
import { VON_AUSSEN_ABSTAND_MS, schlageVonAussen } from '@/server/betrieb'

/*
 * Die Prüfung der Seite von außen (Register N18, Ergänzung 26.10.2026;
 * Nr. 184): Ein externer Uptime-Dienst (UptimeRobot, Better Stack) ruft
 * GET /api/gesund etwa alle 5 Minuten und schickt der Projektleitung einen
 * Push, wenn die Antwort nicht 200 ist oder ausbleibt — unabhängig von
 * Vercel-Crons, Resend und GitHub.
 *
 * Öffentlich und ohne Token: Die Antwort ist nur `ok` (200) oder `gestoert`
 * (503), Text ohne Details, `no-store`. Geprüft werden die Datenbank
 * (`SELECT 1`) und der Herzschlag der Mail-Warteschlange (Start vor höchstens
 * 10 Minuten) — beides zusammen mit einer Frist von 1 Sekunde. Das Ergebnis
 * gilt 30 Sekunden je Instanz, damit ein Sturm von Aufrufen die Datenbank
 * nicht trifft; davor die Bremse je IP wie bei den anderen öffentlichen
 * Routen (`enforceRateLimit`, 20 je Minute, nur in der Produktion).
 *
 * Jeder Aufruf ist zugleich der Herzschlag „von außen“ (`schlageVonAussen`,
 * höchstens einmal je Minute, nach der Antwort): Bleibt der Uptime-Dienst
 * länger als 30 Minuten still, warnt Admin › Betrieb.
 */
export const dynamic = 'force-dynamic'

/** Wie lange ein Ergebnis je Instanz gilt. */
const GESUND_ZWISCHENSPEICHER_MS = 30 * 1000
/** Die Frist für Datenbank und Mail-Herzschlag zusammen. */
const GESUND_FRIST_MS = 1000
/** Ab wann der Herzschlag der Mail-Warteschlange zu alt ist — dieselbe Grenze wie „überfällig“ in Admin › Betrieb. */
const GESUND_MAILS_MS = UEBERFAELLIG_NACH_MS.minuetlich

const KOPF = { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } as const

// Modul-Zustand: je warmer Instanz, ein Kaltstart beginnt neu — gewollt.
// Eine Route darf nur ihre Handler exportieren; Tests laden das Modul je Fall frisch.
let gemerkt: { gesund: boolean; bisMs: number } | null = null
let letzterSchlagMs = 0

async function pruefe(jetzt: Date): Promise<boolean> {
  try {
    const [, mails] = await mitFrist(
      Promise.all([prisma.$queryRaw`SELECT 1`, prisma.ablaufLauf.findUnique({ where: { name: 'mails' }, select: { gestartetAm: true } })]),
      GESUND_FRIST_MS
    )
    return mails !== null && jetzt.getTime() - mails.gestartetAm.getTime() <= GESUND_MAILS_MS
  } catch {
    // Kein Detail nach außen und kein Sentry: Den Ausfall meldet der Uptime-Dienst, die Ursache steht in Admin › Betrieb.
    return false
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gebremst = enforceRateLimit('gesund', request)
  if (gebremst) return gebremst

  const jetzt = new Date()
  if (jetzt.getTime() - letzterSchlagMs >= VON_AUSSEN_ABSTAND_MS) {
    letzterSchlagMs = jetzt.getTime()
    nachDerAntwort(async () => {
      try {
        await schlageVonAussen(jetzt)
      } catch {
        // Fail-open: Ein fehlender Herzschlag fällt nach 30 Minuten selbst auf.
      }
    })
  }

  if (gemerkt === null || jetzt.getTime() >= gemerkt.bisMs) {
    gemerkt = { gesund: await pruefe(jetzt), bisMs: jetzt.getTime() + GESUND_ZWISCHENSPEICHER_MS }
  }
  return gemerkt.gesund
    ? new NextResponse('ok', { status: 200, headers: KOPF })
    : new NextResponse('gestoert', { status: 503, headers: KOPF })
}
