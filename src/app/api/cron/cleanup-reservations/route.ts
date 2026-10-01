import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronBerechtigt } from '@/lib/geheimnis'

// Aufruf durch Vercel Cron einmal täglich (vercel.json: `0 3 * * *`, UTC —
// mehr erlaubt der Hobby-Tarif nicht). Er räumt nur auf: Die
// Reservierungsfrist gilt beim Lesen (src/lib/reservierung.ts).
export async function GET(request: NextRequest) {
  // Fail-closed und in konstanter Zeit: ohne konfiguriertes Secret bleibt der
  // Endpoint gesperrt, und die Laufzeit verrät nichts über das Secret.
  if (!cronBerechtigt(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await prisma.stockReservation.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })

  return NextResponse.json({ deleted: result.count, at: new Date().toISOString() })
}
