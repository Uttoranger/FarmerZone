import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { bremseReservieren } from '@/server/bremse-datenbank'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { gibVerwaisteFreiFuerProdukte } from '@/server/verwaiste-bestellungen'
import { HOF_KAUFBARKEIT_AUSWAHL, pruefeKaufbarkeitHof } from '@/server/warenkorb'
import { MAX_MENGE } from '@/lib/reservierung'

const bodySchema = z.object({
  productId: z.string().min(1),
  // Obergrenze gegen Bestand blockieren mit einer Riesenmenge — so viel führt
  // kein Hof, und der Bestand ist ein Int.
  quantity: z.number().int().positive().max(MAX_MENGE),
  sessionId: z.string().min(1),
})

const RESERVATION_TTL_MS = 15 * 60 * 1000 // 15 minutes

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit('reserve', request)
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    const mengeZuGross = parsed.error.issues.some(
      (issue) => issue.path[0] === 'quantity' && issue.code === 'too_big'
    )
    return NextResponse.json(
      { error: mengeZuGross ? 'Bitte eine Menge bis 10.000.' : 'Ungültige Parameter' },
      { status: 400 }
    )
  }

  const { productId, quantity, sessionId } = parsed.data

  // Zweite Bremse je SITZUNG (die sessionId steht erst nach dem Parsen fest).
  // Ohne sie könnte eine IP beliebig viele Sitzungen eröffnen und über sie den
  // Bestand eines Hofes blockieren.
  const sitzungsLimit = enforceRateLimit('reserve', request, sessionId)
  if (sitzungsLimit) return sitzungsLimit

  // Zweite Stufe über alle Instanzen (Register S17 Punkt 1): ein Zähler je IP,
  // gemeinsam mit /api/warenkorb/pruefen. Nach dem Parsen — kaputte Anfragen
  // kosten keine Datenbankabfrage —, vor der Fristfreigabe und jeder Hof-Prüfung:
  // Wer gebremst ist, erfährt nichts über den Hof und löst kein Schreiben aus.
  const ueberAlleInstanzen = await bremseReservieren(request)
  if (ueberAlleInstanzen) return ueberAlleInstanzen

  const now = new Date()
  const expiresAt = new Date(now.getTime() + RESERVATION_TTL_MS)

  try {
    // 0. Frist gilt beim Lesen: Verwaiste Bestellungen dieses Hofs geben ihre
    //    Ware frei, BEVOR der Bestand gelesen wird (src/lib/fristen.ts).
    //    Scheitert das, wird nur gemeldet — die Reservierung läuft weiter.
    await gibVerwaisteFreiFuerProdukte([productId], now)

    // 1. Clean up expired reservations for this product
    await prisma.stockReservation.deleteMany({
      where: { productId, expiresAt: { lt: now } },
    })

    // 2. Verify product exists and is available
    // Pausen- und Stilllegungs-Zustand kommen über den Hof-Join: der Request
    // kennt nur die productId, und ein zweiter Query wäre unnötig. Die aktiven
    // Abholzeiten braucht die Kaufsperre, wie in der Kasse.
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true, isAvailable: true, farm: { select: HOF_KAUFBARKEIT_AUSWAHL } },
    })

    if (!product || !product.isAvailable) {
      return NextResponse.json({ error: 'Produkt nicht verfügbar' }, { status: 409 })
    }

    // 2b. Prüfkette des Hofs (src/server/warenkorb.ts, Nr. 165): Stilllegung →
    // Freischaltung → Pause → Kaufsperre, fail-closed VOR jeder
    // Reservierungslogik — vor der Bestandsrechnung und vor dem upsert. Dieselbe
    // Kette nutzt /api/warenkorb/pruefen. Die Kaufsperre (Register N24) zählt die
    // vollen Tage wie die Kasse; die verwaisten Bestellungen des Hofs hat
    // Schritt 0 schon freigegeben.
    const sperre = await pruefeKaufbarkeitHof(product.farm, now)
    if (sperre) {
      return NextResponse.json({ error: sperre.text }, { status: 409 })
    }

    // 3. Count stock reserved by OTHER sessions (excluding this session)
    const othersAgg = await prisma.stockReservation.aggregate({
      where: {
        productId,
        sessionId: { not: sessionId },
        expiresAt: { gt: now },
      },
      _sum: { quantity: true },
    })

    const reservedByOthers = othersAgg._sum.quantity ?? 0
    const available = product.stock - reservedByOthers

    if (available < quantity) {
      return NextResponse.json(
        { error: `Nur noch ${Math.max(0, available)} verfügbar` },
        { status: 409 }
      )
    }

    // 4. Upsert reservation for this session
    await prisma.stockReservation.upsert({
      where: { productId_sessionId: { productId, sessionId } },
      create: { productId, sessionId, quantity, expiresAt },
      update: { quantity, expiresAt },
    })

    return NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString() })
  } catch (e) {
    console.error('[/api/reserve]', e)
    return NextResponse.json({ error: 'Serverfehler bei der Reservierung' }, { status: 500 })
  }
}
