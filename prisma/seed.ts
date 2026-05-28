import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { auth } from '../src/lib/auth'

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL']!,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seed-Daten werden angelegt...')

  // Bauer-User via Better Auth erstellen (verwaltet Passwort-Hashing selbst)
  let farmerId: string

  const existingUser = await prisma.user.findUnique({
    where: { email: 'bauer@hof-mueller.at' },
  })

  if (existingUser) {
    farmerId = existingUser.id
    console.log('✓ Bauer-User bereits vorhanden:', existingUser.email)
  } else {
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: 'bauer@hof-mueller.at',
        password: 'test1234',
        name: 'Franz Müller',
      },
    })

    if (!signUpResult?.user) {
      throw new Error('Bauer-User konnte nicht erstellt werden')
    }

    farmerId = signUpResult.user.id

    // Rolle auf FARMER setzen und Telefonnummer ergänzen
    await prisma.user.update({
      where: { id: farmerId },
      data: {
        role: 'FARMER',
        phone: '+43 664 123 4567',
        emailVerified: true,
      },
    })

    console.log('✓ Bauer-User angelegt:', signUpResult.user.email)
  }

  // Farm
  const farm = await prisma.farm.upsert({
    where: { slug: 'hof-mueller' },
    update: {},
    create: {
      slug: 'hof-mueller',
      name: 'Hof Müller',
      ownerName: 'Franz Müller',
      description:
        'Wir sind ein kleiner Familienbetrieb in der Steiermark. Unsere Tiere leben auf saftigen Wiesen und werden artgerecht gehalten. Alle Produkte kommen direkt vom Hof – ohne Zwischenhändler.',
      address: 'Hofgasse 12',
      postalCode: '8700',
      city: 'Leoben',
      phone: '+43 664 123 4567',
      email: 'bauer@hof-mueller.at',
      acceptsOnline: true,
      acceptsOnsite: true,
      platformFeePercent: 0,
      isActive: true,
      isPaused: false,
      ownerId: farmerId,
    },
  })

  // Produkte
  const [milch, eier, , fleisch] = await Promise.all([
    prisma.product.upsert({
      where: { id: 'prod-milch' },
      update: {},
      create: {
        id: 'prod-milch',
        farmId: farm.id,
        name: 'Heumilch frisch',
        description:
          'Frische Heumilch von unseren Kühen, die ausschließlich mit Heu und Gras gefüttert werden. Nicht homogenisiert, mild im Geschmack.',
        price: 1.40,
        vatRate: 10,
        unit: 'LITER',
        unitSize: 1,
        stock: 50,
        isAvailable: true,
        isOrganic: true,
        requiresCool: true,
        allergens: ['milch'],
      },
    }),

    prisma.product.upsert({
      where: { id: 'prod-eier' },
      update: {},
      create: {
        id: 'prod-eier',
        farmId: farm.id,
        name: 'Bio-Freilandeier',
        description: 'Eier von glücklichen Hühnern aus Freilandhaltung. 6er-Pack, Größe M-L.',
        price: 3.60,
        vatRate: 10,
        unit: 'PAKET',
        unitSize: 6,
        stock: 30,
        isAvailable: true,
        isOrganic: true,
        requiresCool: false,
        allergens: ['eier'],
      },
    }),

    prisma.product.upsert({
      where: { id: 'prod-holz' },
      update: {},
      create: {
        id: 'prod-holz',
        farmId: farm.id,
        name: 'Brennholz Buche',
        description:
          'Ofentrocken gespaltenes Buchenholz, ideal für Kamin und Kachelofen. 1 Raummeter (ca. 0,7 Festmeter). Bitte beim Abholen PKW-Anhänger mitbringen.',
        price: 95.00,
        vatRate: 10,
        unit: 'M3',
        unitSize: 1,
        stock: 10,
        isAvailable: true,
        isOrganic: false,
      },
    }),

    prisma.product.upsert({
      where: { id: 'prod-fleisch' },
      update: {},
      create: {
        id: 'prod-fleisch',
        farmId: farm.id,
        name: 'Rindfleisch-Paket gemischt',
        description:
          'Gemischtes Rindfleisch-Paket aus eigener Schlachtung: Gulasch, Braten, Faschiertes. Ca. 5 kg, vakuumverpackt. Saisonal verfügbar nach Schlachtung.',
        price: 89.00,
        vatRate: 10,
        unit: 'KG',
        unitSize: 5,
        stock: 8,
        isAvailable: true,
        isOrganic: true,
        requiresFreezer: true,
        allergens: [],
        seasonStart: 10,
        seasonEnd: 3,
      },
    }),
  ])

  // Abholzeiten
  await prisma.pickupSlot.createMany({
    data: [
      { farmId: farm.id, dayOfWeek: 3, startTime: '15:00', endTime: '18:00', isActive: true },
      { farmId: farm.id, dayOfWeek: 6, startTime: '09:00', endTime: '12:00', isActive: true },
    ],
    skipDuplicates: true,
  })

  // 3 Beispiel-ManualSales
  const heute = new Date()
  const letzteWoche = new Date(heute)
  letzteWoche.setDate(heute.getDate() - 7)
  const vorZweiTagen = new Date(heute)
  vorZweiTagen.setDate(heute.getDate() - 2)

  await prisma.manualSale.createMany({
    data: [
      {
        farmId: farm.id,
        productId: eier.id,
        productName: 'Bio-Freilandeier',
        quantity: 10,
        unit: 'PAKET',
        totalAmount: 36.00,
        channel: 'WHATSAPP',
        saleDate: letzteWoche,
        note: 'Stammkundin Maria',
      },
      {
        farmId: farm.id,
        productId: milch.id,
        productName: 'Heumilch frisch',
        quantity: 20,
        unit: 'LITER',
        totalAmount: 28.00,
        channel: 'HOFLADEN',
        saleDate: vorZweiTagen,
        note: null,
      },
      {
        farmId: farm.id,
        productId: fleisch.id,
        productName: 'Rindfleisch-Paket gemischt',
        quantity: 2,
        unit: 'KG',
        totalAmount: 178.00,
        channel: 'BUSINESS',
        saleDate: heute,
        note: 'Gasthof Sonnenhof – Rechnung folgt',
      },
    ],
    skipDuplicates: true,
  })

  console.log('✓ Farm angelegt:', farm.name, '→ /hof-mueller')
  console.log('✓ Produkte: Heumilch, Bio-Eier, Brennholz, Rindfleisch-Paket')
  console.log('✓ Abholzeiten: Mittwoch 15-18 Uhr, Samstag 9-12 Uhr')
  console.log('✓ 3 ManualSales: WhatsApp, Hofladen, Geschäftskunde')
  console.log('\nAnmeldung Bauer-Dashboard:')
  console.log('  E-Mail:   bauer@hof-mueller.at')
  console.log('  Passwort: test1234')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
