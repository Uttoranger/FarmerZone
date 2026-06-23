import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOnsiteConfirmation } from '@/lib/email'
import { checkoutRequestSchema } from '@/schemas/checkout'

function generateOrderNumber(farmSlug: string): string {
  const parts = farmSlug.split('-')
  const initials = parts
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3)
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const suffix = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  )
    .join('')
    .toUpperCase()
  return `${initials}-${dd}${mm}-${suffix}`
}


export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 })
  }

  const parsed = checkoutRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Ungültige Daten', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data

  // 1. Load farm
  const farm = await prisma.farm.findUnique({
    where: { id: data.farmId },
    include: { owner: { select: { name: true } } },
  })
  if (!farm || !farm.isActive) {
    return NextResponse.json({ error: 'Hof nicht gefunden' }, { status: 404 })
  }

  // 2. Validate payment method availability
  if (data.paymentMethod === 'ONLINE') {
    if (!farm.acceptsOnline || !farm.stripeAccountReady || !farm.stripeAccountId) {
      return NextResponse.json(
        { error: 'Online-Zahlung ist für diesen Hof nicht verfügbar' },
        { status: 400 }
      )
    }
  } else if (!farm.acceptsOnsite) {
    return NextResponse.json(
      { error: 'Vor-Ort-Zahlung ist für diesen Hof nicht verfügbar' },
      { status: 400 }
    )
  }

  // 3. Stock check — pessimistic: check stock minus other sessions' reservations
  const now = new Date()

  for (const item of data.items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { id: true, stock: true, isAvailable: true, name: true },
    })
    if (!product || !product.isAvailable) {
      return NextResponse.json(
        { error: `Produkt "${item.name}" ist nicht mehr verfügbar` },
        { status: 409 }
      )
    }

    const otherRes = await prisma.stockReservation.aggregate({
      where: {
        productId: item.productId,
        sessionId: { not: data.sessionId },
        expiresAt: { gt: now },
      },
      _sum: { quantity: true },
    })

    const reservedByOthers = otherRes._sum.quantity ?? 0
    const available = product.stock - reservedByOthers

    if (available < item.quantity) {
      return NextResponse.json(
        { error: `Nicht genug Bestand für "${item.name}" (noch ${available} verfügbar)` },
        { status: 409 }
      )
    }
  }

  // 4. Find or create customer account (dormant — no password)
  let customer = await prisma.user.findUnique({
    where: { email: data.customerEmail },
    select: { id: true },
  })

  if (!customer) {
    customer = await prisma.user.create({
      data: {
        id: nanoid(),
        email: data.customerEmail,
        name: data.customerName,
        phone: data.customerPhone,
        role: 'CUSTOMER',
        emailVerified: false,
      },
      select: { id: true },
    })
  }

  // 5. Totals
  const totalAmount = data.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const platformFeeAmount = Math.round(totalAmount * Number(farm.platformFeePercent)) / 100

  // 6. Order number (retry on collision — astronomically unlikely)
  let orderNumber = generateOrderNumber(data.farmSlug)
  const collision = await prisma.order.findUnique({ where: { orderNumber } })
  if (collision) orderNumber = generateOrderNumber(data.farmSlug)

  // 7. Pickup date (noon local time to avoid UTC midnight drift)
  const [y, mo, d] = data.pickupDate.split('-').map(Number)
  const pickupDate = new Date(y, mo - 1, d, 12, 0, 0)

  // 8. Create order
  const order = await prisma.order.create({
    data: {
      orderNumber,
      farmId: farm.id,
      customerId: customer.id,
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerNote: data.customerNote || null,
      status: 'PENDING_CONFIRMATION',
      totalAmount,
      pickupDate,
      pickupTimeStart: data.pickupTimeStart,
      pickupTimeEnd: data.pickupTimeEnd,
      paymentMethod: data.paymentMethod as 'ONLINE' | 'ONSITE_CASH' | 'ONSITE_CARD',
      paymentStatus: 'PENDING',
      platformFeeAmount,
      items: {
        create: data.items.map((i) => ({
          productId: i.productId,
          productName: i.name,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          totalPrice: i.unitPrice * i.quantity,
        })),
      },
    },
  })

  // 9. Decrement stock (sequential, no transaction — PgBouncer limitation)
  for (const item of data.items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } },
    })
  }

  // 10. Release session reservations
  await prisma.stockReservation.deleteMany({
    where: { sessionId: data.sessionId },
  })

  // 10b. Newsletter opt-in — only upsert if customer explicitly opted in
  if (data.optInEmail || data.optInWhatsApp) {
    const email = data.customerEmail.toLowerCase()
    const existing = await prisma.customerFarmSubscription.findUnique({
      where: { customerEmail_farmId: { customerEmail: email, farmId: farm.id } },
      select: { optInEmail: true, optInWhatsApp: true },
    })
    await prisma.customerFarmSubscription.upsert({
      where: { customerEmail_farmId: { customerEmail: email, farmId: farm.id } },
      create: {
        customerEmail: email,
        farmId: farm.id,
        optInEmail: data.optInEmail ?? false,
        optInWhatsApp: data.optInWhatsApp ?? false,
        customerPhone: data.customerPhone || null,
      },
      update: {
        // Only set to true — never overwrite an existing true with false from this checkout
        ...(data.optInEmail ? { optInEmail: true } : {}),
        ...(data.optInWhatsApp ? { optInWhatsApp: true } : {}),
        customerPhone: data.customerPhone || null,
        // Preserve existing opts if they were already true
        ...(existing?.optInEmail ? { optInEmail: true } : {}),
        ...(existing?.optInWhatsApp ? { optInWhatsApp: true } : {}),
      },
    })
  }

  // 11a. ONLINE — create Stripe PaymentIntent
  if (data.paymentMethod === 'ONLINE') {
    const amountCents = Math.round(totalAmount * 100)
    const feeAmountCents = Math.round(platformFeeAmount * 100)

    const intentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
      amount: amountCents,
      currency: 'eur',
      metadata: { orderId: order.id, orderNumber, farmId: farm.id },
      transfer_data: { destination: farm.stripeAccountId! },
    }
    if (feeAmountCents > 0) {
      intentParams.application_fee_amount = feeAmountCents
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams)

    await prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    })

    return NextResponse.json({
      orderId: order.id,
      orderNumber,
      clientSecret: paymentIntent.client_secret,
    })
  }

  // 11b. ONSITE — confirmation token + email to customer
  const confirmationToken = nanoid(32)
  await prisma.order.update({
    where: { id: order.id },
    data: { confirmationToken },
  })

  await sendOnsiteConfirmation(
    {
      orderNumber,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      totalAmount,
      pickupDate,
      pickupTimeStart: data.pickupTimeStart,
      pickupTimeEnd: data.pickupTimeEnd,
      paymentMethod: data.paymentMethod,
      farm: {
        name: farm.name,
        slug: farm.slug,
        email: farm.email,
        ownerName: farm.ownerName,
        address: farm.address,
        postalCode: farm.postalCode,
        city: farm.city,
        phone: farm.phone,
      },
      items: data.items.map((i) => ({
        productName: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.unitPrice * i.quantity,
      })),
    },
    confirmationToken
  )

  return NextResponse.json({ orderId: order.id, orderNumber, requiresConfirmation: true })
}
