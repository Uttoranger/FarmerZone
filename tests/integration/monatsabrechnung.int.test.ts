/**
 * Integrationstest — SEPA-Monatsabrechnung der Plattformgebühr (Register N38,
 * Nr. 198) in der echten Datenbank; Stripe ist eine Attrappe (nie live).
 *
 * Aussagen über den ZUSTAND danach:
 *  - Der Lauf liest die Bestellungen des Vormonats mit echten Filtern:
 *    abgeholte Barbestellung (sepa) auf der Rechnung bar, erlassen, nicht
 *    abgeholt, storniert, Modell bisher und eine abgeholte aus dem Monat
 *    davor nicht; online bezahlt als „bezahlt außerhalb“.
 *  - Genau eine Monatsabrechnung je Hof und Monat; ein zweiter Lauf am
 *    selben Tag ändert nichts und ruft Stripe nicht noch einmal.
 *  - Die Sperre liest die Abrechnungen frisch (`ladeGebuehrLage`):
 *    gescheitert seit mehr als `barSperreNachTagen` → bar aus; bezahlt → frei.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const stripeAttrappe = vi.hoisted(() => ({
  customers: { create: vi.fn() },
  invoices: { create: vi.fn(), finalizeInvoice: vi.fn(), pay: vi.fn(), sendInvoice: vi.fn(), retrieve: vi.fn() },
  invoiceItems: { create: vi.fn(), list: vi.fn() },
}))
vi.mock('@/lib/stripe', () => ({ stripe: stripeAttrappe }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
// Das Protokoll hat eigene Tests; hier zählt der Zustand der Abrechnung.
vi.mock('@/server/admin-protokoll', () => ({ protokolliere: vi.fn(async () => true) }))

import { prisma } from '@/lib/prisma'
import { rechneHofAb } from '@/server/plattformgebuehr-abrechnung'
import { ladeGebuehrLage } from '@/server/queries/plattform-einstellung'
import { barMoeglich } from '@/lib/plattformgebuehr'
import { erstelleHof, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'
import { richteRechnungenEin } from '../stripe-rechnungen-attrappe'

// 3. März 2028, 06:30 in Wien: abgerechnet wird Februar 2028.
const JETZT = new Date('2028-03-03T05:30:00.000Z')
const IM_FEBRUAR = new Date('2028-02-14T10:00:00.000Z')
const IM_JAENNER = new Date('2028-01-20T10:00:00.000Z')

afterEach(async () => {
  await raeumeAuf()
})

beforeEach(() => {
  vi.clearAllMocks()
  stripeAttrappe.customers.create.mockResolvedValue({ id: 'cus_int' })
  richteRechnungenEin(stripeAttrappe, (art) => `in_int_${art}`)
})

type Bestellung = {
  paymentMethod: 'ONLINE' | 'ONSITE_CASH'
  status: 'PICKED_UP' | 'NOT_PICKED_UP' | 'CANCELLED' | 'PAID'
  paymentStatus?: 'PAID' | 'PENDING'
  gebuehrModell?: string | null
  gebuehrEinzug?: string | null
  gebuehrCents: number
  pickedUpAt?: Date | null
  paidAt?: Date | null
  pickupDate?: Date
}

async function bestelle(farmId: string, produktId: string, b: Bestellung): Promise<string> {
  const o = await prisma.order.create({
    data: {
      orderNumber: intKennung('nr').toUpperCase(),
      farmId,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Beispiel',
      customerPhone: '+43 660 0000000',
      status: b.status,
      totalAmount: 12,
      pickupDate: b.pickupDate ?? IM_FEBRUAR,
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: b.paymentMethod,
      paymentStatus: b.paymentStatus ?? 'PENDING',
      paidAt: b.paidAt ?? null,
      pickedUpAt: b.pickedUpAt ?? null,
      platformFeeAmount: 0,
      serviceFeeCents: b.gebuehrCents,
      gebuehrModell: b.gebuehrModell === undefined ? 'hofpreis' : b.gebuehrModell,
      gebuehrEinzug: b.gebuehrEinzug === undefined ? 'sepa' : b.gebuehrEinzug,
      items: { create: [{ productId: produktId, productName: 'Testprodukt', unitPrice: 4, quantity: 3, totalPrice: 12, vatRate: 10, gebuehrCents: b.gebuehrCents }] },
    },
    select: { orderNumber: true },
  })
  return o.orderNumber
}

describe('Monatsabrechnung in der echten Datenbank', () => {
  it('Februar: nur die abgeholte sepa-Barbestellung auf der Rechnung bar, online „bezahlt außerhalb“; zweiter Lauf ändert nichts', async () => {
    const { farm } = await erstelleHof({ sepaMandatAm: new Date('2028-01-05T00:00:00.000Z'), sepaZahlungsmittelId: 'pm_int' })
    const produkt = await erstelleProdukt(farm.id, { stock: 10, price: 4 })
    const abgeholt = await bestelle(farm.id, produkt.id, { paymentMethod: 'ONSITE_CASH', status: 'PICKED_UP', pickedUpAt: IM_FEBRUAR, gebuehrCents: 72 })
    await bestelle(farm.id, produkt.id, { paymentMethod: 'ONSITE_CASH', status: 'PICKED_UP', pickedUpAt: IM_FEBRUAR, gebuehrCents: 54, gebuehrEinzug: 'erlassen' })
    await bestelle(farm.id, produkt.id, { paymentMethod: 'ONSITE_CASH', status: 'NOT_PICKED_UP', gebuehrCents: 72 })
    await bestelle(farm.id, produkt.id, { paymentMethod: 'ONSITE_CASH', status: 'CANCELLED', gebuehrCents: 72 })
    await bestelle(farm.id, produkt.id, { paymentMethod: 'ONSITE_CASH', status: 'PICKED_UP', pickedUpAt: IM_FEBRUAR, gebuehrCents: 50, gebuehrModell: null, gebuehrEinzug: null })
    await bestelle(farm.id, produkt.id, { paymentMethod: 'ONSITE_CASH', status: 'PICKED_UP', pickedUpAt: IM_JAENNER, pickupDate: IM_JAENNER, gebuehrCents: 72 })
    const online = await bestelle(farm.id, produkt.id, { paymentMethod: 'ONLINE', status: 'PICKED_UP', paymentStatus: 'PAID', paidAt: IM_FEBRUAR, gebuehrCents: 48, gebuehrEinzug: 'stripe' })

    const hof = { id: farm.id, tarif: null, barMandatPflicht: true, barSperreNachTagen: 14, sepaMandatAm: new Date('2028-01-05T00:00:00.000Z'), sepaZahlungsmittelId: 'pm_int' }
    expect(await rechneHofAb(hof, '2028-02', JETZT)).toEqual({ farmId: farm.id, monat: '2028-02', stand: 'offen', neu: true })

    const abr = await prisma.monatsabrechnung.findMany({ where: { farmId: farm.id } })
    expect(abr).toHaveLength(1)
    expect(abr[0]).toEqual(
      expect.objectContaining({
        tarif: 'HOFTOR',
        servicegebuehrBarCents: 72,
        barBestellungen: 1,
        servicegebuehrOnlineCents: 48,
        nichtAbgeholtBestellungen: 1,
        summeCents: 72,
        grundgebuehrCents: 0,
        stand: 'offen',
        rechnungBarId: 'in_int_bar',
        rechnungOnlineId: 'in_int_online',
        offenSeit: null,
      })
    )
    const positionen = stripeAttrappe.invoiceItems.create.mock.calls.map(([p]) => [p.invoice, p.amount, p.description])
    expect(positionen).toEqual([
      ['in_int_online', 48, `Plattformgebühr online · Bestellung ${online}`],
      ['in_int_bar', 72, `Plattformgebühr bar · Bestellung ${abgeholt}`],
    ])
    expect((await prisma.farm.findUnique({ where: { id: farm.id }, select: { stripeKundeId: true } }))?.stripeKundeId).toBe('cus_int')

    vi.clearAllMocks()
    expect(await rechneHofAb(hof, '2028-02', JETZT)).toEqual(expect.objectContaining({ neu: false, stand: 'offen' }))
    expect(stripeAttrappe.invoices.create).not.toHaveBeenCalled()
    expect(await prisma.monatsabrechnung.count({ where: { farmId: farm.id } })).toBe(1)
  })

  it('Sperre frisch aus der Datenbank: gescheitert seit 15 Tagen → bar aus; bezahlt → wieder frei', async () => {
    const { farm } = await erstelleHof({ sepaMandatAm: new Date('2028-01-05T00:00:00.000Z'), sepaZahlungsmittelId: 'pm_int', einzugAb: new Date('2028-02-01T00:00:00.000Z') })
    await prisma.plattformEinstellung.upsert({ where: { id: 'plattform' }, create: { id: 'plattform' }, update: {} })
    const zeile = await prisma.monatsabrechnung.create({
      data: {
        farmId: farm.id,
        monat: new Date('2028-02-01T00:00:00.000Z'),
        tarif: 'HOFTOR',
        grundgebuehrCents: 0,
        servicegebuehrBarCents: 72,
        barBestellungen: 1,
        servicegebuehrOnlineCents: 0,
        nichtAbgeholtBestellungen: 0,
        summeCents: 72,
        stand: 'gescheitert',
        offenSeit: new Date(JETZT.getTime() - 15 * 24 * 60 * 60 * 1000),
      },
    })
    const hof = await prisma.farm.findUniqueOrThrow({
      where: { id: farm.id },
      select: { id: true, gruendungBis: true, plattformgebuehrProzent: true, einzugAb: true, barMandatPflicht: true, sepaMandatAm: true, barSperreNachTagen: true },
    })
    // Das Modell hängt am Stichtag; mit einem Stichtag in der Vergangenheit gilt hofpreis.
    const vorher = await prisma.plattformEinstellung.findUnique({ where: { id: 'plattform' }, select: { hofpreisModellAb: true } })
    await prisma.plattformEinstellung.update({ where: { id: 'plattform' }, data: { hofpreisModellAb: new Date('2027-01-01T00:00:00.000Z') } })
    try {
      expect(barMoeglich(await ladeGebuehrLage(hof, JETZT), JETZT)).toBe(false)
      await prisma.monatsabrechnung.update({ where: { id: zeile.id }, data: { stand: 'bezahlt', offenSeit: null, eingezogenAm: JETZT } })
      expect(barMoeglich(await ladeGebuehrLage(hof, JETZT), JETZT)).toBe(true)
    } finally {
      await prisma.plattformEinstellung.update({ where: { id: 'plattform' }, data: { hofpreisModellAb: vorher?.hofpreisModellAb ?? null } })
    }
  })
})
