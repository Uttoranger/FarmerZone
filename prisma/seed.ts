import {
  PrismaClient,
  type Prisma,
  type ProductCategory,
  type ProductLabel,
  type ProductSubcategory,
} from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { auth } from '../src/lib/auth'
import { datenbankHost, istDevDatenbank, istTestDatenbank } from '../src/lib/umgebung'

/**
 * Sperre VOR dem ersten Schreibzugriff.
 *
 * Der Seed legt Daten an und überschreibt bestehende (`upsert`). Ein
 * versehentliches `pnpm db:seed` mit der falschen Adresse in der Umgebung
 * schriebe damit in die Produktionsdatenbank. Die Allowlist dafür gibt es
 * längst (src/lib/umgebung.ts, `istDevDatenbank`) — sie war hier nur nie
 * angeschlossen.
 *
 * ZWEI ALLOWLISTS, beide erlaubt. `istDevDatenbank` deckt `pnpm db:seed` ab.
 * `istTestDatenbank` muss dazu, weil das globalSetup der Integrationstests
 * diesen Seed gegen die TESTdatenbank ruft — und die darf auf dem
 * Docker-Dienstnamen `postgres` liegen, den die Dev-Allowlist nicht kennt.
 * Nur `istDevDatenbank` zu prüfen ließe einen solchen Lauf mitten im Setup
 * sterben. Beide zusammen bleiben eng: Produktion kommt durch keine von beiden.
 *
 * In der Meldung steht NUR der Host: Die Verbindungsadresse enthält das
 * Passwort und hat weder im Terminal noch in einem CI-Protokoll etwas verloren.
 */
function verlangeEigeneDatenbank(): void {
  const url = process.env['DATABASE_URL']
  if (istDevDatenbank(url) || istTestDatenbank(url)) return
  console.error(
    `\nSeed abgebrochen: DATABASE_URL zeigt auf ${datenbankHost(url)}.\n` +
      'Das ist weder die Dev- noch eine lokale Testdatenbank. Der Seed legt Daten\n' +
      'an und überschreibt bestehende — erlaubt sind localhost, 127.0.0.1, der\n' +
      'Docker-Dienstname postgres und die Dev-Datenbank.\n' +
      'Prüfe DATABASE_URL in .env.local.\n'
  )
  process.exit(1)
}

verlangeEigeneDatenbank()

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL']!,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seed-Daten werden angelegt...')

  // Bauer-User via Better Auth erstellen (verwaltet Passwort-Hashing selbst)
  let farmerId: string

  const existingUser = await prisma.user.findUnique({
    where: { email: 'bauer@example.com' },
  })

  if (existingUser) {
    farmerId = existingUser.id
    console.log('✓ Bauer-User bereits vorhanden:', existingUser.email)
  } else {
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: 'bauer@example.com',
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
    // Betriebsnummer auch im update — ein erneuter Seed-Lauf rüstet Höfe aus
    // der Zeit vor Sprint Bereiche 1 nach. Die Nummer ist erfunden.
    update: { betriebsnummer: 'LFBIS 1234567', betriebsstatus: 'PRIMAERPRODUKTION' },
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
      email: 'bauer@example.com',
      acceptsOnline: true,
      acceptsOnsite: true,
      platformFeePercent: 0,
      isActive: true,
      isPaused: false,
      // Betriebsnummer gehört dem Hof (Sprint Bereiche 1, Rückfrage F6). Erfunden.
      betriebsnummer: 'LFBIS 1234567',
      betriebsstatus: 'PRIMAERPRODUKTION',
      ownerId: farmerId,
    },
  })

  // Produkte. Kategorie, Unterkategorie und Siegel stehen auch im `update`,
  // damit ein erneuter Seed-Lauf Bestandsprodukte aus der Zeit vor Sprint
  // Taxonomie 1 nachrüstet. isOrganic wird nicht mehr geschrieben — Bio ist
  // das Siegel BIO in labels.
  type Taxonomie = {
    category: ProductCategory
    subcategory: ProductSubcategory | null
    labels: ProductLabel[]
  }
  const milchTaxonomie: Taxonomie = {
    category: 'MILCH',
    subcategory: 'TRINKMILCH',
    labels: ['BIO', 'GENTECHNIKFREI'],
  }
  const eierTaxonomie: Taxonomie = { category: 'EIER', subcategory: 'EIER_FREILAND', labels: ['BIO'] }
  const holzTaxonomie: Taxonomie = { category: 'BRENNHOLZ', subcategory: null, labels: [] }
  const fleischTaxonomie: Taxonomie = { category: 'FLEISCH', subcategory: 'RIND', labels: ['BIO'] }

  // Vollständige Futter-Kennzeichnung, wie sie auf einem Sackanhänger steht.
  // Seit Sprint Bereiche 1 mit Futtermittelart und Nettomenge (Inhalt EINES
  // Gebindes). registrierungsnummer ist Altlast: nicht mehr gesetzt, die
  // Nummer steht am Hof. null auch im update-Zweig, damit ein Seed-Lauf auf
  // einer alten Dev-DB keinen Altbestand stehen lässt.
  const heuKennzeichnung = {
    futtermittelart: 'EINZELFUTTERMITTEL',
    zielTierarten: ['PFERD', 'RIND'],
    zusammensetzung: 'Wiesenheu vom ersten Schnitt, Dauergrünland, ohne Zusatz',
    analytischeBestandteile: 'Rohprotein 9,5 %, Rohfaser 28 %, Rohfett 2 %, Rohasche 7 %',
    nettoMenge: 15,
    nettoEinheit: 'KG',
    rohprotein: 9.5,
    rohfaser: 28,
    rohfett: 2,
    rohasche: 7,
    zusatzstoffe: null,
    registrierungsnummer: null,
    gebrauchshinweis: 'Trocken und luftig lagern. Als Raufutter zur freien Aufnahme.',
    bestaetigtAm: new Date(),
  } satisfies Prisma.FutterKennzeichnungCreateWithoutProductInput

  // Big-Bag-Hafer, den der Hof nur an landwirtschaftliche Betriebe abgibt
  // (Konzept §7) — zeigt im Checkout den Abschnitt „Betrieb“.
  const haferKennzeichnung = {
    futtermittelart: 'EINZELFUTTERMITTEL',
    zielTierarten: ['PFERD', 'RIND', 'GEFLUEGEL'],
    zusammensetzung: 'Hafer, gereinigt, aus eigenem Anbau',
    analytischeBestandteile: 'Rohprotein 11 %, Rohfaser 10 %, Rohfett 5 %, Rohasche 3 %',
    nettoMenge: 500,
    nettoEinheit: 'KG',
    rohprotein: 11,
    rohfaser: 10,
    rohfett: 5,
    rohasche: 3,
    zusatzstoffe: null,
    registrierungsnummer: null,
    gebrauchshinweis: 'Trocken lagern. Big Bag nur mit Stapler oder Frontlader verladbar.',
    bestaetigtAm: new Date(),
  } satisfies Prisma.FutterKennzeichnungCreateWithoutProductInput

  const [milch, eier, , fleisch] = await Promise.all([
    prisma.product.upsert({
      where: { id: 'prod-milch' },
      update: { ...milchTaxonomie },
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
        ...milchTaxonomie,
        requiresCool: true,
        allergens: ['milch'],
      },
    }),

    prisma.product.upsert({
      where: { id: 'prod-eier' },
      update: { ...eierTaxonomie },
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
        ...eierTaxonomie,
        requiresCool: false,
        allergens: ['eier'],
      },
    }),

    prisma.product.upsert({
      where: { id: 'prod-holz' },
      update: { ...holzTaxonomie },
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
        ...holzTaxonomie,
      },
    }),

    prisma.product.upsert({
      where: { id: 'prod-fleisch' },
      update: { ...fleischTaxonomie },
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
        ...fleischTaxonomie,
        requiresFreezer: true,
        allergens: [],
        seasonStart: 10,
        seasonEnd: 3,
      },
    }),

    // Ein Futtermittel mit vollständiger Kennzeichnung (Sprint Taxonomie 1,
    // umgestellt in Sprint Bereiche 1: HEU_STROH/WIESENHEU, Ballen à 15 kg).
    prisma.product.upsert({
      where: { id: 'prod-heu' },
      update: {
        category: 'HEU_STROH',
        subcategory: 'WIESENHEU',
        labels: [],
        unit: 'BALLEN',
        unitSize: null,
        abgabe: 'ALLE',
        futter: { upsert: { create: heuKennzeichnung, update: heuKennzeichnung } },
      },
      create: {
        id: 'prod-heu',
        farmId: farm.id,
        name: 'Heu Kleinballen',
        description:
          'Wiesenheu vom ersten Schnitt, kleine Ballen mit rund 15 kg. Für Pferde und Rinder. Bitte beim Abholen Anhänger oder Kombi mitbringen.',
        price: 6.50,
        vatRate: 10,
        unit: 'BALLEN',
        unitSize: null,
        stock: 40,
        isAvailable: true,
        category: 'HEU_STROH',
        subcategory: 'WIESENHEU',
        labels: [],
        countsTowardLimit: false,
        futter: { create: heuKennzeichnung },
      },
    }),

    prisma.product.upsert({
      where: { id: 'prod-hafer' },
      update: {
        category: 'GETREIDE_KOERNER',
        subcategory: 'HAFER',
        abgabe: 'NUR_BETRIEBE',
        futter: { upsert: { create: haferKennzeichnung, update: haferKennzeichnung } },
      },
      create: {
        id: 'prod-hafer',
        farmId: farm.id,
        name: 'Hafer im Big Bag',
        description:
          'Futterhafer aus eigenem Anbau, gereinigt, im Big Bag mit rund 500 kg. Verladung mit Frontlader am Hof.',
        price: 180.0,
        vatRate: 10,
        unit: 'BIGBAG',
        unitSize: null,
        stock: 6,
        isAvailable: true,
        category: 'GETREIDE_KOERNER',
        subcategory: 'HAFER',
        labels: [],
        abgabe: 'NUR_BETRIEBE',
        countsTowardLimit: false,
        futter: { create: haferKennzeichnung },
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
  console.log('✓ Produkte: Heumilch, Bio-Eier, Brennholz, Rindfleisch-Paket, Heu und Big-Bag-Hafer (Futtermittel mit Kennzeichnung, Hafer nur an Betriebe)')
  console.log('✓ Abholzeiten: Mittwoch 15-18 Uhr, Samstag 9-12 Uhr')
  console.log('✓ 3 ManualSales: WhatsApp, Hofladen, Geschäftskunde')
  console.log('\nAnmeldung Bauer-Dashboard:')
  console.log('  E-Mail:   bauer@example.com')
  console.log('  Passwort: test1234')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
