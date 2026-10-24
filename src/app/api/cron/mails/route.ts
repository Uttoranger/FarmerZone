import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { cronBerechtigt } from '@/lib/geheimnis'
import { mitHerzschlag, pruefeAblaeufe, pruefeMailWarnungen } from '@/server/betrieb'
import { arbeiteWarteschlange } from '@/server/mail-warteschlange'

/** Ein Lauf darf eine Minute dauern; der Worker endet nach 50 s, der nächste Lauf beginnt zur nächsten Minute. */
export const maxDuration = 60

/**
 * Der Worker der Mail-Warteschlange (Register N26, Nr. 158): jede Minute
 * (vercel.json `* * * * *`, Vercel Pro), im Herzschlag-Rahmen — Admin › Betrieb
 * sieht jeden Lauf, und ein Ausfall fällt nach 10 Minuten auf. Läuft schon ein
 * Worker (nach einem Einstellen), endet dieser Aufruf sofort.
 *
 * Nach dem Lauf prüft er die anderen Abläufe und die Warnungen der
 * Mail-Warteschlange (`pruefeMailWarnungen`, Nr. 161).
 *
 * Geschützt wie alle Cron-Routen: Bearer mit CRON_SECRET, fail-closed (ohne
 * Secret 401), Vergleich in konstanter Zeit (ARCHITECTURE §5).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!cronBerechtigt(request.headers.get('authorization'), env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Danach wie jeder Ablauf die anderen prüfen, dazu die Mail-Warnungen (Nr. 161; höchstens alle 10 Minuten, eigene Drossel).
  const danach = async (jetzt: Date): Promise<void> => {
    await pruefeAblaeufe(jetzt)
    await pruefeMailWarnungen(jetzt)
  }
  const ergebnis = await mitHerzschlag('mails', () => arbeiteWarteschlange({ biszeitMs: 50_000 }), danach)
  return NextResponse.json({ ...ergebnis, at: new Date().toISOString() })
}
