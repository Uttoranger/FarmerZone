/**
 * Verkäufe (Nachtlauf Nr. 22b) gegen ein ECHTES Postgres.
 *
 * Die Aussage: Ein Direktverkauf ist Umsatz. Anlegen, Ändern und Löschen
 * treffen nur Verkäufe des eigenen Hofs (Besitz in der WHERE-Klausel), der
 * Bestand eines verknüpften Produkts bleibt ohne Schalter „Vorrat abziehen"
 * unberührt (mit Schalter: verkauf-vorrat.int.test.ts, Register D1), und die
 * Übersicht zählt den Verkauf in der Woche (Bar) und im Feed — mit dem
 * Betrag, den die Spalte gespeichert hat. Geprüft wird der Zustand danach.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { headers } from 'next/headers'
import { createManualSale, deleteManualSale, updateManualSale } from '@/server/actions/manual-sales'
import { getSalesOverview } from '@/server/queries/manual-sales'
import { prisma } from '@/lib/prisma'
import { wienKalendertag } from '@/lib/kalender'
import { erstelleHofMitAnmeldung, erstelleProdukt, raeumeAuf, INT_PRAEFIX } from './setup/basis'

afterEach(async () => {
  await prisma.manualSale.deleteMany({ where: { farm: { slug: { startsWith: INT_PRAEFIX } } } })
  await raeumeAuf()
})

async function angemeldeterHof() {
  const { farm, cookie } = await erstelleHofMitAnmeldung()
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return farm
}

const heute = () => wienKalendertag(new Date())

describe('Verkäufe — eigener Hof, nur Umsatz', () => {
  it('anlegen mit Produkt: gespeichert auf zwei Stellen, Vorrat unberührt, in Woche und Liste gezählt', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 7 })

    expect(await createManualSale({ totalAmount: 24.555, channel: 'MARKT', saleDate: heute(), productId: produkt.id, quantity: 3 })).toEqual({ ok: true })

    const [verkauf] = await prisma.manualSale.findMany({ where: { farmId: farm.id } })
    expect(verkauf.totalAmount.toString()).toBe('24.56')
    expect(verkauf.productName).toBe(produkt.name)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })).stock).toBe(7)

    const uebersicht = await getSalesOverview(farm.id)
    expect(uebersicht.weekBar).toBe(24.56)
    expect(uebersicht.weekTotal).toBe(24.56)
    expect(uebersicht.zeilen).toHaveLength(1)
    expect(uebersicht.zeilen[0]).toMatchObject({ art: 'verkauf', betragCent: 2456, datum: 'Heute' })
  })

  it('ein fremder Hof kann den Verkauf weder ändern noch löschen', async () => {
    const eigener = await angemeldeterHof()
    await createManualSale({ totalAmount: 10, channel: 'HOFLADEN', saleDate: heute() })
    const [verkauf] = await prisma.manualSale.findMany({ where: { farmId: eigener.id } })

    await angemeldeterHof() // ab jetzt ist der fremde Hof angemeldet
    expect(await updateManualSale(verkauf.id, { totalAmount: 99, channel: 'MARKT', saleDate: heute() })).toHaveProperty('error')
    expect(await deleteManualSale(verkauf.id)).toHaveProperty('error')

    const danach = await prisma.manualSale.findUniqueOrThrow({ where: { id: verkauf.id } })
    expect(danach.totalAmount.toString()).toBe('10')
    expect(danach.channel).toBe('HOFLADEN')
  })

  it('löschen am eigenen Hof entfernt genau diesen Verkauf; der Vorrat bleibt', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 4 })
    await createManualSale({ totalAmount: 5, channel: 'HOFLADEN', saleDate: heute(), productId: produkt.id })
    await createManualSale({ totalAmount: 6, channel: 'HOFLADEN', saleDate: heute() })
    const [erster] = await prisma.manualSale.findMany({ where: { farmId: farm.id, productId: produkt.id } })

    expect(await deleteManualSale(erster.id)).toEqual({ ok: true })
    expect(await prisma.manualSale.count({ where: { farmId: farm.id } })).toBe(1)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })).stock).toBe(4)
    expect(await deleteManualSale(erster.id)).toHaveProperty('error')
  })
})
