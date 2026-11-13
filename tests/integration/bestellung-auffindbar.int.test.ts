/**
 * Register N32 (Nachtlauf 34, Nr. 304a) gegen ein ECHTES Postgres: Jede
 * Bestellung ist im Admin auffindbar — über die Nummer oder die genaue
 * Adresse, auch wenn sie älter ist als die 90 Tage der Mail-Aufbewahrung und
 * auch bei einem engeren Zeitraum im Filter. Ohne Suche gilt der Zeitraum
 * weiter; Admin › Betrieb › E-Mails (`sucheMails` ohne den Parameter) bleibt
 * bei den 90 Tagen. Testhöfe heißen „Testhof …“, Adressen @example.com.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { bestellFilterAus } from '@/schemas/admin-bestellung'
import { mailSucheAus } from '@/schemas/betrieb-mails'
import { ladeBestellListe } from '@/server/queries/admin-bestellungen'
import { sucheMails } from '@/server/queries/mails'
import { erstelleHof, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'

const TAG_MS = 24 * 60 * 60 * 1000

afterEach(async () => {
  await raeumeAuf()
})

async function alteBestellung(tage: number, abweichend: { stand?: 'PAID' | 'CANCELLED' } = {}) {
  const { farm } = await erstelleHof({ name: 'Testhof Auffindbar' })
  const produkt = await erstelleProdukt(farm.id, { stock: 5 })
  const email = `${intKennung('kundin')}@example.com`
  const nummer = `INT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
  const b = await prisma.order.create({
    data: {
      orderNumber: nummer,
      farmId: farm.id,
      customerEmail: email,
      customerName: 'Erika Beispiel',
      customerPhone: '+43 660 0000000',
      status: abweichend.stand ?? 'PAID',
      totalAmount: 20,
      createdAt: new Date(Date.now() - tage * TAG_MS),
      pickupDate: new Date(Date.now() + TAG_MS),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      platformFeeAmount: 0,
      serviceFeeCents: 100,
      serviceFeePercentApplied: 4.9,
      items: { create: [{ productId: produkt.id, productName: 'Testprodukt', unitPrice: 10, quantity: 2, totalPrice: 20, vatRate: 10 }] },
    },
    select: { id: true, orderNumber: true, customerEmail: true },
  })
  return { ...b, farmId: farm.id }
}

describe('Bestellung über die Nummer immer auffindbar (N32)', () => {
  it('200 Tage alt: Nummer und genaue Adresse finden sie, auch bei Zeitraum „7 Tage“', async () => {
    const b = await alteBestellung(200)
    const jetzt = new Date()
    const sieben = bestellFilterAus({ zeitraum: '7t' })

    expect((await ladeBestellListe(mailSucheAus(b.orderNumber), sieben, jetzt)).map((z) => z.id)).toEqual([b.id])
    expect((await ladeBestellListe(mailSucheAus(b.customerEmail), sieben, jetzt)).map((z) => z.id)).toEqual([b.id])
  })

  it('ohne Suche bleibt sie außerhalb des Zeitraums unsichtbar', async () => {
    const b = await alteBestellung(200)
    const liste = await ladeBestellListe(mailSucheAus(''), bestellFilterAus({ zeitraum: '7t' }), new Date())
    expect(liste.map((z) => z.id)).not.toContain(b.id)
  })

  it('Stand und Hof aus dem Filter gelten bei der Suche weiter', async () => {
    const b = await alteBestellung(200)
    const jetzt = new Date()
    expect(await ladeBestellListe(mailSucheAus(b.orderNumber), bestellFilterAus({ stand: 'abgeholt' }), jetzt)).toEqual([])
    expect(await ladeBestellListe(mailSucheAus(b.orderNumber), bestellFilterAus({ hof: 'anderer-hof' }), jetzt)).toEqual([])
  })

  it('sucheMails ohne den Parameter findet sie nicht (E-Mails unverändert), mit ohneZeitgrenze ja', async () => {
    const b = await alteBestellung(200)
    const jetzt = new Date()
    const nachNummer = { art: 'bestellung', nummer: b.orderNumber } as const
    const nachAdresse = { art: 'adresse', adresse: b.customerEmail } as const

    expect((await sucheMails(nachNummer, jetzt)).bestellungen).toEqual([])
    expect((await sucheMails(nachAdresse, jetzt)).bestellungen).toEqual([])
    expect((await sucheMails(nachNummer, jetzt, { ohneZeitgrenze: true })).bestellungen.map((x) => x.id)).toEqual([b.id])
    expect((await sucheMails(nachAdresse, jetzt, { ohneZeitgrenze: true })).bestellungen.map((x) => x.id)).toEqual([b.id])
  })
})
