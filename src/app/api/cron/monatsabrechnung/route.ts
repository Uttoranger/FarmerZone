import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { cronBerechtigt } from '@/lib/geheimnis'
import { mitHerzschlag } from '@/server/betrieb'
import { rechneMonatsabrechnungen } from '@/server/plattformgebuehr-abrechnung'

/**
 * Die SEPA-Monatsabrechnung der Plattformgebühr (Register N38, Nr. 198):
 * täglich 05:30 UTC (vercel.json). Kündigt den Einzug vier Wochen vorher an
 * und rechnet für jeden Hof, dessen Abrechnungstag heute ist (Wiener Datum),
 * den Vormonat ab (src/server/plattformgebuehr-abrechnung.ts). Ein Fehler bei
 * einem Hof ist eine Warnung, die anderen laufen weiter; ein zweiter Lauf am
 * selben Tag erzeugt nichts Neues.
 *
 * Geschützt wie alle Cron-Routen: Bearer mit CRON_SECRET, fail-closed (ohne
 * Secret 401), Vergleich in konstanter Zeit (ARCHITECTURE §5).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!cronBerechtigt(request.headers.get('authorization'), env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const ergebnis = await mitHerzschlag('monatsabrechnung', () => rechneMonatsabrechnungen(new Date()))
  return NextResponse.json({ ...ergebnis, at: new Date().toISOString() })
}
