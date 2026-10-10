import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { cronBerechtigt } from '@/lib/geheimnis'
import { raeumeBremsZaehlerAuf } from '@/server/bremse-datenbank'

// Aufruf durch Vercel Cron einmal täglich (vercel.json: `0 3 * * *`, UTC —
// mehr erlaubt der Hobby-Tarif nicht). Er räumt nur auf: Die
// Reservierungsfrist gilt beim Lesen (src/lib/reservierung.ts), ein Zähler
// der Bremse gilt nur in seinem Fenster (src/lib/bremse-datenbank.ts).
export async function GET(request: NextRequest) {
  // Fail-closed und in konstanter Zeit: ohne konfiguriertes Secret bleibt der
  // Endpoint gesperrt, und die Laufzeit verrät nichts über das Secret.
  if (!cronBerechtigt(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await prisma.stockReservation.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })

  // Alte Zähler der Bremse über alle Instanzen (Register R1, Nr. 40). Eigenes
  // try: Ein Fehler hier darf das Aufräumen der Reservierungen nicht
  // ungeschehen machen und den Cron nicht scheitern lassen — die Zeilen
  // bleiben dann bis morgen liegen, gelesen werden sie ohnehin nicht mehr.
  let bremsZaehler: number | null = null
  try {
    bremsZaehler = await raeumeBremsZaehlerAuf(new Date())
  } catch (err) {
    const meldung = new Error('Bremse: alte Zähler nicht aufgeräumt')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { tags: { aufgabe: 'cron-cleanup', grund: 'bremse-zaehler' } })
  }

  return NextResponse.json({ deleted: result.count, bremsZaehler, at: new Date().toISOString() })
}
