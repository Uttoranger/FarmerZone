/**
 * Abholung nach Absprache (Register N47, Nr. 257) gegen ein ECHTES Postgres —
 * die Aussagen, die nur die Datenbank beantwortet:
 *   1. Kasse: getAbspracheProduktIds liefert nur die Produkte DIESES Hofs mit
 *      „Abholung nach Absprache“.
 *   2. Heute (getHeute → Packliste): Kontakt nur an der offenen Bestellung mit
 *      Absprache; die Zeile ohne Absprache trägt weder Telefon noch E-Mail — in
 *      den Seitendaten nicht und im HTML weder tel: noch mailto:.
 *   3. Bestellung (getHofBestellDetail): die Marke nur bei offenen Bestellungen
 *      mit Absprache; ein fremder Hof bekommt weder Marke noch Kontakt (null).
 * Geprüft wird der Zustand danach (TESTING_GUIDELINES §1).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import { Prisma, type OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getHeute } from '@/server/queries/heute'
import { getHofBestellDetail } from '@/server/queries/orders'
import { getAbspracheProduktIds } from '@/server/queries/products'
import { Packliste } from '@/components/heute/heute-teile'
import { packlistenStand } from '@/lib/heute'
import { ABSPRACHE_TEXT } from '@/lib/abholhinweise'
import { erstelleHof, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

/** Ein Hof mit einem Futter „Abholung nach Absprache“ und einem Produkt ohne Hinweis. */
async function hofMitProdukten() {
  const { farm } = await erstelleHof()
  const absprache = await erstelleProdukt(farm.id, { name: 'Rundballen', stock: 20 })
  await prisma.product.update({ where: { id: absprache.id }, data: { abholhinweise: ['NACH_ABSPRACHE', 'ANHAENGER_NOETIG'] } })
  const ohne = await erstelleProdukt(farm.id, { name: 'Freilandeier', stock: 20 })
  await prisma.product.update({ where: { id: ohne.id }, data: { abholhinweise: ['FRONTLADER'] } })
  return { farm, absprache, ohne }
}

/** Eine Bestellung für HEUTE (Wiener Tag) mit einer Position; Kontakt je Bestellung eindeutig. */
async function bestellung(farmId: string, produkt: { id: string; name: string }, status: OrderStatus, telefon = '+43 660 0000000') {
  const email = `${intKennung('kundin')}@example.com`
  const order = await prisma.order.create({
    data: {
      orderNumber: intKennung('bestellung').toUpperCase(),
      farmId,
      customerEmail: email,
      customerName: 'Anna Muster',
      customerPhone: telefon,
      status,
      totalAmount: new Prisma.Decimal('10.00'),
      pickupDate: new Date(),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      items: {
        create: [{ productId: produkt.id, productName: produkt.name, unitPrice: new Prisma.Decimal('10.00'), quantity: 1, totalPrice: new Prisma.Decimal('10.00'), vatRate: 10 }],
      },
    },
  })
  return { order, email }
}

describe('Kasse: Produkt-IDs mit Absprache', () => {
  it('nur die Produkte des Hofs mit „Abholung nach Absprache“, nie die eines fremden Hofs', async () => {
    const a = await hofMitProdukten()
    const b = await hofMitProdukten()

    expect(await getAbspracheProduktIds(a.farm.id)).toEqual([a.absprache.id])
    expect(await getAbspracheProduktIds(b.farm.id)).toEqual([b.absprache.id])
  })
})

describe('Heute: Kontakt nur an der offenen Bestellung mit Absprache', () => {
  it('Zeile mit Absprache trägt tel: und mailto:, die Zeile ohne keinen Kontakt — in Daten und HTML', async () => {
    const { farm, absprache, ohne } = await hofMitProdukten()
    const mit = await bestellung(farm.id, absprache, 'PAID')
    const ohneAbsprache = await bestellung(farm.id, ohne, 'CONFIRMED', '+43 664 0000000')

    const heute = await getHeute(farm.id)
    const zeileMit = heute.abholungen.find((z) => z.id === mit.order.id)
    const zeileOhne = heute.abholungen.find((z) => z.id === ohneAbsprache.order.id)

    expect(zeileMit?.absprache).toEqual({ anrufen: 'tel:+436600000000', email: mit.email })
    expect(zeileOhne).toBeDefined()
    expect(zeileOhne && 'absprache' in zeileOhne).toBe(false)
    // Seitendaten: Die Kontaktdaten der Bestellung ohne Absprache verlassen die Abfrage nicht.
    const daten = JSON.stringify(heute)
    expect(daten).not.toContain(ohneAbsprache.email)
    expect(daten).not.toContain('6640000000')

    // HTML der Packliste: Knöpfe nur an der Zeile mit Absprache, Kontakt nicht als sichtbarer Text.
    const html = renderToStaticMarkup(createElement(Packliste, { zeilen: heute.abholungen, stand: packlistenStand(heute.abholungen), leer: { naechsteAbholung: 'x' } }))
    expect(html.match(/href="tel:/g)).toHaveLength(1)
    expect(html.match(/href="mailto:/g)).toHaveLength(1)
    expect(html).toContain(`href="mailto:${mit.email}"`)
    expect(html).not.toContain(ohneAbsprache.email)
    expect(html).toContain(ABSPRACHE_TEXT.marke)
    expect(html.replace(/<[^>]+>/g, ' ')).not.toContain(mit.email)
  })

  it('Gegenprobe ohne Absprache-Bestellung: weder Marke noch tel: noch mailto:', async () => {
    const { farm, ohne } = await hofMitProdukten()
    await bestellung(farm.id, ohne, 'PAID')

    const heute = await getHeute(farm.id)
    const html = renderToStaticMarkup(createElement(Packliste, { zeilen: heute.abholungen, stand: packlistenStand(heute.abholungen), leer: { naechsteAbholung: 'x' } }))

    expect(heute.abholungen).toHaveLength(1)
    expect(html).not.toContain('tel:')
    expect(html).not.toContain('mailto:')
    expect(html).not.toContain(ABSPRACHE_TEXT.marke)
  })

  it('fremder Hof: seine Packliste zeigt weder die Bestellung noch ihren Kontakt', async () => {
    const a = await hofMitProdukten()
    const b = await hofMitProdukten()
    const mit = await bestellung(a.farm.id, a.absprache, 'PAID')

    const heuteB = await getHeute(b.farm.id)

    expect(heuteB.abholungen).toEqual([])
    expect(JSON.stringify(heuteB)).not.toContain(mit.email)
  })
})

describe('Bestellung: Marke nur bei offenen Bestellungen mit Absprache, nur für den eigenen Hof', () => {
  it('offen mit Absprache: Marke; ohne Absprache: keine', async () => {
    const { farm, absprache, ohne } = await hofMitProdukten()
    const mit = await bestellung(farm.id, absprache, 'READY')
    const ohneAbsprache = await bestellung(farm.id, ohne, 'READY')

    expect((await getHofBestellDetail(farm, mit.order.id, new Date()))?.absprache).toBe(true)
    expect((await getHofBestellDetail(farm, ohneAbsprache.order.id, new Date()))?.absprache).toBe(false)
  })

  it.each(['PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP'] as const)('%s: keine Marke, auch mit Absprache', async (status) => {
    const { farm, absprache } = await hofMitProdukten()
    const { order } = await bestellung(farm.id, absprache, status)

    expect((await getHofBestellDetail(farm, order.id, new Date()))?.absprache).toBe(false)
  })

  it('fremder Hof: weder Marke noch Kontakt', async () => {
    const a = await hofMitProdukten()
    const b = await hofMitProdukten()
    const { order } = await bestellung(a.farm.id, a.absprache, 'PAID')

    expect(await getHofBestellDetail(b.farm, order.id, new Date())).toBeNull()
  })
})
