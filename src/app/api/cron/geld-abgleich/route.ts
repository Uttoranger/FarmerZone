import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { cronBerechtigt } from '@/lib/geheimnis'
import { mitHerzschlag } from '@/server/betrieb'
import { GeldAbgleichStripeFehler, gleicheGeldAb } from '@/server/geld-abgleich'

/**
 * Der Geld-Abgleich mit Stripe (Register N37, Nr. 191): jeden Morgen
 * (vercel.json `30 6 * * *`, UTC) Zahlungen, Erstattungen und Gebühren der
 * letzten 48 Stunden bei Stripe lesen — nur lesend — und mit den Bestellungen
 * vergleichen (src/server/geld-abgleich.ts). Im Herzschlag-Rahmen: Scheitert
 * Stripe, steht der Ablauf auf Admin › Betrieb als gescheitert (Warnung), und
 * die Antwort ist 502 ohne Einzelheiten; die anderen Abläufe berührt das nicht.
 *
 * Geschützt wie alle Cron-Routen: Bearer mit CRON_SECRET, fail-closed (ohne
 * Secret 401), Vergleich in konstanter Zeit (ARCHITECTURE §5).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!cronBerechtigt(request.headers.get('authorization'), env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const ergebnis = await mitHerzschlag('geld-abgleich', () => gleicheGeldAb(new Date()))
    return NextResponse.json({ ...ergebnis, at: new Date().toISOString() })
  } catch (err) {
    if (err instanceof GeldAbgleichStripeFehler) return NextResponse.json({ error: 'Stripe nicht gelesen' }, { status: 502 })
    throw err
  }
}
