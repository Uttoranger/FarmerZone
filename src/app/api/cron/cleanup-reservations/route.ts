import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { cronBerechtigt } from '@/lib/geheimnis'
import { raeumeBremsZaehlerAuf } from '@/server/bremse-datenbank'
import { mitHerzschlag } from '@/server/betrieb'
import { raeumeAltesAuf, type AufraeumErgebnis } from '@/server/aufraeumen'

// Aufruf durch Vercel Cron einmal täglich (vercel.json: `0 3 * * *`, UTC;
// täglich reicht, seit Vercel Pro wäre auch öfter möglich). Er räumt nur auf: Die
// Reservierungsfrist gilt beim Lesen (src/lib/reservierung.ts), ein Zähler
// der Bremse gilt nur in seinem Fenster (src/lib/bremse-datenbank.ts).
// Seit Nr. 103 im Herzschlag-Rahmen (Register N18): Admin › Betrieb sieht
// jeden Lauf, und danach prüft er die anderen Abläufe. Seit Nr. 104 räumt er
// auch abgelaufene Sitzungen und Codes, alte Webhook-Ereignisse und alte
// Messungen weg (src/server/aufraeumen.ts) — nie Bestellungen.
export async function GET(request: NextRequest) {
  // Fail-closed und in konstanter Zeit: ohne konfiguriertes Secret bleibt der
  // Endpoint gesperrt, und die Laufzeit verrät nichts über das Secret.
  if (!cronBerechtigt(request.headers.get('authorization'), env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(await mitHerzschlag('aufraeumen', raeumeAuf))
}

async function raeumeAuf(): Promise<{ deleted: number; bremsZaehler: number | null; aufgeraeumt: AufraeumErgebnis | null; at: string }> {
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

  // Sitzungen, Codes, Webhook-Ereignisse, Messungen (Nr. 104). Eigenes try aus
  // demselben Grund wie oben: Scheitert es, bleiben die Zeilen bis morgen
  // liegen; Sentry bekommt nur die Klasse unter einem festen Satz.
  let aufgeraeumt: AufraeumErgebnis | null = null
  try {
    aufgeraeumt = await raeumeAltesAuf(new Date())
  } catch (err) {
    const meldung = new Error('Aufräumen: alte Sitzungen, Codes, Webhook-Ereignisse oder Messungen nicht gelöscht')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { tags: { aufgabe: 'cron-cleanup', grund: 'aufraeumen' } })
  }

  return { deleted: result.count, bremsZaehler, aufgeraeumt, at: new Date().toISOString() }
}
