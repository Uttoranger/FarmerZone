import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  sessionId: z.string().min(1),
})

const RESERVATION_TTL_MS = 15 * 60 * 1000 // 15 minutes

export async function POST(request: NextRequest) {
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
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true, isAvailable: true },
    })

    if (!product || !product.isAvailable) {
      return NextResponse.json({ error: 'Produkt nicht verfügbar' }, { status: 409 })
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
