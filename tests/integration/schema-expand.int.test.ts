/**
 * Integrationstest — Schema-Expand Redesign (Gate 3, Nachtlauf Nr. 06).
 *
 * Die Aussage: Die Migration 20261005120000_schema_expand_redesign ist auf den
 * Bestand anwendbar (global-setup fährt `migrate deploy`), und die neuen
 * Strukturen tun in der echten Datenbank, was das Schema verspricht:
 *
 *   - DEPLOY-FENSTER: Alter Code schreibt Höfe, Bestellungen und Positionen,
 *     ohne die neuen Spalten zu kennen. Das wird hier mit rohem SQL nachgestellt,
 *     das nur die alten Spalten nennt — und danach steht überall der Bestandswert
 *     (Tarif null, erstattetCents 0, fehltSeit null …), nichts scheitert.
 *   - Die neuen Enum-Werte sind nach dem Commit der Migration benutzbar.
 *   - Die eindeutigen Schlüssel greifen (BrennmaterialAngaben je Produkt,
 *     TeilenAufruf je Hof/Kanal/Tag, Monatsabrechnung je Hof/Monat), und der
 *     Zähler der Teilen-Wirkung wächst per Upsert, ohne eine zweite Zeile.
 *   - Kaskade und Sperre: Brennmaterial stirbt mit dem Produkt; ein Hof mit
 *     Monatsabrechnung lässt sich nicht löschen (Aufbewahrungspflicht).
 *
 * Mit gemocktem Prisma ist nichts davon prüfbar — es sind Aussagen über
 * Spalten-Defaults, Indizes und Fremdschlüssel.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { erstelleHof, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

/** Der Prisma-Fehlercode eines abgelehnten Aufrufs, sonst null. */
async function fehlerCode(aufruf: Promise<unknown>): Promise<string | null> {
  try {
    await aufruf
    return null
  } catch (fehler) {
    return fehler instanceof Prisma.PrismaClientKnownRequestError ? fehler.code : 'unbekannt'
  }
}

describe('Deploy-Fenster: alter Code schreibt ohne die neuen Spalten', () => {
  it('ein Hof aus altem Code hat keinen Tarif und kein SEPA-Mandat', async () => {
    const kennung = intKennung('althof')
    await prisma.user.create({
      data: { id: kennung, email: `${kennung}@example.com`, name: 'Max Mustermann', role: 'FARMER' },
    })

    // Nur Spalten, die es vor der Migration gab — so schreibt der alte Code.
    await prisma.$executeRaw`
      INSERT INTO "Farm" ("id", "slug", "name", "ownerName", "description", "address",
                          "postalCode", "city", "phone", "email", "ownerId", "updatedAt")
      VALUES (${kennung}, ${kennung}, 'Hof Test', 'Max Mustermann', 'Erfundener Hof.',
              'Teststraße 1', '8700', 'Teststadt', '+43 660 0000000',
              ${`${kennung}@example.com`}, ${kennung}, now())`

    const hof = await prisma.farm.findUniqueOrThrow({ where: { slug: kennung } })
    expect(hof.tarif).toBeNull()
    expect(hof.sepaMandatAm).toBeNull()
  })

  it('eine Bestellung aus altem Code hat nichts erstattet, keinen Kanal und keine fehlende Position', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id)
    const bestellId = intKennung('bestellung')
    const positionId = intKennung('position')

    await prisma.$executeRaw`
      INSERT INTO "Order" ("id", "orderNumber", "farmId", "customerEmail", "customerName",
                           "customerPhone", "totalAmount", "pickupDate", "pickupTimeStart",
                           "pickupTimeEnd", "paymentMethod", "serviceFeeCents", "updatedAt")
      VALUES (${bestellId}, ${bestellId}, ${farm.id}, ${`${bestellId}@example.com`},
              'Erika Mustermann', '+43 660 0000000', 10.30, now(), '15:00', '18:00',
              'ONSITE_CASH', 52, now())`
    await prisma.$executeRaw`
      INSERT INTO "OrderItem" ("id", "orderId", "productId", "productName", "unitPrice",
                               "quantity", "totalPrice", "vatRate")
      VALUES (${positionId}, ${bestellId}, ${produkt.id}, 'Testprodukt', 10.30, 1, 10.30, 10)`

    const bestellung = await prisma.order.findUniqueOrThrow({
      where: { id: bestellId },
      include: { items: true },
    })
    expect(bestellung.erstattetCents).toBe(0)
    expect(bestellung.serviceFeeMinCentsApplied).toBeNull()
    expect(bestellung.teilenKanal).toBeNull()
    // Der bestehende Snapshot bleibt, was er war.
    expect(bestellung.serviceFeeCents).toBe(52)
    expect(bestellung.items).toHaveLength(1)
    expect(bestellung.items[0].fehltSeit).toBeNull()
  })

  it('ein Produkt aus altem Code ist ein Einzelprodukt ohne Verpackungsangabe und ohne Brennmaterial', async () => {
    const { farm } = await erstelleHof()
    const produktId = intKennung('altprodukt')

    await prisma.$executeRaw`
      INSERT INTO "Product" ("id", "farmId", "name", "price", "unit", "updatedAt")
      VALUES (${produktId}, ${farm.id}, 'Testprodukt', 4.50, 'STUECK', now())`

    const produkt = await prisma.product.findUniqueOrThrow({
      where: { id: produktId },
      include: { brennmaterial: true },
    })
    expect(produkt.familieId).toBeNull()
    expect(produkt.verpackung).toBeNull()
    expect(produkt.brennmaterial).toBeNull()
  })
})

describe('Neue Enum-Werte und Spalten sind nach der Migration benutzbar', () => {
  it('ein Produkt nimmt Schüttraummeter, Hackschnitzel, Familie und Verpackung an', async () => {
    const { farm } = await erstelleHof()
    const familie = intKennung('familie')

    const produkt = await prisma.product.create({
      data: {
        id: intKennung('produkt'),
        farmId: farm.id,
        name: 'Hackschnitzel Fichte',
        price: 99,
        unit: 'SCHUETTRAUMMETER',
        category: 'BRENNHOLZ',
        subcategory: 'HACKSCHNITZEL',
        familieId: familie,
        verpackung: 'LOSE_BALLEN',
      },
    })

    expect(produkt.unit).toBe('SCHUETTRAUMMETER')
    expect(produkt.subcategory).toBe('HACKSCHNITZEL')
    expect(await prisma.product.count({ where: { familieId: familie } })).toBe(1)
  })
})

describe('BrennmaterialAngaben', () => {
  it('wird zum Produkt angelegt und mit ihm gelesen; gelagertSeit ist ein Kalenderdatum', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { name: 'Buche, ofenfertig' })

    await prisma.brennmaterialAngaben.create({
      data: {
        productId: produkt.id,
        holzart: 'Buche',
        scheitlaengeCm: 33,
        trocknung: 'OFENFERTIG',
        restfeuchteMax: 20,
        gelagertSeit: new Date('2024-10-01'),
        ueberdacht: true,
      },
    })

    const gelesen = await prisma.product.findUniqueOrThrow({
      where: { id: produkt.id },
      include: { brennmaterial: true },
    })
    expect(gelesen.brennmaterial).toMatchObject({
      holzart: 'Buche',
      scheitlaengeCm: 33,
      trocknung: 'OFENFERTIG',
      restfeuchteMax: 20,
      wassergehalt: null,
      koernung: null,
      ueberdacht: true,
    })
    expect(gelesen.brennmaterial?.gelagertSeit?.toISOString()).toBe('2024-10-01T00:00:00.000Z')
  })

  it('ueberdacht ist ohne Angabe false', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id)

    const angaben = await prisma.brennmaterialAngaben.create({
      data: { productId: produkt.id, holzart: 'gemischt', trocknung: 'FRISCH' },
    })

    expect(angaben.ueberdacht).toBe(false)
  })

  it('gibt es höchstens einmal je Produkt', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id)
    await prisma.brennmaterialAngaben.create({
      data: { productId: produkt.id, holzart: 'Buche', trocknung: 'OFENFERTIG' },
    })

    const code = await fehlerCode(
      prisma.brennmaterialAngaben.create({
        data: { productId: produkt.id, holzart: 'Eiche', trocknung: 'LUFTTROCKEN' },
      })
    )

    expect(code).toBe('P2002')
    expect(await prisma.brennmaterialAngaben.count({ where: { productId: produkt.id } })).toBe(1)
  })

  it('stirbt mit dem Produkt', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id)
    await prisma.brennmaterialAngaben.create({
      data: { productId: produkt.id, holzart: 'Buche', trocknung: 'OFENFERTIG' },
    })

    await prisma.product.delete({ where: { id: produkt.id } })

    expect(await prisma.brennmaterialAngaben.count({ where: { productId: produkt.id } })).toBe(0)
  })
})

describe('TeilenAufruf — nur Zähler je Hof, Kanal und Tag', () => {
  const TAG = new Date('2026-10-05')

  it('zählt per Upsert in EINER Zeile hoch', async () => {
    const { farm } = await erstelleHof()
    const zaehle = () =>
      prisma.teilenAufruf.upsert({
        where: { farmId_kanal_tag: { farmId: farm.id, kanal: 'WHATSAPP', tag: TAG } },
        create: { farmId: farm.id, kanal: 'WHATSAPP', tag: TAG, besuche: 1 },
        update: { besuche: { increment: 1 } },
      })

    await zaehle()
    await zaehle()
    await zaehle()

    const zeilen = await prisma.teilenAufruf.findMany({ where: { farmId: farm.id } })
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0]).toMatchObject({ kanal: 'WHATSAPP', besuche: 3, bestellungen: 0 })
    expect(zeilen[0].tag.toISOString()).toBe('2026-10-05T00:00:00.000Z')
  })

  it('lehnt eine zweite Zeile für denselben Hof, Kanal und Tag ab', async () => {
    const { farm } = await erstelleHof()
    await prisma.teilenAufruf.create({ data: { farmId: farm.id, kanal: 'QR', tag: TAG } })

    const code = await fehlerCode(prisma.teilenAufruf.create({ data: { farmId: farm.id, kanal: 'QR', tag: TAG } }))

    expect(code).toBe('P2002')
  })

  it('Gegenprobe: anderer Kanal oder anderer Tag ist eine eigene Zeile', async () => {
    const { farm } = await erstelleHof()
    await prisma.teilenAufruf.create({ data: { farmId: farm.id, kanal: 'QR', tag: TAG } })

    await prisma.teilenAufruf.create({ data: { farmId: farm.id, kanal: 'LINK', tag: TAG } })
    await prisma.teilenAufruf.create({ data: { farmId: farm.id, kanal: 'QR', tag: new Date('2026-10-06') } })

    expect(await prisma.teilenAufruf.count({ where: { farmId: farm.id } })).toBe(3)
  })
})

describe('Monatsabrechnung', () => {
  const SEPTEMBER = new Date('2026-09-01')
  const abrechnung = (farmId: string) => ({
    farmId,
    monat: SEPTEMBER,
    tarif: 'HOFLADEN' as const,
    grundgebuehrCents: 1900,
    servicegebuehrBarCents: 2800,
    barBestellungen: 28,
    servicegebuehrOnlineCents: 3000,
    nichtAbgeholtBestellungen: 2,
    summeCents: 4700,
  })

  it('gibt es höchstens einmal je Hof und Monat', async () => {
    const { farm } = await erstelleHof({ tarif: 'HOFLADEN' })
    await prisma.monatsabrechnung.create({ data: abrechnung(farm.id) })

    const code = await fehlerCode(prisma.monatsabrechnung.create({ data: abrechnung(farm.id) }))

    expect(code).toBe('P2002')
  })

  it('sperrt das Löschen des Hofs (Aufbewahrungspflicht)', async () => {
    const { farm } = await erstelleHof({ tarif: 'HOFLADEN' })
    await prisma.monatsabrechnung.create({ data: abrechnung(farm.id) })

    const code = await fehlerCode(prisma.farm.delete({ where: { id: farm.id } }))

    expect(code).not.toBeNull()
    expect(await prisma.farm.count({ where: { id: farm.id } })).toBe(1)
  })
})
