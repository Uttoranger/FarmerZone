/**
 * Einmalige Migration: ONLINE-Bestellungen, die in PENDING_CONFIRMATION
 * feststecken, weil der Stripe-Webhook localhost nicht erreicht hat.
 *
 * Prüft für jede betroffene Bestellung, ob der PaymentIntent bei Stripe
 * wirklich `succeeded` ist — und setzt den DB-Status dann auf PAID.
 */
import Stripe from 'stripe'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {} as never)
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  // Alle ONLINE-Bestellungen mit noch offenem Status
  const stuck = await prisma.order.findMany({
    where: {
      paymentMethod: 'ONLINE',
      paymentStatus: 'PENDING',
      stripePaymentIntentId: { not: null },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      stripePaymentIntentId: true,
    },
  })

  console.log(`\nGefundene ONLINE-Bestellungen mit payStatus=PENDING: ${stuck.length}`)

  let fixed = 0
  let skipped = 0

  for (const order of stuck) {
    const piId = order.stripePaymentIntentId!
    try {
      const pi = await stripe.paymentIntents.retrieve(piId)
      console.log(`\n  ${order.orderNumber} | pi=${piId} | stripe=${pi.status} | dbStatus=${order.status}`)

      if (pi.status === 'succeeded') {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'PAID',
            paymentStatus: 'PAID',
            paidAt: new Date(pi.created * 1000), // Stripe-Timestamp
          },
        })
        console.log(`  ✅ → auf PAID gesetzt (Zahlung war: ${new Date(pi.created * 1000).toISOString()})`)
        fixed++
      } else {
        console.log(`  ⏭  Übersprungen (Stripe-Status: ${pi.status})`)
        skipped++
      }
    } catch (e) {
      console.error(`  ❌ Fehler bei ${order.orderNumber}:`, e)
      skipped++
    }
  }

  console.log(`\n=== Ergebnis: ${fixed} korrigiert, ${skipped} übersprungen ===`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
