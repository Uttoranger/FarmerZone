import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })
  const orders = await prisma.order.findMany({
    select: { orderNumber: true, status: true, customerEmail: true, customerName: true, paymentMethod: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  for (const o of orders) {
    console.log(`${o.orderNumber} | ${o.status} | ${o.paymentMethod} | ${o.customerEmail} (${o.customerName})`)
  }
  await prisma.$disconnect()
}
main().catch(console.error)
