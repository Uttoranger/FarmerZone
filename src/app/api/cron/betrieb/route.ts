import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { cronBerechtigt } from '@/lib/geheimnis'
import { messeUndPruefe, mitHerzschlag } from '@/server/betrieb'

/**
 * Der Mess-Lauf von Admin › Betrieb (Register N18, Nr. 103): jeden Morgen
 * (vercel.json `0 4 * * *`, UTC — nach den Aufräum-Läufen) Bilder-Speicher und
 * Datenbank messen, dann die Grenzen prüfen; im Herzschlag-Rahmen, der danach
 * die anderen Abläufe prüft. So fällt auch auf, wenn ein anderer Ablauf
 * ausbleibt — und bleibt dieser aus, sieht es der nächste.
 *
 * Geschützt wie alle Cron-Routen: Bearer mit CRON_SECRET, fail-closed (ohne
 * Secret 401), Vergleich in konstanter Zeit (ARCHITECTURE §5).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!cronBerechtigt(request.headers.get('authorization'), env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ergebnis = await mitHerzschlag('betrieb', () => messeUndPruefe(new Date()))
  return NextResponse.json({ ...ergebnis, at: new Date().toISOString() })
}
