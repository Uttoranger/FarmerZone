import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { env } from '@/lib/env'
import { cronBerechtigt } from '@/lib/geheimnis'
import { gibVerwaisteBestellungenFrei } from '@/server/verwaiste-bestellungen'

/**
 * Das Netz unter der Frist (src/lib/fristen.ts): einmal täglich alle Höfe.
 * Aufruf durch Vercel Cron (vercel.json: `30 3 * * *`, UTC; der Hobby-Tarif
 * erlaubt nur einmal täglich).
 *
 * Die Frist selbst gilt beim LESEN — wer Bestand liest, gibt vorher frei.
 * Dieser Lauf erwischt Höfe, bei denen tagelang niemand liest; ohne ihn
 * stünden dort verfallene Bestellungen im Bestand und beim Hof.
 *
 * Geschützt wie die anderen Cron-Routen: Bearer mit CRON_SECRET, fail-closed,
 * Vergleich in konstanter Zeit.
 */
export async function GET(request: NextRequest) {
  if (!cronBerechtigt(request.headers.get('authorization'), env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jetzt = new Date()
  const { uebersprungenIds, ...ergebnis } = await gibVerwaisteBestellungenFrei(jetzt)

  // Überfällig, aber bei Stripe bezahlt oder in Bearbeitung: Normalerweise
  // setzt der Webhook sie gleich auf bezahlt. Stehen sie beim täglichen Lauf
  // noch offen, fehlt vermutlich ein Webhook — das soll jemand sehen. Nur
  // Bestell-IDs, keine Kundendaten.
  if (uebersprungenIds.length > 0) {
    Sentry.captureMessage('Überfällige Online-Bestellungen mit bezahlter oder laufender Zahlung', {
      level: 'warning',
      tags: { aufgabe: 'verwaiste-bestellungen' },
      extra: { orderIds: uebersprungenIds },
    })
  }

  return NextResponse.json({ ...ergebnis, at: jetzt.toISOString() })
}
