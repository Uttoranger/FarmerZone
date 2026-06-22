/**
 * Setzt alle Kunden-E-Mails in Testbestellungen auf die eigene Adresse,
 * damit Resend mit onboarding@resend.dev testen kann.
 * NUR für lokale Entwicklung!
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

async function main() {
  const MY_EMAIL = 'j.f.briewasser@gmail.com'

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  const result = await prisma.order.updateMany({
    where: { customerEmail: { not: MY_EMAIL } },
    data: { customerEmail: MY_EMAIL, customerName: 'Johannes (Test)' },
  })

  console.log(`✅ ${result.count} Bestellungen auf ${MY_EMAIL} umgestellt`)
  await prisma.$disconnect()
}
main().catch(console.error)
