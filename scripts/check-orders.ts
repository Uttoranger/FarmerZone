import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  const orders = await prisma.order.findMany({
    select: {
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      stripePaymentIntentId: true,
      paidAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  console.log('\n=== BESTELLUNGEN ===')
  for (const o of orders) {
    console.log(`${o.orderNumber} | ${o.paymentMethod} | status=${o.status} | payStatus=${o.paymentStatus} | pi=${o.stripePaymentIntentId ?? 'none'} | paidAt=${o.paidAt ?? 'none'}`)
  }

  const inconsistent = orders.filter(
    (o) => o.paymentMethod === 'ONLINE' && o.status === 'PENDING_CONFIRMATION'
  )
  console.log(`\n=== INKONSISTENTE ONLINE-BESTELLUNGEN: ${inconsistent.length} ===`)
  for (const o of inconsistent) {
    console.log(`  ${o.orderNumber} | payStatus=${o.paymentStatus} | pi=${o.stripePaymentIntentId ?? 'none'}`)
  }

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
