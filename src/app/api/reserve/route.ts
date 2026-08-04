import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { SHOP_PAUSED_MESSAGE } from '@/lib/shop-pause'
import { FARM_ARCHIVED_MESSAGE } from '@/lib/farm-archive'
import { FARM_NOT_APPROVED_MESSAGE } from '@/lib/farm-approval'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
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
    return NextResponse.json({ error: 'Ungültige Parameter' }, { status: 400 })
  }

  const { productId, quantity, sessionId } = parsed.data
  const now = new Date()
  const expiresAt = new Date(now.getTime() + RESERVATION_TTL_MS)

  try {
    // 1. Clean up expired reservations for this product
    await prisma.stockReservation.deleteMany({
      where: { productId, expiresAt: { lt: now } },
    })

    // 2. Verify product exists and is available
    // Pausen- und Stilllegungs-Zustand kommen über den Hof-Join: der Request
    // kennt nur die productId, und ein zweiter Query wäre unnötig.
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        stock: true,
        isAvailable: true,
        farm: { select: { isPaused: true, archivedAt: true, approvedAt: true } },
      },
    })

    if (!product || !product.isAvailable) {
      return NextResponse.json({ error: 'Produkt nicht verfügbar' }, { status: 409 })
    }

    // 2b. Stilllegung — fail-closed und VOR der Pause geprüft: der dauerhafte
    // Zustand sticht den vorübergehenden (siehe src/lib/farm-archive.ts).
    if (product.farm.archivedAt) {
      return NextResponse.json({ error: FARM_ARCHIVED_MESSAGE }, { status: 409 })
    }

    // 2b². Freischaltung — nach der Stilllegung, vor der Pause
    // (Begründung der Reihenfolge: src/lib/farm-approval.ts).
    if (!product.farm.approvedAt) {
      return NextResponse.json({ error: FARM_NOT_APPROVED_MESSAGE }, { status: 409 })
    }

    // 2c. Shop-Pause — fail-closed VOR jeder Reservierungslogik: vor der
    // Bestandsrechnung und vor dem upsert, das die Reservierung anlegt.
    if (product.farm.isPaused) {
      return NextResponse.json({ error: SHOP_PAUSED_MESSAGE }, { status: 409 })
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
