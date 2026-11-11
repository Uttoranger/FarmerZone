/**
 * Integrationstest — Rückbuchung einer Kundenzahlung (Nr. 289, E-022) gegen die
 * echte Datenbank: Webhook mit echter Signaturprüfung, Protokoll und
 * BetriebMessung echt; Stripe ist eine Attrappe (nur die Webhook-Helfer des SDK
 * sind echt, gelesen wird `invoicePayments.list`, geschrieben nie).
 *
 * Aussagen über den ZUSTAND danach:
 *  - `charge.dispute.created` zu einer bezahlten Online-Bestellung: genau ein
 *    Eintrag `kundenzahlung_zurueckgebucht` (Bezug die Bestellung), eine Zeile
 *    `kundenstreit:<Bestellung>:<Streitfall>:rueckbuchung` mit der Antwortfrist;
 *    Heute liest den Fall mit Bestellnummer und Hofname. Ein zweites Zustellen
 *    desselben Ereignisses ändert nichts.
 *  - `charge.dispute.closed` (verloren): Eintrag mit dem Ausgang, die Zeile ist
 *    weg, Heute zeigt den Fall nicht mehr.
 *  - Die Bestellung bleibt in Status, Zahlstand und Beträgen unverändert; kein
 *    schreibender Stripe-Aufruf, keine Mail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))
vi.mock('@/lib/stripe', async () => {
  // Die echten Webhook-Helfer des SDK — Signatur prüfen und im Test erzeugen —, sonst nur Attrappen.
  const { default: Stripe } = await import('stripe')
  const echt = new Stripe('sk_test_integration_dummy')
  return {
    stripe: {
      webhooks: echt.webhooks,
      invoicePayments: { list: vi.fn() },
      refunds: { create: vi.fn() },
      transfers: { createReversal: vi.fn() },
      disputes: { update: vi.fn(), close: vi.fn() },
    },
  }
})
vi.mock('@/server/mail-warteschlange', async (original) => {
  const echt = await original<typeof import('@/server/mail-warteschlange')>()
  return { ...echt, stelleEinOhneRisiko: vi.fn(echt.stelleEinOhneRisiko), stelleMailEinInTransaktion: vi.fn(echt.stelleMailEinInTransaktion) }
})

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/stripe/webhook/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { stelleEinOhneRisiko, stelleMailEinInTransaktion } from '@/server/mail-warteschlange'
import { ladePlattformgebuehrAufgaben } from '@/server/queries/plattformgebuehr'
import { INTEGRATIONS_ENV } from './setup/integrations-umgebung'
import { erstelleHof, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'

const TAG_MS = 24 * 60 * 60 * 1000
/** Bestellungen dieser Datei: Protokoll und Zeilen hängen ohne Präfix an ihrer Kennung — afterEach räumt sie weg. */
const bestellungen: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  // Die Zahlung gehört zu keiner Rechnung der Monatsabrechnung.
  vi.mocked(stripe.invoicePayments.list).mockResolvedValue({ data: [] } as never)
})

afterEach(async () => {
  await prisma.adminAktion.deleteMany({ where: { bezugArt: 'bestellung', bezugId: { in: bestellungen } } })
  for (const id of bestellungen.splice(0)) await prisma.betriebMessung.deleteMany({ where: { art: { startsWith: `kundenstreit:${id}:` } } })
  await raeumeAuf()
})

/** Eine bezahlte Online-Bestellung: 2 × 10,00 € Ware, 1,00 € Servicegebühr. */
async function bezahlteBestellung() {
  const { farm } = await erstelleHof({ acceptsOnline: true })
  const produkt = await erstelleProdukt(farm.id, { stock: 5 })
  const paymentIntentId = intKennung('pi')
  const bestellung = await prisma.order.create({
    data: {
      orderNumber: intKennung('bestellung').toUpperCase(),
      farmId: farm.id,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Beispiel',
      customerPhone: '+43 660 0000000',
      status: 'CONFIRMED',
      totalAmount: 20,
      pickupDate: new Date(Date.now() + TAG_MS),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
      platformFeeAmount: 0,
      serviceFeeCents: 100,
      items: { create: [{ productId: produkt.id, productName: 'Testprodukt', unitPrice: 10, quantity: 2, totalPrice: 20, vatRate: 10 }] },
    },
  })
  bestellungen.push(bestellung.id)
  return { farm, bestellung, paymentIntentId }
}

/**
 * Eine erfundene Kennung eines Streitfalls nur aus Buchstaben: Sieben Ziffern am Stück (etwa eine lange
 * Prozess-ID) ließen das Protokoll den Grund verwerfen — das prüft der Unit-Test eigens.
 */
function streitKennung(): string {
  return `dp_int_${randomUUID().replace(/[^a-f]/g, '')}`
}

/** Signiert wie Stripe und ruft den Handler direkt — kein HTTP-Server. */
async function zustellen(id: string, type: 'charge.dispute.created' | 'charge.dispute.closed', object: Record<string, unknown>) {
  const koerper = JSON.stringify({ id, object: 'event', type, data: { object } })
  const signatur = stripe.webhooks.generateTestHeaderString({ payload: koerper, secret: INTEGRATIONS_ENV.STRIPE_WEBHOOK_SECRET })
  return POST(
    new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signatur, 'content-type': 'application/json' },
      body: koerper,
    })
  )
}

/** Was an der Bestellung Geld oder Stand ist — muss nach jedem Ereignis gleich sein. */
async function geldUndStand(orderId: string) {
  const o = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true, paymentStatus: true, totalAmount: true, serviceFeeCents: true, platformFeeAmount: true, erstattetCents: true, serviceFeeRefundedAt: true, cancelledAt: true, updatedAt: true },
  })
  return { ...o, totalAmount: o.totalAmount.toString(), platformFeeAmount: o.platformFeeAmount.toString() }
}

async function eintraege(orderId: string) {
  return prisma.adminAktion.findMany({ where: { bezugArt: 'bestellung', bezugId: orderId }, orderBy: { wann: 'asc' }, select: { art: true, wer: true, grund: true } })
}

async function zeilen(orderId: string) {
  return prisma.betriebMessung.findMany({ where: { art: { startsWith: `kundenstreit:${orderId}:` } }, select: { art: true, wert: true } })
}

describe('Rückbuchung einer Kundenzahlung: sichtbar, ohne Geld zu bewegen', () => {
  it('created → Protokoll, Zeile und Heute; doppelt zugestellt nichts Neues; closed (verloren) → Ausgang im Protokoll, Zeile und Aufgabe weg', async () => {
    const { farm, bestellung, paymentIntentId } = await bezahlteBestellung()
    const vorher = await geldUndStand(bestellung.id)
    const streitId = streitKennung()
    // Großzügig in der Zukunft (Systemuhr der Integrationsschicht, TESTING_GUIDELINES §1).
    const dueBy = Math.floor((Date.now() + 5 * TAG_MS) / 1000)
    const streit = { id: streitId, object: 'dispute', payment_intent: paymentIntentId, amount: 2100, status: 'needs_response', evidence_details: { due_by: dueBy } }

    // ─── created ───
    const ereignisAngelegt = intKennung('evt')
    expect((await zustellen(ereignisAngelegt, 'charge.dispute.created', streit)).status).toBe(200)
    expect(await eintraege(bestellung.id)).toEqual([{ art: 'kundenzahlung_zurueckgebucht', wer: null, grund: expect.stringMatching(new RegExp(`^Rückbuchung ${streitId} · € 21,00 · Antwort bis `)) }])
    expect(await zeilen(bestellung.id)).toEqual([{ art: `kundenstreit:${bestellung.id}:${streitId}:rueckbuchung`, wert: BigInt(dueBy) }])
    const heute = (await ladePlattformgebuehrAufgaben(new Date())).kundenstreit.filter((k) => k.orderId === bestellung.id)
    expect(heute).toEqual([{ orderId: bestellung.id, bestellnummer: bestellung.orderNumber, hofName: farm.name, art: 'rueckbuchung', seit: expect.any(Date), frist: new Date(dueBy * 1000) }])
    expect(await geldUndStand(bestellung.id)).toEqual(vorher)

    // Dasselbe Ereignis noch einmal: WebhookEvent fängt es, nichts doppelt.
    expect(await (await zustellen(ereignisAngelegt, 'charge.dispute.created', streit)).json()).toEqual({ received: true, skipped: true })
    expect(await eintraege(bestellung.id)).toHaveLength(1)
    expect(await zeilen(bestellung.id)).toHaveLength(1)

    // ─── closed ───
    expect((await zustellen(intKennung('evt'), 'charge.dispute.closed', { ...streit, status: 'lost' })).status).toBe(200)
    expect((await eintraege(bestellung.id)).map((e) => [e.art, e.grund])).toEqual([
      ['kundenzahlung_zurueckgebucht', expect.any(String)],
      ['kundenzahlung_rueckbuchung_abgeschlossen', `${streitId} · verloren`],
    ])
    expect(await zeilen(bestellung.id)).toEqual([])
    expect((await ladePlattformgebuehrAufgaben(new Date())).kundenstreit.some((k) => k.orderId === bestellung.id)).toBe(false)
    expect(await geldUndStand(bestellung.id)).toEqual(vorher)

    // Kein Geld bewegt, keine Mail.
    for (const schreiben of [stripe.refunds.create, stripe.transfers.createReversal, stripe.disputes.update, stripe.disputes.close]) expect(schreiben).not.toHaveBeenCalled()
    expect(stelleEinOhneRisiko).not.toHaveBeenCalled()
    expect(stelleMailEinInTransaktion).not.toHaveBeenCalled()
    expect(await prisma.mailAuftrag.count({ where: { bestellungId: bestellung.id } })).toBe(0)
  })

  it('Rückfrage der Bank ohne Antwortfrist: Eintrag „Rückfrage“, Zeile mit Eingang + 7 Tagen', async () => {
    const { bestellung, paymentIntentId } = await bezahlteBestellung()
    const streitId = streitKennung()
    const vorAufruf = Math.floor(Date.now() / 1000)
    expect((await zustellen(intKennung('evt'), 'charge.dispute.created', { id: streitId, payment_intent: paymentIntentId, amount: 2100, status: 'warning_needs_response' })).status).toBe(200)
    const nachAufruf = Math.floor(Date.now() / 1000)
    expect((await eintraege(bestellung.id)).map((e) => e.art)).toEqual(['kundenzahlung_rueckfrage'])
    const [zeile] = await zeilen(bestellung.id)
    expect(zeile?.art).toBe(`kundenstreit:${bestellung.id}:${streitId}:rueckfrage`)
    const frist = Number(zeile?.wert)
    expect(frist).toBeGreaterThanOrEqual(vorAufruf + 7 * 24 * 60 * 60)
    expect(frist).toBeLessThanOrEqual(nachAufruf + 7 * 24 * 60 * 60)
  })
})
